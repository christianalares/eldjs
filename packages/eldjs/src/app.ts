import { Hono } from 'hono'
import {
  findRouteMatch,
  processRouteTree,
} from './vendor/tanstack/new-process-route-tree.js'
import { flattenMiddleware, mergeContext } from './middleware.js'
import { InputError, inputErrorResponse, validateInput } from './validation.js'
import type { ApiSchema } from './client-types.js'
import type { AnyRoute } from './route.js'
import type {
  AnyMiddleware,
  AppEnv,
  Method,
  MiddlewareResult,
  MiddlewareResponses,
} from './types.js'

export function createApp<
  T extends AnyRoute,
  const M extends readonly AnyMiddleware[] = [],
>(options: {
  routeTree: T
  middleware?: M
  hono?: Hono<AppEnv>
  /** Match native Hono's case-sensitive paths by default. */
  caseSensitive?: boolean
}): Hono<AppEnv, ApiSchema<T, MiddlewareResponses<M>>> {
  const { processedTree } = processRouteTree(
    options.routeTree,
    options.caseSensitive ?? true,
  )
  const app = options.hono ?? new Hono<AppEnv>()
  app.all('*', async (c) => {
    const pathname = new URL(c.req.url).pathname
    const match = findRouteMatch(pathname, processedTree)
    const handlers = match?.route.options.handlers ?? {}
    const method = c.req.method as Method
    const selected =
      method === 'HEAD'
        ? (handlers.HEAD ?? handlers.GET ?? handlers.ANY)
        : ((Object.hasOwn(handlers, method) ? handlers[method] : undefined) ??
          handlers.ANY)
    const definition =
      typeof selected === 'function' ? { handler: selected } : selected
    const middleware = flattenMiddleware([
      ...(options.middleware ?? []),
      ...(match?.branch.flatMap((route) => route.options.middleware ?? []) ??
        []),
      ...(definition?.middleware ?? []),
    ])
    async function dispatch(
      index: number,
      context: Record<string, unknown>,
    ): Promise<MiddlewareResult<any>> {
      const current = middleware[index]
      if (!current) {
        if (!match || Object.keys(handlers).length === 0)
          return { response: c.json({ error: 'NOT_FOUND' }, 404), context }
        if (!definition) {
          const allow = Object.keys(handlers).filter((m) => m !== 'ANY')
          if (handlers.GET && !handlers.HEAD) allow.push('HEAD')
          c.header('Allow', allow.join(', '))
          return {
            response: c.json({ error: 'METHOD_NOT_ALLOWED' }, 405),
            context,
          }
        }
        let input: Record<string, unknown> | undefined
        try {
          if (definition.validate) {
            const validated = await validateInput(
              c,
              definition.validate,
              match.rawParams,
            )
            if (Object.keys(validated).length) input = validated
          }
        } catch (error) {
          if (error instanceof InputError)
            return { response: inputErrorResponse(c, error), context }
          throw error
        }
        const response = await definition.handler({
          request: c.req.raw,
          pathname,
          params: match.rawParams,
          ...(input === undefined ? {} : { input }),
          context,
          c,
        })
        if (!(response instanceof Response))
          throw new Error('API handlers must return a Response')
        return { response, context }
      }
      let called = false
      const result = await current.options.handler({
        request: c.req.raw,
        pathname,
        context,
        c,
        next: async (next = {}) => {
          if (called)
            throw new Error('Middleware next() may only be called once')
          called = true
          return dispatch(index + 1, mergeContext(context, next.context ?? {}))
        },
      })
      if (result instanceof Response) return { response: result, context }
      if (!result || !(result.response instanceof Response))
        throw new Error('Middleware must return next() or a Response')
      return result
    }
    return (await dispatch(0, mergeContext({}))).response
  })
  return app as unknown as Hono<AppEnv, ApiSchema<T, MiddlewareResponses<M>>>
}
