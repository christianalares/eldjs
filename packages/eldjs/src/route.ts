import type {
  AnyMiddleware,
  Assign,
  HandlerContext,
  HandlerRecord,
  Method,
  MiddlewareContexts,
  MiddlewareResponses,
  Params,
  ValidationTarget,
} from './types.js'
import { createHandler } from './handler.js'
import type {
  CreateHandler,
  CreateHandlers,
  DefinedHandler,
} from './handler.js'

/** Augment to supply application-wide Hono bindings. */
export interface Register {}
/** Populated by routeTree.gen.ts. */
export interface FileRoutesByPath {}
export type { AppEnv, Method } from './types.js'
export type AnyRoute = ApiRoute<any, any, any, any, any>
type RouteContext<T> = T extends ApiRoute<any, infer C, any, any, any> ? C : {}
type ContextualHandlers<P extends string, C> = Partial<
  Record<
    Method,
    | DefinedHandler
    | ((options: HandlerContext<P, C, {}>) => Response | Promise<Response>)
  >
>
export interface RuntimeRouteOptions {
  caseSensitive?: boolean
  middleware?: readonly AnyMiddleware[]
  handlers?: HandlerRecord
}

const validationTargets: Record<ValidationTarget, true> = {
  params: true,
  query: true,
  headers: true,
  json: true,
  form: true,
}

/** Lightweight route graph compatible with the adapted TanStack generator. */
export class ApiRoute<
  P extends string = string,
  C = {},
  H = {},
  Children = {},
  MiddlewareResponse extends Response = never,
> {
  declare readonly types: {
    fullPath: P
    context: C
    handlers: H
    children: Children
    middlewareResponse: MiddlewareResponse
  }
  id: string
  path?: string
  fullPath = '/'
  parentRoute?: AnyRoute
  children: AnyRoute[] = []
  isRoot: boolean
  constructor(
    id: string,
    public options: RuntimeRouteOptions = {},
    root = false,
  ) {
    this.id = id
    this.isRoot = root
    // Check at definition time too, so JavaScript callers get the same contract.
    for (const [method, handler] of Object.entries(options.handlers ?? {})) {
      if (!handler || typeof handler === 'function') continue
      for (const target of Object.keys(handler.validate ?? {})) {
        if (!Object.hasOwn(validationTargets, target)) {
          throw new Error(
            `${method} handler on route "${id}" has unknown validation target "${target}". Use params, query, headers, json, or form.`,
          )
        }
      }
      if (method !== 'GET' && method !== 'HEAD' && method !== 'ANY') continue
      for (const target of ['json', 'form'] as const) {
        if (handler?.validate?.[target] !== undefined) {
          throw new Error(
            `${method} handler on route "${id}" cannot validate ${target}. Use POST, PUT, PATCH, DELETE, or OPTIONS instead.`,
          )
        }
      }
    }
  }
  update(options: {
    id?: string
    path?: string
    getParentRoute?: () => AnyRoute
  }) {
    this.path = options.path
    this.parentRoute = options.getParentRoute?.()
    return this
  }
  init(_index: number) {
    this.fullPath = this.isRoot
      ? '/'
      : this.path === undefined
        ? (this.parentRoute?.fullPath ?? '/')
        : `${this.parentRoute?.fullPath ?? '/'}/${this.path}`.replace(
            /\/{2,}/g,
            '/',
          )
  }
  _addFileChildren<T extends { [K in keyof T]: AnyRoute }>(
    children: T,
  ): ApiRoute<P, C, H, T, MiddlewareResponse> {
    this.children = Object.values(children) as AnyRoute[]
    return this as unknown as ApiRoute<P, C, H, T, MiddlewareResponse>
  }
  _addFileTypes<T>() {
    return this
  }
}

function routeFactory<P extends string, ParentContext>(
  id: string,
  root = false,
) {
  return <
    const M extends readonly AnyMiddleware[] = [],
    const H extends HandlerRecord<keyof Params<P>> = {},
  >(
    options: {
      middleware?: M
      caseSensitive?: boolean
      handlers?:
        | (H &
            ContextualHandlers<P, Assign<ParentContext, MiddlewareContexts<M>>>)
        | ((helpers: {
            createHandlers: CreateHandlers<
              P,
              Assign<ParentContext, MiddlewareContexts<M>>
            >
            createHandler: CreateHandler<
              P,
              Assign<ParentContext, MiddlewareContexts<M>>
            >
          }) => H)
    } = {},
  ): ApiRoute<
    P,
    Assign<ParentContext, MiddlewareContexts<M>>,
    H,
    {},
    MiddlewareResponses<M>
  > => {
    const handlers =
      typeof options.handlers === 'function'
        ? options.handlers({
            createHandlers: ((value: unknown) => value) as CreateHandlers<
              P,
              Assign<ParentContext, MiddlewareContexts<M>>
            >,
            createHandler: createHandler as unknown as CreateHandler<
              P,
              Assign<ParentContext, MiddlewareContexts<M>>
            >,
          })
        : options.handlers
    return new ApiRoute(id, { ...options, handlers }, root)
  }
}
/** Programmatic route definition. Generated file routes supply parent types automatically. */
export function createRoute<const P extends string>(path: P) {
  return routeFactory<P, {}>(path)
}
export const createRootRoute = routeFactory<'/', {}>('__root__', true)
export function createFileRoute<P extends keyof FileRoutesByPath & string>(
  id: P,
) {
  type Info = FileRoutesByPath[P]
  type Path = Info extends { fullPath: infer F extends string } ? F : P
  type Parent = Info extends { parentRoute: infer R } ? RouteContext<R> : {}
  return routeFactory<Path, Parent>(id)
}
