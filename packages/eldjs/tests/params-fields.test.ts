import { expect, test } from 'vitest'
import { z } from 'zod'
import * as v from 'valibot'
import type { StandardSchemaV1 } from '@standard-schema/spec'
import {
  createApp,
  createHandler,
  createRootRoute,
  createRoute,
} from '../src/index.js'

test('parameter fields validate independently with Standard Schema transforms and defaults', async () => {
  const root = createRootRoute()
  const route = createRoute('/teams/$teamId/{-$locale}')({
    handlers: ({ createHandlers }) =>
      createHandlers({
        GET: {
          validate: {
            params: {
              teamId: z
                .string()
                .regex(/^\d+$/)
                .transform(async (id) => Number(id)),
              locale: v.optional(v.string(), 'en'),
            },
          },
          handler: ({ c, params, input }) =>
            c.json({ raw: params.teamId, ...input.params }),
        },
      }),
  }).update({ path: '/teams/$teamId/{-$locale}', getParentRoute: () => root })
  const app = createApp({ routeTree: root._addFileChildren({ route }) })
  const response = await app.request('/teams/42')
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ raw: '42', teamId: 42, locale: 'en' })
})

test('parameter field failures return a validation error with the field name', async () => {
  const root = createRootRoute()
  const handler = createHandler({
    validate: { params: { teamId: z.string().regex(/^\d+$/, 'Digits only') } },
    handler: ({ c, input }) => c.json(input.params),
  })
  const route = createRoute('/teams/$teamId')({
    handlers: { GET: handler },
  }).update({ path: '/teams/$teamId', getParentRoute: () => root })
  const app = createApp({ routeTree: root._addFileChildren({ route }) })
  const response = await app.request('/teams/hello')
  expect(response.status).toBe(400)
  expect(await response.json()).toEqual({
    error: 'VALIDATION_ERROR',
    target: 'params',
    issues: [{ message: 'Digits only', path: ['teamId'] }],
  })
})

test('a failed Standard Schema field cannot reach the handler even with no issue details', async () => {
  const rejected: StandardSchemaV1<string> = {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: () => ({ issues: [] }),
    },
  }
  const root = createRootRoute()
  const route = createRoute('/teams/$teamId')({
    handlers: ({ createHandlers }) =>
      createHandlers({
        GET: {
          validate: { params: { teamId: rejected } },
          handler: ({ c }) => c.json({ shouldNotRun: true }),
        },
      }),
  }).update({ path: '/teams/$teamId', getParentRoute: () => root })
  const app = createApp({ routeTree: root._addFileChildren({ route }) })
  const response = await app.request('/teams/eld')
  expect(response.status).toBe(400)
  expect(await response.json()).toEqual({
    error: 'VALIDATION_ERROR',
    target: 'params',
    issues: [],
  })
})
