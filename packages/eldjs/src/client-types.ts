import type { Schema, ToSchema, TypedResponse } from 'hono/types'
import type {
  AnyMiddleware,
  Method,
  MiddlewareResponses,
  ValidatorInput,
  Validators,
} from './types.js'
import type { inputErrorResponse } from './validation.js'

type Intersect<U> = (U extends unknown ? (value: U) => void : never) extends (
  value: infer I,
) => void
  ? I
  : never
type Nodes<T, Inherited = never> = 0 extends 1 & T
  ? never
  : T extends { types: { children: infer C; middlewareResponse: infer R } }
    ? | { route: T; middlewareResponse: Inherited | R }
      | { [K in keyof C]: Nodes<C[K], Inherited | R> }[keyof C]
    : never
// Hono's client interpolates whole segments. Affixed parameters remain server-only.
type Segment<S extends string> = S extends `{-$${infer K}}`
  ? '' | `:${K}`
  : S extends `{$${infer K}}`
    ? `:${K extends '' ? '_splat' : K}`
    : S extends `${string}{${string}`
      ? never
      : S extends `$${infer K}`
        ? `:${K extends '' ? '_splat' : K}`
        : S
type Join<A extends string, B extends string> = A extends ''
  ? B
  : B extends ''
    ? A
    : `${A}/${B}`
type PathParts<P extends string> = P extends `${infer A}/${infer B}`
  ? Join<Segment<A>, PathParts<B>>
  : Segment<P>
type ClientPath<P extends string> = `/${PathParts<P>}`
type Validation<H> = [Extract<H, { validate?: Validators }>] extends [never]
  ? {}
  : NonNullable<Extract<H, { validate?: Validators }>['validate']>
type Input<V> = {
  [
    K in keyof V as [Exclude<V[K], undefined>] extends [never]
      ? never
      : K extends 'params'
        ? 'param'
        : K extends 'headers'
          ? 'header'
          : K
  ]: ValidatorInput<V[K]>
}
type Output<H> = H extends (...args: any[]) => infer R
  ? Awaited<R>
  : H extends { handler: (...args: any[]) => infer R }
    ? Awaited<R>
    : never
type TypedOutput<R> = R extends TypedResponse ? R : TypedResponse<unknown>
type ValidationOutput<H, V = Input<Validation<H>>> = keyof V extends never
  ? never
  : {
      [
        S in
          400 | (Extract<keyof V, 'json' | 'form'> extends never ? never : 415)
      ]: TypedResponse<
        ReturnType<typeof inputErrorResponse>['_data'],
        S,
        'json'
      >
    }[400 | (Extract<keyof V, 'json' | 'form'> extends never ? never : 415)]
type HandlerMiddlewareOutput<H> = H extends {
  middleware?: infer M extends readonly AnyMiddleware[]
}
  ? MiddlewareResponses<M>
  : never
type ResponseOutput<H, R> =
  TypedOutput<Output<H> | R | HandlerMiddlewareOutput<H>> | ValidationOutput<H>
type MethodOutput<M, H, R> = M extends 'HEAD'
  ? TypedResponse<never, ResponseOutput<H, R>['_status'], 'body'>
  : ResponseOutput<H, R>
type Methods<H> =
  | Exclude<keyof H, 'ANY'>
  | ('ANY' extends keyof H ? Exclude<Method, 'ANY'> : never)
  | ('GET' extends keyof H ? 'HEAD' : never)
type Handler<H, M> = M extends keyof H
  ? H[M]
  : M extends 'HEAD'
    ? 'GET' extends keyof H
      ? H['GET']
      : H[keyof H & 'ANY']
    : H[keyof H & 'ANY']
type NodeSchema<T> = T extends {
  route: { types: { fullPath: infer P extends string; handlers: infer H } }
  middlewareResponse: infer R
}
  ? {
      [M in Methods<H> & string]: ToSchema<
        Lowercase<M>,
        ClientPath<P>,
        Input<Validation<Handler<H, M>>>,
        MethodOutput<M, Handler<H, M>, R>
      >
    }[Methods<H> & string]
  : never
/** Project the generated API graph into Hono's RPC schema without a client runtime dependency. */
export type ApiSchema<T, MiddlewareResponse = never> =
  Intersect<NodeSchema<Nodes<T, MiddlewareResponse>>> extends infer S extends
    Schema
    ? S
    : {}
