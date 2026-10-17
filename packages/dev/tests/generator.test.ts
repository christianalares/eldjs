import { expect, test } from 'vitest'
import {
  mkdtemp,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { generate } from '../src/generator.js'

test('generation updates file identities and route types when endpoints are renamed or removed', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'eld-generator-'))
  try {
    await mkdir(path.join(root, 'src/routes'), { recursive: true })
    await writeFile(
      path.join(root, 'src/routes/__root.ts'),
      "import { createRootRoute } from '@eldjs/core'\nexport const Route = createRootRoute()\n",
    )
    await writeFile(
      path.join(root, 'src/routes/users.$id.ts'),
      "import { createFileRoute } from '@eldjs/core'\nexport const Route = createFileRoute('/stale')({ handlers: { GET: ({ c }) => c.json({ ok: true }) } })\n",
    )
    await generate({ root })
    const endpoint = await readFile(
      path.join(root, 'src/routes/users.$id.ts'),
      'utf8',
    )
    expect(endpoint).toContain("createFileRoute('/users/$id')")
    expect(endpoint).not.toContain('@tanstack/react-router')
    const first = await readFile(
      path.join(root, 'src/routeTree.gen.ts'),
      'utf8',
    )
    expect(first).toContain("declare module '@eldjs/core'")
    expect(first).toContain("fullPath: '/users/$id'")
    await rename(
      path.join(root, 'src/routes/users.$id.ts'),
      path.join(root, 'src/routes/people.$id.ts'),
    )
    await generate({ root })
    const second = await readFile(
      path.join(root, 'src/routeTree.gen.ts'),
      'utf8',
    )
    expect(second).toContain('/people/$id')
    expect(second).not.toContain('/users/$id')
    await rm(path.join(root, 'src/routes/people.$id.ts'))
    await generate({ root })
    expect(
      await readFile(path.join(root, 'src/routeTree.gen.ts'), 'utf8'),
    ).not.toContain('/people/$id')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
