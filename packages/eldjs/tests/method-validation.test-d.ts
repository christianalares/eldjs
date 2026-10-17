import { expectTypeOf } from 'vitest'
import { z } from 'zod'
import { createHandler, createRootRoute, createRoute } from '../src/index.js'

const body = z.object({ title: z.string() })

createRoute('/items/$id')({
  handlers: ({ createHandlers }) =>
    createHandlers({
      GET: {
        validate: {
          // @ts-expect-error GET cannot validate a JSON request body
          json: body,
        },
        handler: ({ c }) => c.json({ ok: true }),
      },
      HEAD: {
        validate: {
          // @ts-expect-error HEAD cannot validate a form request body
          form: body,
        },
        handler: ({ c }) => c.body(null, 204),
      },
    }),
})

createRoute('/items/$id')({
  handlers: ({ createHandlers }) =>
    createHandlers({
      GET: {
        validate: {
          params: z.object({ id: z.string() }),
          query: z.object({ page: z.string().transform(Number) }),
          headers: z.object({ 'x-token': z.string() }),
        },
        handler: ({ c, input }) => {
          expectTypeOf(input.params.id).toEqualTypeOf<string>()
          expectTypeOf(input.query.page).toEqualTypeOf<number>()
          expectTypeOf(input.headers['x-token']).toEqualTypeOf<string>()
          // @ts-expect-error undeclared body input is unavailable
          input.json
          return c.json({ page: input.query.page })
        },
      },
      POST: {
        validate: { query: z.object({ page: z.string() }), json: body },
        handler: ({ c, input }) => {
          expectTypeOf(input.query.page).toEqualTypeOf<string>()
          expectTypeOf(input.json.title).toEqualTypeOf<string>()
          return c.json({ title: input.json.title }, 201)
        },
      },
    }),
})

const jsonHandler = createHandler({
  validate: { json: body },
  handler: ({ c, input }) => c.json(input.json),
})
const formHandler = createHandler({
  validate: { form: body },
  handler: ({ c, input }) => c.json(input.form),
})
const queryHandler = createHandler({
  validate: { query: z.object({ page: z.string() }) },
  handler: ({ c, input }) => c.json(input.query),
})

createRoute('/items')({
  handlers: {
    // @ts-expect-error an extracted JSON handler cannot be assigned to GET
    GET: jsonHandler,
    // @ts-expect-error an extracted form handler cannot be assigned to HEAD
    HEAD: formHandler,
    POST: jsonHandler,
    PUT: jsonHandler,
    PATCH: formHandler,
    DELETE: jsonHandler,
    OPTIONS: formHandler,
  },
})

createRoute('/items')({
  // @ts-expect-error returning an extracted handler from a factory must also check its method
  handlers: () => ({ GET: jsonHandler }),
})
createRootRoute({
  handlers: {
    // @ts-expect-error root handlers follow the same method restrictions
    GET: formHandler,
  },
})

createRoute('/items')({
  handlers: ({ createHandlers }) =>
    createHandlers({
      // @ts-expect-error method builders also reject extracted body handlers on GET
      GET: jsonHandler,
      // @ts-expect-error method builders also reject extracted body handlers on HEAD
      HEAD: formHandler,
    }),
})

createRoute('/items')({
  handlers: {
    GET: queryHandler,
    HEAD: queryHandler,
    ANY: queryHandler,
  },
})
createRoute('/items')({
  handlers: {
    // @ts-expect-error ANY must be valid for GET and HEAD too
    ANY: jsonHandler,
  },
})
createRoute('/items')({
  handlers: ({ createHandlers }) =>
    createHandlers({
      ANY: {
        validate: {
          // @ts-expect-error inline ANY cannot require a body
          form: body,
        },
        handler: ({ c }) => c.json({ ok: true }),
      },
    }),
})
