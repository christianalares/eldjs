# Eld

File-based APIs with Hono, TanStack routing conventions, and Standard Schema validation. Route files stay small: handlers, schemas, and middleware can live in ordinary imported modules.

Eld is an experimental 0.x project. The public API may change between minor releases. Preview releases use npm's `next` tag.

The route generator and matcher are adapted from TanStack Router's MIT-licensed source. The HTTP runtime, validation layer, handler helpers, and Hono integration are Eld's. There is no React or page router in the request runtime. See the [runtime notices](packages/eldjs/THIRD_PARTY_NOTICES.md) and [tooling notices](packages/dev/THIRD_PARTY_NOTICES.md) for the pinned upstream revision.

## Install the preview

```sh
pnpm add @eldjs/core@next hono
pnpm add -D @eldjs/dev@next
```

Import runtime helpers from `@eldjs/core`. Install your chosen Standard Schema library separately, such as `pnpm add zod`. The `eld` CLI generates and watches route files; project scaffolding is not available yet. See the route and app examples below to set up an API.

## Run the example from source

Requires Node 20.19+ (tested on Node 24) and pnpm 12.6.0, pinned in the root `packageManager` field.

```sh
pnpm install
pnpm check
pnpm dev
```

The example serves at `http://localhost:5173`:

```sh
curl http://localhost:5173/health
curl -H 'Authorization: Bearer demo' 'http://localhost:5173/teams/eld/posts?page=2'
curl -X POST http://localhost:5173/teams/eld/posts \
  -H 'Authorization: Bearer demo' \
  -H 'Content-Type: application/json' \
  -d '{"title":"First post"}'
```

`pnpm build:example` builds a Fetch-compatible app in `apps/api/dist/app.js`. An actual production server or platform adapter is still needed to host it. The demo authentication is intentionally a fixed token.

## Workspace layout

```text
packages/eldjs/    # runtime, public types, and runtime tests
packages/dev/     # @eldjs/dev: generator, CLI, Vite plugin, and tooling tests
apps/api/         # standalone API example and consumption tests
```

The example declares `"@eldjs/core": "workspace:*"` in `dependencies` and `"@eldjs/dev": "workspace:*"` in `devDependencies`. Route and handler imports use `@eldjs/core`; the Vite plugin comes from `@eldjs/dev/vite`. It has its own dependencies and TypeScript configuration.

Turborepo builds dependencies before tasks that consume them. `pnpm dev` starts both packages' TypeScript watchers and the example's Vite server after the initial builds. `pnpm check` builds and checks all workspace packages and runs their tests; build and verification results are cached in `.turbo`. Route generation always runs before the example's build, type check, or tests because it can rewrite route source files.

The root `pnpm-lock.yaml` is the only lockfile. Use `pnpm install --frozen-lockfile` in CI, followed by `pnpm check`. Run `pnpm check:packages` before distributing tarballs to verify installation outside the workspace.

## Runtime and development dependencies

An application needs `@eldjs/core`, `hono`, and any schema library its routes use as production dependencies. Hono is a peer dependency of Eld, so the application supplies the shared Hono installation. Standard Schema's type definitions remain a small dependency of Eld; they add no JavaScript to the request runtime.

Install `@eldjs/dev` as a development dependency. It owns generation, file watching, the `eld` executable, and the Vite plugin, including their Babel, Prettier, Jiti, and Zod dependencies. Vite is optional: the CLI and programmatic generator work without it. Eld's runtime does not require Zod; an application using Valibot can deploy without Zod installed.

Build with development dependencies available, then deploy the built API with its production dependencies (for example, a fresh `pnpm install --prod --frozen-lockfile` in the deployment stage). Generation and the development server do not run in production. This separation reduces production installs; tooling was already excluded from the bundled request handler.

To try local changes in another project, create tarballs:

```sh
# In this repository; packing builds each package.
pnpm --dir packages/eldjs pack --out /tmp/eldjs.tgz
pnpm --dir packages/dev pack --out /tmp/eldjs-dev.tgz

# In the consuming project.
pnpm add /tmp/eldjs.tgz hono
pnpm add -D /tmp/eldjs-dev.tgz
```

The `eld` CLI currently provides `generate` and `watch`; a project scaffolding command has not been added. With Vite, the plugin generates routes automatically. Without Vite, run `pnpm exec eld generate` before compiling and `pnpm exec eld watch` alongside your development server.

`pnpm check:packages` packs both packages, installs them in an external temporary project, generates and compiles routes and declarations, then runs the built API after a fresh production-only install. It verifies Hono 4.13.7 compatibility, Valibot validation, and the absence of Eld tooling and Zod from that production install. The workspace checks use Hono 4.13.13. A chosen schema library may retain its own dependencies: this Valibot fixture retains its optional TypeScript peer from the build lockfile, independently of Eld.

## Route files

Inside an application, such as `apps/api`:

```text
src/
  routes/
    __root.ts
    index.ts
    health.ts
    teams.$teamId.posts.ts
  handlers/
    create-post.ts
  middleware/
    auth.ts
  app.ts
  routeTree.gen.ts               # generated
```

The generator watches route files, updates the `createFileRoute` path literal when a file moves, and writes the route graph and TypeScript registry. Add a `__root.ts` exporting `Route = createRootRoute()` before the first generation. Empty endpoint files are scaffolded automatically. Include the generated file in your TypeScript project; committing it makes editor types available immediately after checkout.

```ts
// src/routes/teams.$teamId.posts.ts
import { createFileRoute } from '@eldjs/core'
import { z } from 'zod'
import { requireUser } from '../middleware/auth.js'
import { createPost } from '../handlers/create-post.js'

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
        handler: ({ params, input, context, c }) =>
          c.json({
            teamId: params.teamId, // inferred from the filename
            page: input.query.page, // number after validation
            viewer: context.user.id,
          }),
      },
      POST: createPost,
    }),
})
```

For simple methods, use a direct function:

```ts
export const Route = createFileRoute('/health')({
  handlers: { GET: ({ c }) => c.json({ ok: true }) },
})
```

Use `createHandlers` for inline objects with their own validation and middleware. Its callback also exposes a route-bound `createHandler` that knows the path and inherited context.

## Extracted handlers

The exported `createHandler` infers its own schemas, middleware context, response body, and status. Move the entire definition into another file without losing those types:

```ts
// src/handlers/create-post.ts
import { createHandler } from '@eldjs/core'
import { z } from 'zod'
import { requireUser } from '../middleware/auth.js'

export const createPost = createHandler({
  middleware: [requireUser],
  validate: {
    params: z.object({ teamId: z.string().min(1) }),
    json: z.object({ title: z.string().trim().min(1) }),
  },
  handler: ({ input, context, c }) =>
    c.json(
      {
        teamId: input.params.teamId,
        title: input.json.title,
        authorId: context.user.id,
      },
      201,
    ),
})
```

An independent handler declares its dependencies explicitly. It cannot infer a file path or ancestor middleware from a route that imports it later. Validate `params` for typed parameters and list the middleware whose context it uses. Middleware identity is deduplicated across the request, so attaching the same `requireUser` to both route and handler runs it once.

## Middleware

Middleware lives wherever you choose. Attach it to the app, root route, a parent route, a specific route, or one method. Dependency composition is explicit:

```ts
import { createMiddleware } from '@eldjs/core'

export const requireUser = createMiddleware().handler(({ request, next }) => {
  if (request.headers.get('authorization') !== 'Bearer demo') {
    return new Response('Unauthorized', { status: 401 })
  }
  return next({ context: { user: { id: 'demo-user' } } })
})

export const audit = createMiddleware()
  .middleware([requireUser])
  .handler(async ({ context, next }) => {
    const result = await next({ context: { actorId: context.user.id } })
    result.response.headers.set('x-audited', 'yes')
    return result
  })
```

Execution is app → root → ancestors → route → method, with dependencies inserted before their dependent middleware. The same object runs once per request. `next({ context })` shallowly merges context, with later values overriding earlier ones; its result contains `{ response, context }`. Return that result or short-circuit with a `Response`. Calling `next()` twice is an error.

Use root middleware for application-wide **inferred context**. `createApp({ middleware })` also wraps 404s, but its context is not retroactively inferred inside route modules. To use that context in a handler, declare the middleware dependency there too. Reusable middleware arrays should use `as const` to preserve tuple inference.

## Validation

Any [Standard Schema v1](https://standardschema.dev/schema) implementation works, including Zod and Valibot. Synchronous and asynchronous validation/transforms are supported. Handlers receive schema **output** types; client requests use schema **input** types.

`validate` autocompletes the supported request targets. Unknown targets such as `test` are rejected by the handler helpers and at route creation for JavaScript callers. Each target takes a Standard Schema; `params` also accepts a map of parameter names to individual Standard Schemas.

| Target    | Value supplied to the schema                                                         |
| --------- | ------------------------------------------------------------------------------------ |
| `params`  | Decoded path parameters; optional segments may be absent; splats use `_splat`        |
| `query`   | Flat object; one value is a string, repeated keys are arrays of strings              |
| `json`    | Parsed JSON, requiring `application/json` or `application/*+json`                    |
| `form`    | URL-encoded or multipart fields; repeated keys are arrays; uploads are `File` values |
| `headers` | Object with lowercase header names and string values                                 |

`GET`, `HEAD`, and `ANY` validators can only target `params`, `query`, and `headers`. Body validation (`json` or `form`) belongs on explicit `POST`, `PUT`, `PATCH`, `DELETE`, or `OPTIONS` handlers. POST can validate both query parameters and a body. `ANY` includes GET and HEAD, so it cannot require body validation even if other methods are also declared.

These restrictions apply to inline handlers and extracted `createHandler` definitions when attached to a method. TypeScript rejects incompatible assignments; route creation also throws for untyped JavaScript configurations. An extracted handler can define its schemas before choosing a method, and can be reused across compatible methods.

For `/teams/eld/posts?page=2`, a route declared as `/teams/$teamId/posts` receives `params: { teamId: 'eld' }` and query input `{ page: '2' }`. Path parameter names come from the route; query field names come from the request and your schema.

For individual parameters, a field map offers autocomplete for the names in the route and puts type errors on an invalid field:

```ts
validate: {
  params: {
    teamId: z.string().min(1), // suggested from /teams/$teamId/posts
  },
  query: z.object({ page: z.string().transform(Number) }),
}
```

Each field can use any Standard Schema implementation, including async transforms. Only declared fields appear in `input.params`; raw `params` still contains every path parameter. An absent optional segment is passed as `undefined`, so its schema can allow it or supply a default. Validation errors identify the field in their issue path.

An object schema such as `params: z.object({ teamId: z.string() })` remains supported for validation across fields or transforms that rename output fields. The handler helpers check declared schema **input** keys against the route. A schema requiring `hello` on this route produces an error containing `Unknown path parameter hello. Expected teamId.` Extracted handlers are checked when attached to a route. These checks use Standard Schema types without inspecting schema internals at runtime: schemas with `unknown` inputs or only an index signature have no declared keys to check.

Every configured `validate.X` produces `input.X`, including `params` and `headers`. Without validators, `input` is absent from both the handler type and its runtime context. An empty `validate` object, or one containing only undefined schemas, also provides no `input`. If the validator configuration is optional at runtime, its type requires checking for input before using it.

`params` always contains the decoded path values before schema transformations: validating `teamId` with `.transform(Number)` leaves `params.teamId` as `'007'` while `input.params.teamId` is `7`. Validated headers are in `input.headers`; original header values remain available through `request.headers.get(name)`. For example:

```ts
validate: {
  headers: z.object({
    'x-api-version': z.enum(['1', '2']).transform(Number),
  }),
},
handler: ({ c, request, input }) => c.json({
  original: request.headers.get('x-api-version'), // string | null
  version: input.headers['x-api-version'], // number
}),
```

Use `params` and `input` rather than `c.req.param()` or `c.req.valid()`: Hono sees the dispatch route, while Eld owns matching and validation.

Validation happens after middleware and before the handler. Invalid input or malformed bodies return 400; an incompatible content type returns 415. The response format is:

```json
{
  "error": "VALIDATION_ERROR",
  "target": "json",
  "issues": [{ "message": "Expected string", "path": ["title"] }]
}
```

Unexpected validator exceptions remain server errors. A handler cannot validate both JSON and form bodies. Query parsing does not interpret bracket notation or automatically coerce numbers; express coercion in the schema. Standard Schema validation does not automatically provide JSON Schema or OpenAPI output.

## Routing conventions

| File                             | URL / behavior                                                |
| -------------------------------- | ------------------------------------------------------------- |
| `index.ts`                       | `/`                                                           |
| `users.ts`                       | `/users`; can also contain shared middleware for child routes |
| `users.$id.ts` or `users/$id.ts` | `/users/:id`                                                  |
| `users/route.ts`                 | Directory-based parent route                                  |
| `catalog.{-$category}.ts`        | `/catalog` or `/catalog/:category`                            |
| `files.$.ts`                     | Splat exposed as `params._splat`                              |
| `downloads.file-{$id}[.]json.ts` | Affixed parameter, e.g. `/downloads/file-42.json`             |
| `_private.ts` + `_private.me.ts` | `/me`, inheriting the pathless parent's middleware            |
| `(admin).users.ts`               | `/users`; grouping does not add a URL segment                 |
| `users_.$id.audit.ts`            | `/users/:id/audit`, outside the `users.ts` parent             |
| `-helpers.ts`                    | Ignored by the generator                                      |

The adapted generator also retains virtual routes and escaped filename tokens. Eld uses TanStack's matcher directly, including static-route precedence. Matching selects a path first, then its method: a POST to a static GET-only endpoint returns 405, even if a dynamic sibling accepts POST.

Paths are case-sensitive by default, matching Hono. Opt into case-insensitive matching with `createApp({ routeTree, caseSensitive: false })` or a route’s `caseSensitive: false` option. When using native Hono middleware, its path filters must cover the same requests as your route matching policy.

Supported handler keys: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`, `HEAD`, and `ANY`. HEAD chooses an explicit HEAD handler, then GET, then ANY; its response body is removed. Other unsupported methods return 405 with `Allow`. Routes with no handlers are middleware containers, not endpoints. Unknown paths return 404. OPTIONS is explicit; install Hono CORS middleware for preflight handling.

Page components, loaders, client navigation, SSR rendering, and Start server-function RPC are outside this API runtime. UI split filenames such as `.lazy.ts` and `.component.ts` are rejected; use ordinary imported handlers instead.

## Vite and CLI

For a separate app consuming the built package:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import devServer from '@hono/vite-dev-server'
import { eld } from '@eldjs/dev/vite'

export default defineConfig({
  plugins: [eld(), devServer({ entry: 'src/app.ts' })],
  build: { ssr: 'src/app.ts' },
})
```

```ts
// src/app.ts
import { createApp } from '@eldjs/core'
import { routeTree } from './routeTree.gen.js'

const app = createApp({ routeTree })
export type App = typeof app
export default app
```

Run generation before TypeScript checks in CI. Vite generates before loading the app and regenerates on file additions, edits, renames, and deletions. The CLI also works without Vite:

```sh
pnpm exec eld generate
pnpm exec eld watch
pnpm exec eld generate --root ./apps/api
```

`eld.config.json` configures `routesDirectory`, `generatedRouteTree`, ignore patterns, or `virtualRouteConfig`. The same options can be passed to `eld({...})` or `generate`/`watchRoutes` from `@eldjs/dev`. Imports use `.js` extensions by default for NodeNext compatibility. Restart the dev server or watcher after changing `eld.config.json`.

If migrating an existing Eld app, replace `eldjs/vite` with `@eldjs/dev/vite` and `eldjs/generator` with `@eldjs/dev`. The `eld` command now comes from `@eldjs/dev`. Replace runtime imports from `eldjs` with `@eldjs/core` and regenerate the route tree.

## Hono and clients

`createApp` returns a Hono app with `.fetch`, `.request`, and `.onError`. Supply `hono: yourApp` to install native Hono middleware first—for example CORS, body-size limits, or logging. Request handlers receive the Hono context as `c`, including bindings and streaming/response helpers. To type bindings, augment `Register`:

```ts
declare module '@eldjs/core' {
  interface Register {
    env: { Bindings: { API_KEY: string } }
  }
}
```

The route graph is projected into Hono's `hc` client schema:

```ts
import { hc } from 'hono/client'
import type { App } from './app.js'

const client = hc<App>('http://localhost:5173')
const response = await client.teams[':teamId'].posts.$post(
  { param: { teamId: 'eld' }, json: { title: 'Hello' } },
  { headers: { authorization: 'Bearer demo' } },
)
if (!response.ok) throw new Error(`Request failed: ${response.status}`)
const post = await response.json()
```

Client inference covers schema inputs, handler responses, automatic validation errors (400 and body content-type errors at 415), and typed responses returned by Eld middleware, including dependencies and ancestors. Use explicit statuses such as `c.json(data, 200)` for precise narrowing, and check `response.ok` before reading success data. Native Hono middleware/routes supplied separately and custom error-handler responses remain outside that schema. Whole-segment dynamic parameters, optional segments, and splats can be projected; affixed parameters currently remain server-only because Hono's client cannot interpolate them. A splat is addressed as `client.files[':_splat']` with `param: { _splat: 'path/to/file' }`.

This is an initial implementation, not a claim of complete TanStack Start compatibility. OpenAPI generation, deployment presets, output validation, and a comprehensive upstream compatibility suite are follow-up work.

## Development

```sh
pnpm dev                       # watch both packages and run the example
pnpm generate:example          # build dependencies and generate example routes
pnpm check                     # all builds, type checks, and integration tests
pnpm check:packages            # external tarball consumer and production-only install
pnpm build                     # build every workspace package
pnpm build:example             # example plus its runtime and tooling dependencies
pnpm --filter @eldjs/core test        # runtime tests
pnpm --filter @eldjs/dev test   # generator, watcher, and Vite tests
pnpm --dir packages/eldjs pack  # local installable tarball; nothing is published
pnpm --dir packages/dev pack    # local development-tooling tarball
```

Tests exercise the generated example through Hono's client, validation with two schema libraries, middleware composition, method handling, route matching, and live Vite file changes. The design investigation is in [docs/research/hono-file-routing.md](docs/research/hono-file-routing.md). See [CONTRIBUTING.md](CONTRIBUTING.md) for development and [RELEASING.md](RELEASING.md) for publication.
