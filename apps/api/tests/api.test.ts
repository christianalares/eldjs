import { expect, test } from 'vitest'
import { hc } from 'hono/client'
import app from '../src/app.js'

test('the generated graph serves typed Hono client requests end to end', async () => {
  const client = hc<typeof app>('http://localhost', {
    fetch: (input: RequestInfo | URL, init?: RequestInit) =>
      app.request(input, init),
  })
  const endpoint = client.teams[':teamId'].posts
  const response = await endpoint.$get(
    { param: { teamId: 'eld' }, query: { page: '2' } },
    { headers: { authorization: 'Bearer demo' } },
  )
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({
    teamId: 'eld',
    page: 2,
    viewerId: 'demo-user',
  })
  const post = await endpoint.$post(
    { param: { teamId: 'eld' }, json: { title: ' First post ' } },
    { headers: { authorization: 'Bearer demo' } },
  )
  expect(post.status).toBe(201)
  expect(post.headers.get('x-request-id')).toBeTruthy()
  expect(await post.json()).toMatchObject({
    teamId: 'eld',
    title: 'First post',
    authorId: 'demo-user',
  })
  expect(
    (await endpoint.$get({ param: { teamId: 'eld' }, query: {} })).status,
  ).toBe(401)
})
