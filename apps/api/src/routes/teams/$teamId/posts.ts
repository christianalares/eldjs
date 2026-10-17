import { createFileRoute } from 'eldjs'
import { z } from 'zod'
import { requireUser } from '../../../middleware/auth.js'
import { createPost } from '../../../handlers/create-post.js'

export const Route = createFileRoute('/teams/$teamId/posts')({
  middleware: [requireUser],
  handlers: ({ createHandlers }) =>
    createHandlers({
      GET: {
        validate: {
          query: z.object({
            page: z.string().regex(/^\d+$/).transform(Number).default(1),
          }),
        },
        handler: ({ c, params, input, context }) =>
          c.json(
            {
              teamId: params.teamId,
              page: input.query.page,
              viewerId: context.user.id,
              requestId: context.requestId,
              posts: [],
            },
            200,
          ),
      },
      POST: createPost,
    }),
})
