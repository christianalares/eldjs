import { hc } from 'hono/client'
import example from '../src/app.js'
const demo = hc<typeof example>('http://localhost')
demo.health.$get()
demo.teams[':teamId'].posts.$post({
  param: { teamId: 't' },
  // @ts-expect-error invalid JSON payload in generated-file client
  json: { title: 123 },
})

// Check the package declarations through the generated file-route registry.
import { createFileRoute, createHandler } from 'eldjs'
import { z } from 'zod'
const jsonHandler = createHandler({
  validate: { json: z.object({ title: z.string() }) },
  handler: ({ c, input }) => c.json(input.json),
})
createFileRoute('/health')({
  handlers: {
    // @ts-expect-error generated file routes reject JSON validation on GET
    GET: jsonHandler,
    POST: jsonHandler,
  },
})

createFileRoute('/teams/$teamId/posts')({
  handlers: ({ createHandlers }) => {
    createHandlers({
      GET: {
        validate: {
          // @ts-expect-error generated path parameters allow teamId, not hello
          params: z.object({ hello: z.string() }),
        },
        handler: ({ c }) => c.json({ ok: true }),
      },
      POST: {
        validate: {
          query: z.object({ page: z.string() }),
          // @ts-expect-error the package declarations reject unknown targets
          test: z.object({ value: z.string() }),
        },
        handler: ({ c }) => c.json({ ok: true }),
      },
    })
    return {}
  },
})

createFileRoute('/teams/$teamId/posts')({
  handlers: ({ createHandlers }) =>
    createHandlers({
      GET: {
        handler: (context) => {
          const teamId: string = context.params.teamId
          // @ts-expect-error the published declarations omit input without validators
          context.input
          return context.c.json({ teamId })
        },
      },
      POST: {
        validate: {
          headers: z.object({ 'x-api-version': z.string().transform(Number) }),
        },
        handler: ({ c, input }) => {
          const version: number = input.headers['x-api-version']
          return c.json({ version })
        },
      },
    }),
})

const wrongParams = createHandler({
  validate: { params: z.object({ hello: z.string() }) },
  handler: ({ c, input }) => c.json(input.params),
})
createFileRoute('/teams/$teamId/posts')({
  handlers: {
    // @ts-expect-error extracted handlers must match the generated path too
    GET: wrongParams,
  },
})

createFileRoute('/teams/$teamId/posts')({
  handlers: ({ createHandlers }) =>
    createHandlers({
      GET: {
        validate: { params: { teamId: z.string().transform(Number) } },
        handler: ({ c, input }) => {
          const id: number = input.params.teamId
          return c.json({ id })
        },
      },
    }),
})
