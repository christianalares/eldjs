import { expect, test } from 'vitest'
import { z } from 'zod'
import {
  createApp,
  createHandler,
  createRootRoute,
  createRoute,
  type Validators,
} from '../src/index.js'

test('a handler without validators receives raw parameters but no input property', async () => {
  const root = createRootRoute()
  const route = createRoute('/teams/$teamId')({
    handlers: {
      GET: (context) =>
        context.c.json({
          teamId: context.params.teamId,
          hasInput: Object.hasOwn(context, 'input'),
        }),
    },
  }).update({ path: '/teams/$teamId', getParentRoute: () => root })
  const app = createApp({ routeTree: root._addFileChildren({ route }) })
  const response = await app.request('/teams/007')
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ teamId: '007', hasInput: false })
})

test.each([{}, { query: undefined }] satisfies Validators[])(
  'empty validator configurations provide no input (%j)',
  async (validate) => {
    const root = createRootRoute()
    const handler = createHandler({
      validate,
      handler: (context) =>
        context.c.json({ hasInput: Object.hasOwn(context, 'input') }),
    })
    const route = createRoute('/items')({ handlers: { GET: handler } }).update({
      path: '/items',
      getParentRoute: () => root,
    })
    const app = createApp({ routeTree: root._addFileChildren({ route }) })
    const response = await app.request('/items')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ hasInput: false })
  },
)

test('params-only and headers-only validation expose transformed input alongside original request values', async () => {
  const root = createRootRoute()
  const route = createRoute('/teams/$teamId')({
    handlers: ({ createHandlers }) =>
      createHandlers({
        GET: {
          validate: {
            params: { teamId: z.string().regex(/^\d+$/).transform(Number) },
          },
          handler: ({ c, params, input }) =>
            c.json({ original: params.teamId, input }),
        },
        POST: {
          validate: {
            headers: z.object({
              'x-api-version': z.enum(['1', '2']).transform(Number),
            }),
            query: undefined,
          },
          handler: ({ c, request, input }) =>
            c.json({
              original: request.headers.get('x-api-version'),
              input,
            }),
        },
      }),
  }).update({ path: '/teams/$teamId', getParentRoute: () => root })
  const app = createApp({ routeTree: root._addFileChildren({ route }) })
  const paramsResponse = await app.request('/teams/007')
  expect(paramsResponse.status).toBe(200)
  expect(await paramsResponse.json()).toEqual({
    original: '007',
    input: { params: { teamId: 7 } },
  })
  const headersResponse = await app.request('/teams/007', {
    method: 'POST',
    headers: { 'X-API-Version': '2' },
  })
  expect(headersResponse.status).toBe(200)
  expect(await headersResponse.json()).toEqual({
    original: '2',
    input: { headers: { 'x-api-version': 2 } },
  })
})
