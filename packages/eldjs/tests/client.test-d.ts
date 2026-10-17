import { hc, type InferResponseType } from 'hono/client'
import { expectTypeOf } from 'vitest'
import { createApp, createRootRoute, createRoute } from '../src/index.js'
import { typedRoute } from './types.test-d.js'

const root = createRootRoute()
const app = createApp({
  routeTree: root._addFileChildren({ users: typedRoute }),
})
const client = hc<typeof app>('http://localhost')
const endpoint = client.users[':id']
endpoint.$get({ param: { id: '1' }, query: { page: '2' } })
endpoint.$post({ param: { id: '1' }, json: { title: 'hello' } })
// @ts-expect-error schema input, not the transformed number
endpoint.$get({ param: { id: '1' }, query: { page: 2 } })
// @ts-expect-error JSON body required
endpoint.$post({ param: { id: '1' } })
// @ts-expect-error no PUT handler
endpoint.$put({ param: { id: '1' } })
expectTypeOf<InferResponseType<typeof endpoint.$get, 200>>().toEqualTypeOf<{
  id: string
  page: number
}>()
expectTypeOf<InferResponseType<typeof endpoint.$post, 201>>().toEqualTypeOf<{
  title: string
}>()

expectTypeOf<
  InferResponseType<typeof endpoint.$post, 400>['error']
>().toEqualTypeOf<'VALIDATION_ERROR'>()
expectTypeOf<
  InferResponseType<typeof endpoint.$post, 415>['issues'][number]['message']
>().toEqualTypeOf<string>()
expectTypeOf<
  InferResponseType<typeof endpoint.$get, 400>['error']
>().toEqualTypeOf<'VALIDATION_ERROR'>()
expectTypeOf<InferResponseType<typeof endpoint.$get, 415>>().toBeNever()

async function narrowValidationResponse() {
  const response = await endpoint.$post({
    param: { id: '1' },
    json: { title: 'hello' },
  })
  if (response.status === 400 || response.status === 415) {
    expectTypeOf(
      (await response.json()).error,
    ).toEqualTypeOf<'VALIDATION_ERROR'>()
  } else {
    expectTypeOf((await response.json()).title).toEqualTypeOf<string>()
  }
}

const health = createRoute('/health')({
  handlers: ({ createHandlers }) =>
    createHandlers({
      GET: {
        validate: { query: undefined },
        handler: ({ c }) => c.json({ ok: true }, 200),
      },
    }),
})
const healthApp = createApp({
  routeTree: createRootRoute()._addFileChildren({ health }),
})
const healthClient = hc<typeof healthApp>('http://localhost')
expectTypeOf<
  InferResponseType<typeof healthClient.health.$get, 400>
>().toBeNever()
