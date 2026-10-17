import type {
  AnyMiddleware,
  HandlerOptions,
  MaybePromise,
  ParamsValidation,
  ValidationTarget,
  Validators,
} from './types.js'

const handlerMarker: unique symbol = Symbol('eld.handler')
export interface DefinedHandler {
  readonly [handlerMarker]: true
}

/** Give the editor concrete targets without widening the inferred handler output. */
type HandlerDefinition<
  P extends string,
  C,
  V extends Validators,
  M extends readonly AnyMiddleware[],
  R extends MaybePromise<Response>,
  Targets extends ValidationTarget = ValidationTarget,
> = HandlerOptions<P, C, V, M, R> & {
  validate?: Omit<Pick<Validators, Targets>, 'params'> &
    Record<Exclude<keyof V, Targets>, never> &
    ParamsValidation<P, NoInfer<V>>
}

type BodylessTarget = 'params' | 'query' | 'headers'

/** Route-bound variant of createHandler, carrying the file path and inherited context. */
export interface CreateHandler<P extends string, C> {
  <
    const V extends Validators = {},
    const M extends readonly AnyMiddleware[] = [],
    R extends MaybePromise<Response> = MaybePromise<Response>,
  >(
    options: HandlerDefinition<P, C, V, M, R>,
  ): HandlerOptions<P, C, V, M, R> & DefinedHandler
}

/** Define a handler independently of its route file. Schemas and dependencies travel with it. */
export function createHandler<
  const V extends Validators = {},
  const M extends readonly AnyMiddleware[] = [],
  R extends MaybePromise<Response> = MaybePromise<Response>,
>(
  options: HandlerDefinition<string, {}, V, M, R>,
): HandlerOptions<string, {}, V, M, R> & DefinedHandler {
  return { ...options, [handlerMarker]: true }
}

import type { HandlerContext } from './types.js'

/** Like Start's method builder, this provides each method its own inference scope. */
export interface CreateHandlers<P extends string, C> {
  <
    K extends import('./types.js').Method,
    VGET extends Pick<Validators, BodylessTarget> = {},
    const MGET extends readonly AnyMiddleware[] = [],
    RGET extends MaybePromise<Response> = MaybePromise<Response>,
    VPOST extends Validators = {},
    const MPOST extends readonly AnyMiddleware[] = [],
    RPOST extends MaybePromise<Response> = MaybePromise<Response>,
    VPUT extends Validators = {},
    const MPUT extends readonly AnyMiddleware[] = [],
    RPUT extends MaybePromise<Response> = MaybePromise<Response>,
    VPATCH extends Validators = {},
    const MPATCH extends readonly AnyMiddleware[] = [],
    RPATCH extends MaybePromise<Response> = MaybePromise<Response>,
    VDELETE extends Validators = {},
    const MDELETE extends readonly AnyMiddleware[] = [],
    RDELETE extends MaybePromise<Response> = MaybePromise<Response>,
    VOPTIONS extends Validators = {},
    const MOPTIONS extends readonly AnyMiddleware[] = [],
    ROPTIONS extends MaybePromise<Response> = MaybePromise<Response>,
    VHEAD extends Pick<Validators, BodylessTarget> = {},
    const MHEAD extends readonly AnyMiddleware[] = [],
    RHEAD extends MaybePromise<Response> = MaybePromise<Response>,
    VANY extends Pick<Validators, BodylessTarget> = {},
    const MANY extends readonly AnyMiddleware[] = [],
    RANY extends MaybePromise<Response> = MaybePromise<Response>,
  >(
    handlers: {
      GET?:
        | HandlerDefinition<P, C, VGET, MGET, RGET, BodylessTarget>
        | ((options: HandlerContext<P, C, {}>) => RGET)
      POST?:
        | HandlerDefinition<P, C, VPOST, MPOST, RPOST>
        | ((options: HandlerContext<P, C, {}>) => RPOST)
      PUT?:
        | HandlerDefinition<P, C, VPUT, MPUT, RPUT>
        | ((options: HandlerContext<P, C, {}>) => RPUT)
      PATCH?:
        | HandlerDefinition<P, C, VPATCH, MPATCH, RPATCH>
        | ((options: HandlerContext<P, C, {}>) => RPATCH)
      DELETE?:
        | HandlerDefinition<P, C, VDELETE, MDELETE, RDELETE>
        | ((options: HandlerContext<P, C, {}>) => RDELETE)
      OPTIONS?:
        | HandlerDefinition<P, C, VOPTIONS, MOPTIONS, ROPTIONS>
        | ((options: HandlerContext<P, C, {}>) => ROPTIONS)
      HEAD?:
        | HandlerDefinition<P, C, VHEAD, MHEAD, RHEAD, BodylessTarget>
        | ((options: HandlerContext<P, C, {}>) => RHEAD)
      ANY?:
        | HandlerDefinition<P, C, VANY, MANY, RANY, BodylessTarget>
        | ((options: HandlerContext<P, C, {}>) => RANY)
    } & Record<K, unknown>,
  ): Pick<
    {
      GET:
        | HandlerOptions<P, C, VGET, MGET, RGET>
        | ((options: HandlerContext<P, C, {}>) => RGET)
      POST:
        | HandlerOptions<P, C, VPOST, MPOST, RPOST>
        | ((options: HandlerContext<P, C, {}>) => RPOST)
      PUT:
        | HandlerOptions<P, C, VPUT, MPUT, RPUT>
        | ((options: HandlerContext<P, C, {}>) => RPUT)
      PATCH:
        | HandlerOptions<P, C, VPATCH, MPATCH, RPATCH>
        | ((options: HandlerContext<P, C, {}>) => RPATCH)
      DELETE:
        | HandlerOptions<P, C, VDELETE, MDELETE, RDELETE>
        | ((options: HandlerContext<P, C, {}>) => RDELETE)
      OPTIONS:
        | HandlerOptions<P, C, VOPTIONS, MOPTIONS, ROPTIONS>
        | ((options: HandlerContext<P, C, {}>) => ROPTIONS)
      HEAD:
        | HandlerOptions<P, C, VHEAD, MHEAD, RHEAD>
        | ((options: HandlerContext<P, C, {}>) => RHEAD)
      ANY:
        | HandlerOptions<P, C, VANY, MANY, RANY>
        | ((options: HandlerContext<P, C, {}>) => RANY)
    },
    K
  >
}
