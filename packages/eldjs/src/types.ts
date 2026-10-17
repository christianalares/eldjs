import type { Context, Env } from 'hono'
import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { Register } from './route.js'

export type AppEnv = Register extends { env: infer E extends Env } ? E : {}
export type Method =
  'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD' | 'ANY'
export type MaybePromise<T> = T | Promise<T>
export type Simplify<T> = { [K in keyof T]: T[K] } & {}
export type Assign<A, B> = Simplify<Omit<A, keyof B> & B>
export type ValidationTarget = 'params' | 'query' | 'json' | 'form' | 'headers'
export type ParamValidators = Record<string, StandardSchemaV1>
export interface Validators {
  /** A field map or object schema for decoded path parameters such as $teamId. */
  params?: StandardSchemaV1 | ParamValidators
  /** URL query string values; repeated keys are arrays of strings. */
  query?: StandardSchemaV1
  /** Parsed JSON request body. Not available on GET, HEAD, or ANY. */
  json?: StandardSchemaV1
  /** URL-encoded or multipart fields. Not available on GET, HEAD, or ANY. */
  form?: StandardSchemaV1
  /** Request headers, with lowercase names and string values. */
  headers?: StandardSchemaV1
}
/** GET and HEAD have no request body; ANY must also be valid for those methods. */
export type ValidatorsFor<M extends Method> = Validators &
  (M extends 'GET' | 'HEAD' | 'ANY' ? { json?: never; form?: never } : {})
export type ValidatorOutput<S> = S extends StandardSchemaV1
  ? StandardSchemaV1.InferOutput<S>
  : S extends ParamValidators
    ? { -readonly [K in keyof S]: StandardSchemaV1.InferOutput<S[K]> }
    : never
export type ValidatorInput<S> = S extends StandardSchemaV1
  ? StandardSchemaV1.InferInput<S>
  : S extends ParamValidators
    ? Simplify<
        {
          [
            K in keyof S as undefined extends StandardSchemaV1.InferInput<S[K]>
              ? never
              : K
          ]: StandardSchemaV1.InferInput<S[K]>
        } & {
          [
            K in keyof S as undefined extends StandardSchemaV1.InferInput<S[K]>
              ? K
              : never
          ]?: StandardSchemaV1.InferInput<S[K]>
        }
      >
    : never
type RequiredValidatorKeys<V> = {
  [K in keyof V]-?: undefined extends V[K] ? never : K
}[keyof V]
export type Validated<V extends Validators> = Simplify<
  {
    [K in keyof V as undefined extends V[K] ? never : K]: ValidatorOutput<V[K]>
  } & {
    [
      K in keyof V as [Exclude<V[K], undefined>] extends [never]
        ? never
        : undefined extends V[K]
          ? K
          : never
    ]?: ValidatorOutput<V[K]>
  }
>
type SegmentParams<S extends string> =
  S extends `${string}{-$${infer K}}${string}`
    ? { [P in K]?: string }
    : S extends `${string}{$${infer K}}${string}`
      ? K extends ''
        ? { _splat: string }
        : { [P in K]: string }
      : S extends `$${infer K}`
        ? K extends ''
          ? { _splat: string }
          : { [P in K]: string }
        : {}
export type Params<P extends string> = string extends P
  ? Record<string, string>
  : P extends `${infer Head}/${infer Tail}`
    ? Simplify<SegmentParams<Head> & Params<Tail>>
    : SegmentParams<P>

// Ignore index signatures, retaining explicitly declared keys even on open objects.
type DeclaredKeys<T> = T extends unknown
  ? keyof {
      [
        K in keyof T as string extends K
          ? never
          : number extends K
            ? never
            : symbol extends K
              ? never
              : K
      ]: unknown
    }
  : never
type SchemaParamKeys<S> = S extends StandardSchemaV1
  ? DeclaredKeys<StandardSchemaV1.InferInput<S>>
  : S extends ParamValidators
    ? DeclaredKeys<S>
    : never
declare const validatedParamKeys: unique symbol
/** Carry schema input keys through extracted handlers without widening inference. */
interface ParamConstraint<Keys extends PropertyKey> {
  readonly [validatedParamKeys]?: Keys
}
type ParamError<P extends string, K extends PropertyKey> = [
  keyof Params<P>,
] extends [never]
  ? `Unknown path parameter ${K & string}. This route has no path parameters.`
  : `Unknown path parameter ${K & string}. Expected ${keyof Params<P> & string}.`
type ParamsSchemaFor<P extends string, S> = {
  [K in Exclude<SchemaParamKeys<S>, keyof Params<P>> as ParamError<P, K>]: never
}
/** Check schema input names against the path; schema output may be transformed. */
type ParamsDefinition<P extends string, S> = S extends StandardSchemaV1
  ? ParamsSchemaFor<P, S>
  : Partial<Record<keyof Params<P>, StandardSchemaV1>> & {
      [K in Exclude<SchemaParamKeys<S>, keyof Params<P>>]: ParamError<P, K>
    }
export type ParamsValidation<P extends string, V extends Validators> = {
  params?: ParamsDefinition<P, V['params']>
}

export interface RequestContext<C = {}> {
  request: Request
  pathname: string
  context: C
  c: Context<AppEnv>
}
type ValidatedInput<V extends Validators> = {
  /** Validated and transformed inputs. Only configured targets are present. */
  input: Validated<V>
}
type HandlerInput<V extends Validators> = V extends unknown
  ? keyof Validated<V> extends never
    ? {}
    : RequiredValidatorKeys<V> extends never
      ? Partial<ValidatedInput<V>>
      : ValidatedInput<V>
  : never
export type HandlerContext<
  P extends string,
  C,
  V extends Validators,
> = RequestContext<C> & {
  /** Decoded URL parameters, before schema transformations. */
  params: Params<P>
} & HandlerInput<V>
export interface MiddlewareResult<C = {}> {
  response: Response
  context: C
}
export interface MiddlewareContext<C = {}> extends RequestContext<C> {
  next: <Added extends object = {}>(options?: {
    context?: Added
  }) => Promise<MiddlewareResult<Assign<C, Added>>>
}
export interface Middleware<C = {}, R extends Response = Response> {
  readonly '~context'?: C
  readonly '~response'?: R
  readonly options: {
    middleware: readonly AnyMiddleware[]
    server: (
      options: MiddlewareContext<any>,
    ) => MaybePromise<Response | MiddlewareResult<any>>
  }
}
export type AnyMiddleware = Middleware<any, any>
export type MiddlewareResponses<M extends readonly AnyMiddleware[]> = [
  M[number],
] extends [never]
  ? never
  : M[number] extends Middleware<any, infer R>
    ? R
    : never
export type MiddlewareContextOf<M> = M extends Middleware<infer C> ? C : {}
export type MiddlewareContexts<
  M extends readonly AnyMiddleware[],
  C = {},
> = M extends readonly [
  infer First,
  ...infer Rest extends readonly AnyMiddleware[],
]
  ? MiddlewareContexts<Rest, Assign<C, MiddlewareContextOf<First>>>
  : C
export interface HandlerOptions<
  P extends string,
  C,
  V extends Validators,
  M extends readonly AnyMiddleware[],
  R extends MaybePromise<Response>,
> extends ParamConstraint<SchemaParamKeys<V['params']>> {
  validate?: V
  middleware?: M
  handler: (
    options: HandlerContext<P, Assign<C, MiddlewareContexts<M>>, V>,
  ) => R
}
/** Runtime-erased handler shape; public helpers carry the concrete generic types. */
export interface AnyHandlerOptions<
  M extends Method = Method,
  Keys extends PropertyKey = PropertyKey,
> extends ParamConstraint<Keys> {
  validate?: ValidatorsFor<M>
  middleware?: readonly AnyMiddleware[]
  handler: (options: any) => MaybePromise<Response>
}
export type AnyHandler<
  M extends Method = Method,
  Keys extends PropertyKey = PropertyKey,
> = AnyHandlerOptions<M, Keys> | ((options: any) => MaybePromise<Response>)
export type HandlerRecord<Keys extends PropertyKey = PropertyKey> = {
  [M in Method]?: AnyHandler<M, Keys>
}
