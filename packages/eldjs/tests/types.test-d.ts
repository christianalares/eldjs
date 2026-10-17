import { expectTypeOf } from 'vitest'
import { z } from 'zod'
import { createHandler, createMiddleware, createRoute } from '../src/index.js'

const auth = createMiddleware().server(({ next }) =>
  next({ context: { user: { id: 'u1' } } }),
)
const extracted = createHandler({
  middleware: [auth],
  validate: { json: z.object({ title: z.string() }) },
  handler: ({ input, context, c }) => {
    expectTypeOf(input.json.title).toEqualTypeOf<string>()
    expectTypeOf(context.user.id).toEqualTypeOf<string>()
    // @ts-expect-error no undeclared target
    input.query
    // @ts-expect-error no unvalidated property
    input.json.missing
    return c.json({ title: input.json.title }, 201)
  },
})

export const typedRoute = createRoute('/users/$id')({
  middleware: [auth],
  handlers: ({ createHandlers }) =>
    createHandlers({
      GET: {
        validate: { query: z.object({ page: z.string().transform(Number) }) },
        handler: ({ input, context, params, c }) => {
          expectTypeOf(input.query.page).toEqualTypeOf<number>()
          expectTypeOf(context.user.id).toEqualTypeOf<string>()
          expectTypeOf(params).toEqualTypeOf<{ id: string }>()
          // @ts-expect-error no undeclared parameter
          params.missing
          return c.json({ id: params.id, page: input.query.page }, 200)
        },
      },
      POST: extracted,
    }),
})

const locale = createMiddleware().server(({ next }) =>
  next({ context: { locale: 'en' as const } }),
)
createRoute('/articles/$slug')({
  middleware: [auth],
  handlers: ({ createHandlers, createHandler }) =>
    createHandlers({
      GET: {
        middleware: [locale],
        handler: ({ context, c }) => {
          expectTypeOf(context.locale).toEqualTypeOf<'en'>()
          expectTypeOf(context.user.id).toEqualTypeOf<string>()
          return c.json({ ok: true })
        },
      },
      DELETE: createHandler({
        handler: ({ context, params, c }) => {
          expectTypeOf(context.user.id).toEqualTypeOf<string>()
          expectTypeOf(params.slug).toEqualTypeOf<string>()
          return c.json({ deleted: true })
        },
      }),
    }),
})
