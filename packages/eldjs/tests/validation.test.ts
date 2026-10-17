import { expect, test } from 'vitest'
import { z } from 'zod'
import * as v from 'valibot'
import {
  createApp,
  createHandler,
  createRootRoute,
  createRoute,
} from '../src/index.js'

function endpoint<
  H extends import('../src/types.js').AnyHandlerOptions<'POST', 'id'> &
    import('../src/handler.js').DefinedHandler,
>(handler: H) {
  const root = createRootRoute()
  const route = createRoute('/items/$id')({
    handlers: { POST: handler },
  }).update({ path: '/items/$id', getParentRoute: () => root })
  return createApp({ routeTree: root._addFileChildren({ route }) })
}

test('Valibot and Zod validate multiple targets with their transformed output', async () => {
  const handler = createHandler({
    validate: {
      params: v.object({ id: v.pipe(v.string(), v.transform(Number)) }),
      query: v.object({ tag: v.array(v.string()) }),
      headers: z.object({ 'x-token': z.literal('secret') }),
      json: z.object({ count: z.number().positive() }),
    },
    handler: ({ c, input, params }) => c.json({ ...input, raw: params.id }),
  })
  const app = endpoint(handler)
  const response = await app.request('/items/42?tag=a&tag=b', {
    method: 'POST',
    headers: {
      'content-type': 'application/problem+json',
      'x-token': 'secret',
    },
    body: '{"count":2}',
  })
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({
    params: { id: 42 },
    raw: '42',
    query: { tag: ['a', 'b'] },
    headers: { 'x-token': 'secret' },
    json: { count: 2 },
  })
})

test.each([
  ['text/plain', '{"title":"ok"}', 415],
  ['application/json', '{', 400],
  ['application/json', '{"title":4}', 400],
])(
  'invalid JSON input returns a structured error (%s, %s)',
  async (contentType, body, status) => {
    const app = endpoint(
      createHandler({
        validate: { json: z.object({ title: z.string() }) },
        handler: ({ c }) => c.json({ shouldNotRun: true }),
      }),
    )
    const response = await app.request('/items/a', {
      method: 'POST',
      headers: { 'content-type': contentType },
      body,
    })
    expect(response.status).toBe(status)
    expect(await response.json()).toMatchObject({
      error: 'VALIDATION_ERROR',
      target: 'json',
      issues: [{ message: expect.any(String) }],
    })
  },
)

test('form input preserves repeated fields and uploaded files', async () => {
  const app = endpoint(
    createHandler({
      validate: {
        form: z.object({ tag: z.array(z.string()), file: z.instanceof(File) }),
      },
      handler: ({ c, input }) =>
        c.json({ tags: input.form.tag, file: input.form.file.name }),
    }),
  )
  const body = new FormData()
  body.append('tag', 'a')
  body.append('tag', 'b')
  body.append('file', new File(['hello'], 'hello.txt'))
  const response = await app.request('/items/a', { method: 'POST', body })
  expect(await response.json()).toEqual({ tags: ['a', 'b'], file: 'hello.txt' })
})
