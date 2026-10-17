import { expectTypeOf } from 'vitest'
import { z } from 'zod'
import { hc } from 'hono/client'
import {
  createApp,
  createHandler,
  createRootRoute,
  createRoute,
} from '../src/index.js'

createHandler({
  handler: (context) => {
    expectTypeOf(context.params.id).toEqualTypeOf<string>()
    // @ts-expect-error no input is exposed without validators
    context.input
    return context.c.json({ ok: true })
  },
})

createRoute('/teams/$teamId')({
  handlers: ({ createHandlers, createHandler }) =>
    createHandlers({
      GET: {
        // @ts-expect-error a method handler cannot destructure input without validators
        handler: ({ c, input }) => c.json({ ok: true }),
      },
      POST: createHandler({
        validate: {},
        handler: (context) => {
          expectTypeOf(context.params.teamId).toEqualTypeOf<string>()
          // @ts-expect-error an empty validator object provides no input
          context.input
          return context.c.json({ ok: true })
        },
      }),
    }),
})

createHandler({
  validate: { query: undefined },
  handler: (context) => {
    // @ts-expect-error an undefined schema does not provide input
    context.input
    return context.c.json({ ok: true })
  },
})

createRoute('/teams/$teamId')({
  handlers: ({ createHandlers }) =>
    createHandlers({
      GET: {
        validate: { params: { teamId: z.string().transform(Number) } },
        handler: ({ c, params, input }) => {
          expectTypeOf(params.teamId).toEqualTypeOf<string>()
          expectTypeOf(input.params.teamId).toEqualTypeOf<number>()
          // @ts-expect-error only params was validated
          input.headers
          return c.json(input.params)
        },
      },
      POST: {
        validate: {
          headers: z.object({ 'x-api-version': z.string().transform(Number) }),
          query: undefined,
        },
        handler: ({ c, input }) => {
          expectTypeOf(input.headers['x-api-version']).toEqualTypeOf<number>()
          // @ts-expect-error an undefined schema creates no query input
          input.query
          return c.json(input.headers)
        },
      },
    }),
})

const pageSchema = z.object({ page: z.string().transform(Number) })
declare const optionalValidators: { query?: typeof pageSchema }
createHandler({
  validate: optionalValidators,
  handler: ({ c, input }) => {
    expectTypeOf(input).toEqualTypeOf<
      { query?: { page: number } } | undefined
    >()
    return c.json({ page: input?.query?.page })
  },
})

declare const maybePageSchema: typeof pageSchema | undefined
createHandler({
  validate: {
    headers: z.object({ 'x-api-version': z.string() }),
    query: maybePageSchema,
  },
  handler: ({ c, input }) => {
    expectTypeOf(input.headers['x-api-version']).toEqualTypeOf<string>()
    expectTypeOf(input.query).toEqualTypeOf<{ page: number } | undefined>()
    return c.json({
      version: input.headers['x-api-version'],
      page: input.query?.page,
    })
  },
})

const noValidationRoute = createRoute('/teams/$teamId')({
  handlers: ({ createHandlers }) =>
    createHandlers({
      GET: {
        validate: { query: undefined },
        handler: ({ c, params }) => c.json(params),
      },
    }),
})
const root = createRootRoute()
const app = createApp({
  routeTree: root._addFileChildren({ noValidationRoute }),
})
const client = hc<typeof app>('http://localhost')
client.teams[':teamId'].$get({ param: { teamId: '007' } })
