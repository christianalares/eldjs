import { createHandler } from '@eldjs/core'
import { z } from 'zod'
import { requireUser } from '../middleware/auth.js'

// This file knows its own dependencies and schemas; no route-file import needed.
export const createPost = createHandler({
  middleware: [requireUser],
  validate: {
    params: z.object({ teamId: z.string().min(1) }),
    json: z.object({ title: z.string().trim().min(1).max(200) }),
  },
  handler: ({ c, input, context }) =>
    c.json(
      {
        id: crypto.randomUUID(),
        teamId: input.params.teamId,
        title: input.json.title,
        authorId: context.user.id,
      },
      201,
    ),
})
