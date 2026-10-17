// API target adapted from TanStack Router. See THIRD_PARTY_NOTICES.md.
import { format } from './utils.js'
import type { Config } from './config.js'
type TemplateTag = 'tsrImports' | 'tsrPath' | 'tsrExportStart' | 'tsrExportEnd'
export function fillTemplate(config: Config, template: string, values: Record<TemplateTag, string>) {
  return format(template.replace(/%%(\w+)%%/g, (_, key) => values[key as TemplateTag] || ''), config)
}
export interface TargetTemplate {
  fullPkg: string
  subPkg: string
  rootRoute: { template: () => string; imports: { tsrImports: () => string; tsrExportStart: () => string; tsrExportEnd: () => string } }
  route: { template: () => string; imports: { tsrImports: () => string; tsrExportStart: (path: string) => string; tsrExportEnd: () => string } }
  lazyRoute: TargetTemplate['route']
}
export function getTargetTemplate(_config: Config): TargetTemplate {
  const route: TargetTemplate['route'] = {
    template: () => '%%tsrImports%%\n\n%%tsrExportStart%%{ handlers: { GET: ({ c }) => c.json({ message: "Hello!" }) } }%%tsrExportEnd%%\n',
    imports: {
      tsrImports: () => "import { createFileRoute } from 'eldjs'",
      tsrExportStart: (path) => `export const Route = createFileRoute(${JSON.stringify(path)})(`,
      tsrExportEnd: () => ')',
    },
  }
  return {
    fullPkg: 'eldjs', subPkg: 'eldjs', route, lazyRoute: route,
    rootRoute: {
      template: () => '%%tsrImports%%\n\n%%tsrExportStart%%{}%%tsrExportEnd%%\n',
      imports: {
        tsrImports: () => "import { createRootRoute } from 'eldjs'",
        tsrExportStart: () => 'export const Route = createRootRoute(',
        tsrExportEnd: () => ')',
      },
    },
  }
}
