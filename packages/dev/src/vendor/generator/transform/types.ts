// Adapted from TanStack Router. See THIRD_PARTY_NOTICES.md.
import type { RouteNode } from '../types.js'
import type { Config } from '../config.js'

export interface TransformOptions {
  source: string
  filename?: string
  ctx: TransformContext
  node: RouteNode
}

export type TransformResult =
  | {
      result: 'no-route-export'
    }
  | {
      result: 'not-modified'
    }
  | {
      result: 'modified'
      output: string
    }
  | {
      result: 'error'
      error?: any
    }

export interface TransformContext {
  target: Config['target']
  routeId: string
  lazy: boolean
}
