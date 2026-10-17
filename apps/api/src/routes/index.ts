import { createFileRoute } from '@eldjs/core'

export const Route = createFileRoute('/')({
  handlers: {
    GET: ({ c, context }) =>
      c.json({ name: 'eldjs', requestId: context.requestId }),
  },
})
