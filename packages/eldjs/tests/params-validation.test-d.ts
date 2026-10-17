import { expectTypeOf } from 'vitest'
import { z } from 'zod'
import * as v from 'valibot'
import { createHandler, createRootRoute, createRoute } from '../src/index.js'

createRoute('/teams/$teamId/posts')({
  handlers: ({ createHandlers }) => {
    createHandlers({
      GET: {
        validate: {
          // @ts-expect-error the route supplies teamId, not hello
          params: z.object({ hello: z.string() }),
        },
        handler: ({ c }) => c.json({ ok: true }),
      },
      POST: {
        validate: {
          // @ts-expect-error adding a valid key must not hide an invalid one
          params: z.object({ teamId: z.string(), hello: z.string() }),
        },
        handler: ({ c }) => c.json({ ok: true }),
      },
    })
    return {}
  },
})

const extracted = createHandler({
  validate: { params: z.object({ hello: z.string() }) },
  handler: ({ c, input }) => c.json(input.params),
})

createRoute('/teams/$teamId/posts')({
  handlers: {
    // @ts-expect-error an extracted handler's parameters must exist on its route
    GET: extracted,
  },
})
createRoute('/teams/$teamId/posts')({
  // @ts-expect-error returning a handler from a callback must also check its parameters
  handlers: () => ({ GET: extracted }),
})
createRoute('/teams/$teamId/posts')({
  handlers: ({ createHandlers }) => {
    createHandlers({
      // @ts-expect-error the method builder checks extracted handlers too
      GET: extracted,
    })
    return {}
  },
})
createRoute('/teams/$teamId/posts')({
  handlers: ({ createHandler }) => {
    createHandler({
      validate: {
        // @ts-expect-error the route-bound helper knows the parameter names
        params: z.object({ hello: z.string() }),
      },
      handler: ({ c }) => c.json({ ok: true }),
    })
    return {}
  },
})
createRootRoute({
  handlers: {
    // @ts-expect-error the root route has no path parameters
    GET: extracted,
  },
})
createRoute('/hello/$hello')({ handlers: { GET: extracted } })

createRoute('/teams/$teamId/posts')({
  handlers: ({ createHandler }) => {
    createHandler({
      validate: {
        // @ts-expect-error passthrough schemas still declare the wrong parameter
        params: z.looseObject({
          teamId: z.string(),
          hello: z.string().optional(),
        }),
      },
      handler: ({ c }) => c.json({ ok: true }),
    })
    createHandler({
      validate: {
        // @ts-expect-error check every branch of a union, not just their shared keys
        params: z.union([
          z.object({ teamId: z.string() }),
          z.object({ hello: z.string() }),
        ]),
      },
      handler: ({ c }) => c.json({ ok: true }),
    })
    createHandler({
      validate: {
        // @ts-expect-error this uses Standard Schema input types, not Zod internals
        params: v.object({ hello: v.string() }),
      },
      handler: ({ c }) => c.json({ ok: true }),
    })
    return {}
  },
})

createRoute('/teams/$teamId/{-$locale}/$')({
  handlers: ({ createHandlers }) =>
    createHandlers({
      GET: {
        validate: {
          params: v.object({
            teamId: v.pipe(v.string(), v.transform(Number)),
            locale: v.optional(v.string()),
            _splat: v.string(),
          }),
        },
        handler: ({ c, input }) => {
          expectTypeOf(input.params.teamId).toEqualTypeOf<number>()
          expectTypeOf(input.params.locale).toEqualTypeOf<string | undefined>()
          expectTypeOf(input.params._splat).toEqualTypeOf<string>()
          return c.json(input.params)
        },
      },
    }),
})

createRoute('/teams/$teamId/posts')({
  handlers: ({ createHandlers }) =>
    createHandlers({
      GET: {
        validate: {
          params: z
            .object({ teamId: z.string() })
            .transform(({ teamId }) => ({ id: Number(teamId) })),
        },
        handler: ({ c, params, input }) => {
          expectTypeOf(params).toEqualTypeOf<{ teamId: string }>()
          expectTypeOf(input.params).toEqualTypeOf<{ id: number }>()
          return c.json(input.params)
        },
      },
    }),
})
