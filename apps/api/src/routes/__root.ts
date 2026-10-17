import { createRootRoute } from 'eldjs'
import { requestId } from '../middleware/request-id.js'

export const Route = createRootRoute({ middleware: [requestId] })
