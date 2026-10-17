import { createFileRoute } from 'eldjs'

export const Route = createFileRoute('/health')({
  handlers: { GET: ({ c }) => c.json({ ok: true }) },
})
