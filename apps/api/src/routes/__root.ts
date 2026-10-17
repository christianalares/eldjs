import { createRootRoute } from '@eldjs/core'
import { requestId } from '../middleware/request-id.js'

export const Route = createRootRoute({ middleware: [requestId] })
