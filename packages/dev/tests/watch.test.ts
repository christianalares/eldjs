import { expect, test } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { watchRoutes } from '../src/generator.js'

test('the standalone watcher generates new routes and recovers after invalid route files are removed', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'eld-watch-'))
  let watcher: Awaited<ReturnType<typeof watchRoutes>> | undefined
  try {
    await mkdir(path.join(root, 'src/routes'), { recursive: true })
    await writeFile(
      path.join(root, 'src/routes/__root.ts'),
      "import { createRootRoute } from '@eldjs/core'; export const Route = createRootRoute()",
    )
    const errors: unknown[] = []
    watcher = await watchRoutes({ root }, (error) => errors.push(error))
    await writeFile(path.join(root, 'src/routes/test.lazy.ts'), '')
    await expect
      .poll(() => errors.map(String).join())
      .toContain('API routes do not support UI split files')
    await rm(path.join(root, 'src/routes/test.lazy.ts'))
    await writeFile(path.join(root, 'src/routes/ready.ts'), '')
    await expect
      .poll(async () =>
        readFile(path.join(root, 'src/routeTree.gen.ts'), 'utf8'),
      )
      .toContain("'/ready'")
    expect(
      await readFile(path.join(root, 'src/routes/ready.ts'), 'utf8'),
    ).toContain("createFileRoute('/ready')")
  } finally {
    await watcher?.close()
    await rm(root, { recursive: true, force: true })
  }
})
