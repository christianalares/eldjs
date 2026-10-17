import { createMiddleware } from '@eldjs/core'

export const requestId = createMiddleware().server(async ({ next }) => {
  const id = crypto.randomUUID()
  const result = await next({ context: { requestId: id } })
  result.response.headers.set('x-request-id', id)
  return result
})
