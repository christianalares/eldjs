import type {
  AnyMiddleware,
  Assign,
  MaybePromise,
  Middleware,
  MiddlewareContext,
  MiddlewareContexts,
  MiddlewareResponses,
  MiddlewareResult,
} from './types.js'

type ResultContext<R> =
  Exclude<Awaited<R>, Response> extends MiddlewareResult<infer C> ? C : {}

/** Explicit middleware composition, following TanStack Start's request middleware model. */
export function createMiddleware<const M extends readonly AnyMiddleware[] = []>(
  dependencies?: M,
) {
  return {
    middleware<const Next extends readonly AnyMiddleware[]>(middleware: Next) {
      return createMiddleware(middleware)
    },
    server<R extends MaybePromise<Response | MiddlewareResult<any>>>(
      server: (options: MiddlewareContext<MiddlewareContexts<M>>) => R,
    ): Middleware<
      Assign<MiddlewareContexts<M>, ResultContext<R>>,
      Extract<Awaited<R>, Response> | MiddlewareResponses<M>
    > {
      return { options: { middleware: dependencies ?? [], server } }
    },
  }
}

/** Dependency-first, identity-deduplicated composition, with cycle detection. */
export function flattenMiddleware(middleware: readonly AnyMiddleware[]) {
  const result: AnyMiddleware[] = []
  const visited = new Set<AnyMiddleware>()
  const active = new Set<AnyMiddleware>()
  function visit(item: AnyMiddleware, depth: number) {
    if (active.has(item) || depth > 100)
      throw new Error('Circular or excessively deep middleware dependencies')
    if (visited.has(item)) return
    active.add(item)
    for (const dependency of item.options.middleware)
      visit(dependency, depth + 1)
    active.delete(item)
    visited.add(item)
    result.push(item)
  }
  for (const item of middleware) visit(item, 0)
  return result
}

export function mergeContext(...values: object[]): Record<string, unknown> {
  const output = Object.create(null) as Record<string, unknown>
  for (const value of values) {
    for (const key of Object.keys(value)) {
      if (key !== '__proto__' && key !== 'prototype' && key !== 'constructor')
        output[key] = (value as Record<string, unknown>)[key]
    }
  }
  return output
}
