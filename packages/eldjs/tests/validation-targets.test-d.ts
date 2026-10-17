import { createHandler, createRoute } from '../src/index.js'
import { z } from 'zod'

createRoute('/items')({
  handlers: ({ createHandlers }) =>
    createHandlers({
      POST: {
        validate: {
          query: z.object({ page: z.string().transform(Number) }),
          // @ts-expect-error only supported request targets can be validated
          test: z.object({ value: z.string() }),
        },
        handler: ({ c }) => c.json({ ok: true }),
      },
    }),
})

createHandler({
  validate: {
    query: z.object({ page: z.string() }),
    // @ts-expect-error extracted handlers reject unsupported targets too
    test: z.object({ value: z.string() }),
  },
  handler: ({ c }) => c.json({ ok: true }),
})

const sharedValidators = {
  query: z.object({ page: z.string() }),
  test: z.object({ value: z.string() }),
}
createHandler({
  // @ts-expect-error validation targets are checked for variables, not only object literals
  validate: sharedValidators,
  handler: ({ c }) => c.json({ ok: true }),
})

createHandler({
  validate: {
    // @ts-expect-error each target requires a Standard Schema implementation
    query: { page: 'string' },
  },
  handler: ({ c }) => c.json({ ok: true }),
})
