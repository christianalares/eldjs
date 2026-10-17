import { expect, test } from 'vitest'
import { z } from 'zod'
import {
  createApp,
  createHandler,
  createRootRoute,
  createRoute,
  type Validators,
} from '../src/index.js'

test('unknown validation targets are rejected when a route is defined from JavaScript', () => {
  expect(() =>
    createRoute('/items')({
      handlers: {
        POST: createHandler({
          validate: {
            query: z.object({ page: z.string() }),
            test: z.object({ value: z.string() }),
          } as any,
          handler: ({ c }) => c.json({ ok: true }),
        }),
      },
    }),
  ).toThrow(
    'POST handler on route "/items" has unknown validation target "test"',
  )
})

test.each([
  ['GET', 'json'],
  ['GET', 'form'],
  ['HEAD', 'json'],
  ['HEAD', 'form'],
  ['ANY', 'json'],
  ['ANY', 'form'],
] as const)(
  '%s rejects %s validation when a route is defined from JavaScript',
  (method, target) => {
    const validate: Validators = { [target]: z.object({ title: z.string() }) }
    const handler = createHandler({
      validate,
      handler: ({ c }) => c.json({ ok: true }),
    })
    expect(() =>
      createRoute('/items')({
        // Simulate JavaScript or an untyped configuration that bypasses TypeScript.
        handlers: { [method]: handler } as any,
      }),
    ).toThrow(`${method} handler on route "/items" cannot validate ${target}`)
  },
)

test('GET and HEAD validate URL input while POST validates query and JSON independently', async () => {
  const root = createRootRoute()
  const route = createRoute('/items/$id')({
    handlers: ({ createHandlers }) =>
      createHandlers({
        GET: {
          validate: {
            params: z.object({ id: z.string() }),
            query: z.object({ page: z.string().transform(Number) }),
            headers: z.object({ 'x-token': z.literal('demo') }),
          },
          handler: ({ c, input }) => {
            c.header('x-page', String(input.query.page))
            return c.json({ id: input.params.id, page: input.query.page })
          },
        },
        POST: {
          validate: {
            query: z.object({
              notify: z
                .enum(['true', 'false'])
                .transform((value) => value === 'true'),
            }),
            json: z.object({ title: z.string().trim().min(1) }),
          },
          handler: ({ c, input }) =>
            c.json(
              { title: input.json.title, notify: input.query.notify },
              201,
            ),
        },
      }),
  }).update({ path: '/items/$id', getParentRoute: () => root })
  const app = createApp({ routeTree: root._addFileChildren({ route }) })
  const get = await app.request('/items/one?page=2', {
    headers: { 'x-token': 'demo' },
  })
  expect(await get.json()).toEqual({ id: 'one', page: 2 })
  const head = await app.request('/items/one?page=3', {
    method: 'HEAD',
    headers: { 'x-token': 'demo' },
  })
  expect(head.status).toBe(200)
  expect(head.headers.get('x-page')).toBe('3')
  expect(await head.text()).toBe('')
  const post = await app.request('/items/one?notify=true', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: ' Hello ' }),
  })
  expect(post.status).toBe(201)
  expect(await post.json()).toEqual({ title: 'Hello', notify: true })
})
