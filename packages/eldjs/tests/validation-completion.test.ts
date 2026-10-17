import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { expect, test } from 'vitest'

function inspectSource<T>(
  source: string,
  inspect: (service: ts.LanguageService, fileName: string) => T,
) {
  const fileName = fileURLToPath(
    new URL('./completion-fixture.ts', import.meta.url),
  )
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    skipLibCheck: true,
  }
  const service = ts.createLanguageService({
    ...ts.sys,
    useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
    getCompilationSettings: () => options,
    getScriptFileNames: () => [fileName],
    getScriptVersion: () => '0',
    getScriptSnapshot: (name) => {
      const text = name === fileName ? source : ts.sys.readFile(name)
      return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text)
    },
    getDefaultLibFileName: ts.getDefaultLibFilePath,
  })
  try {
    return inspect(service, fileName)
  } finally {
    service.dispose()
  }
}

function completions(source: string) {
  return inspectSource(
    source,
    (service, fileName) =>
      service
        .getCompletionsAtPosition(fileName, source.indexOf('/*cursor*/'), {})
        ?.entries.filter(
          (entry) => entry.kind === ts.ScriptElementKind.memberVariableElement,
        )
        .map((entry) => entry.name)
        .sort() ?? [],
  )
}

test('parameter schema diagnostics name the invalid key and the allowed route parameter', () => {
  const messages = inspectSource(
    `
    import { createRoute } from '../src/index.js'
    import { z } from 'zod'
    createRoute('/teams/$teamId/posts')({
      handlers: ({ createHandler }) => {
        createHandler({
          validate: { params: z.object({ test: z.string().optional() }) },
          handler: ({ c }) => c.json({ ok: true }),
        })
        return {}
      },
    })
  `,
    (service, fileName) =>
      service
        .getSemanticDiagnostics(fileName)
        .map((diagnostic) =>
          ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
        ),
  )
  expect(messages).toHaveLength(1)
  expect(messages[0]).toContain('Unknown path parameter test. Expected teamId.')
  expect(messages[0]).not.toContain('"~standard".types')
})

test('validate suggests request targets while writing an inline handler', () => {
  expect(
    completions(`
    import { createRoute } from '../src/index.js'
    createRoute('/items')({
      handlers: ({ createHandlers }) => createHandlers({
        POST: {
          validate: { /*cursor*/ },
          handler: ({ c }) => c.json({ ok: true }),
        },
      }),
    })
  `),
  ).toEqual(['form', 'headers', 'json', 'params', 'query'])
})

test.each(['GET', 'HEAD', 'ANY'])(
  '%s only suggests targets without a body',
  (method) => {
    expect(
      completions(`
    import { createRoute } from '../src/index.js'
    createRoute('/items')({
      handlers: ({ createHandlers }) => createHandlers({
        ${method}: {
          validate: { /*cursor*/ },
          handler: ({ c }) => c.json({ ok: true }),
        },
      }),
    })
  `),
    ).toEqual(['headers', 'params', 'query'])
  },
)

test('an extracted handler suggests query while its name is partially typed', () => {
  expect(
    completions(`
    import { createHandler } from '../src/index.js'
    createHandler({
      validate: { que/*cursor*/ },
      handler: ({ c }) => c.json({ ok: true }),
    })
  `),
  ).toContain('query')
})

test('parameter fields suggest names from the route', () => {
  expect(
    completions(`
    import { createRoute } from '../src/index.js'
    createRoute('/teams/$teamId/posts')({
      handlers: ({ createHandlers }) => createHandlers({
        GET: {
          validate: { params: { /*cursor*/ } },
          handler: ({ c }) => c.json({ ok: true }),
        },
      }),
    })
  `),
  ).toEqual(['teamId'])
})

test('invalid parameter field diagnostics are attached to the misspelled field', () => {
  const source = `
    import { createRoute } from '../src/index.js'
    import { z } from 'zod'
    createRoute('/teams/$teamId/posts')({
      handlers: ({ createHandler }) => {
        createHandler({
          validate: { params: { test: z.string() } },
          handler: ({ c }) => c.json({ ok: true }),
        })
        return {}
      },
    })
  `
  const diagnostics = inspectSource(source, (service, fileName) =>
    service.getSemanticDiagnostics(fileName),
  )
  expect(diagnostics).toHaveLength(1)
  const diagnostic = diagnostics[0]!
  expect(
    source.slice(diagnostic.start, diagnostic.start! + diagnostic.length!),
  ).toBe('test')
  expect(
    ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
  ).toContain('Unknown path parameter test. Expected teamId.')
})

test.each([
  ['', false],
  ['validate: {},', false],
  ['validate: { params: { teamId: z.string().transform(Number) } },', true],
  ["validate: { headers: z.object({ 'x-api-version': z.string() }) },", true],
] as const)(
  'handler autocomplete reflects its configured validators (%s)',
  (configuration, hasInput) => {
    const entries = completions(`
    import { createRoute } from '../src/index.js'
    import { z } from 'zod'
    createRoute('/teams/$teamId')({
      handlers: ({ createHandlers }) => createHandlers({
        GET: {
          ${configuration}
          handler: (context) => {
            context./*cursor*/
            return context.c.json({ ok: true })
          },
        },
      }),
    })
  `)
    expect(entries).toContain('params')
    expect(entries.includes('input')).toBe(hasInput)
  },
)
