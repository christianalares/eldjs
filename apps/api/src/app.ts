import { createApp } from '@eldjs/core'
import { routeTree } from './routeTree.gen.js'

const app = createApp({ routeTree })
export type App = typeof app
export default app
