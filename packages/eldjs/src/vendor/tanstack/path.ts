// Extracted from TanStack Router. See THIRD_PARTY_NOTICES.md.
import type { DynamicPathSegment } from './new-process-route-tree.js'
export type InterpolationSegment = string | DynamicPathSegment
export type RouteInterpolation = Array<InterpolationSegment> & { names?: Array<string> }
export function trimPathRight(path: string) {
  const len = path.length
  return len > 1 && path[len - 1] === '/' ? path.replace(/\/+$/, '') : path
}
