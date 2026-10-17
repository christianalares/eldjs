import { expectTypeOf } from 'vitest'
import { hc, type InferResponseType } from 'hono/client'
import { z } from 'zod'
import {
  createApp,
  createHandler,
  createRootRoute,
  createRoute,
} from '../src/index.js'

const route = createRoute('/teams/$teamId/posts')({
  handlers: ({ createHandlers }) =>
    createHandlers({
      GET: {
        validate: {
          params: { teamId: z.string().transform(Number) },
          query: z.object({ page: z.string() }),
        },
        handler: ({ c, input, params }) => {
          expectTypeOf(input.params.teamId).toEqualTypeOf<number>()
          expectTypeOf(params.teamId).toEqualTypeOf<string>()
          expectTypeOf(input.query.page).toEqualTypeOf<string>()
          // @ts-expect-error undeclared fields are not present in validated params
          input.params.missing
          return c.json({ teamId: input.params.teamId })
        },
      },
    }),
})
const root = createRootRoute()
const app = createApp({ routeTree: root._addFileChildren({ route }) })
const client = hc<typeof app>('http://localhost')
client.teams[':teamId'].posts.$get({
  param: { teamId: '42' },
  query: { page: '1' },
})
client.teams[':teamId'].posts.$get({
  // @ts-expect-error clients send schema input, not the transformed output
  param: { teamId: 42 },
  query: { page: '1' },
})
expectTypeOf<
  InferResponseType<(typeof client.teams)[':teamId']['posts']['$get'], 200>
>().toEqualTypeOf<{ teamId: number }>()

createRoute('/teams/$teamId/posts')({
  handlers: ({ createHandler }) => {
    createHandler({
      validate: {
        params: {
          // @ts-expect-error field names must match the path
          test: z.string().optional(),
        },
      },
      handler: ({ c }) => c.json({ ok: true }),
    })
    createHandler({
      validate: {
        // @ts-expect-error only params supports a field map
        query: { page: z.string() },
      },
      handler: ({ c }) => c.json({ ok: true }),
    })
    return {}
  },
})

const extracted = createHandler({
  validate: {
    params: {
      teamId: z.string().transform(Number),
      locale: z.string().optional(),
    },
  },
  handler: ({ c, input }) => {
    expectTypeOf(input.params).toEqualTypeOf<{
      teamId: number
      locale: string | undefined
    }>()
    return c.json(input.params)
  },
})
createRoute('/teams/$teamId/{-$locale}')({ handlers: { GET: extracted } })
createRoute('/teams/$teamId')({
  handlers: {
    // @ts-expect-error extracted field maps are checked when assigned to a route
    GET: extracted,
  },
})
