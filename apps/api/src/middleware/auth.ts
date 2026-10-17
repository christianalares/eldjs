import { createMiddleware } from 'eldjs'

// Demo authentication only. Replace with session/token verification in a real API.
export const requireUser = createMiddleware().server(({ request, next }) => {
  if (request.headers.get('authorization') !== 'Bearer demo') {
    return new Response('Unauthorized', { status: 401 })
  }
  return next({ context: { user: { id: 'demo-user' } } })
})
