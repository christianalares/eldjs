import { createFileRoute } from '@eldjs/core'

export const Route = createFileRoute('/health')({
  handlers: { GET: ({ c }) => c.json({ ok: true }) },
})
