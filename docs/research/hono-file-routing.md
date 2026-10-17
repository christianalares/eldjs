# File-based, typed API routes for Hono

> Implementation update (2026-10-16): the first working version now lives in this repository. It uses an adapted TanStack generator and matcher with a Hono runtime, explicit middleware, Standard Schema input validation, extracted `createHandler` definitions, and Vite/CLI generation. See [the README](../../README.md) for the implemented API and current limitations. The investigation below records the design evidence, not a claim that every proposed feature is implemented.


Investigated 2026-10-16 and updated for the requested Start-like server API, Standard Schema validation, and explicitly attached middleware. This is research and proposed architecture; a framework has not been implemented.

## Recommendation

Build an API-only adaptation of TanStack Start's server routing experience, backed by Hono. Given the clarified preference for near-parity, **selective source extraction is the recommended starting point**: preserve the generator's routing conventions, tree construction, file identity updates, watch/cache/write machinery, and relevant tests; adapt its output to an API route model. Extract the request middleware builder and context inference patterns. Add Standard Schema validation for HTTP inputs using Hono's existing adapter or a small equivalent integration.

Unmodified package reuse and adapting open-source code are different questions. Public scanner reuse remains possible, but it is not the ceiling on reuse. There is no existing `target: 'hono'`; we can add our own target in an extracted generator and replace the UI-specific output contract. [Public exports](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-generator/src/index.ts), [configuration](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-generator/src/config.ts), [generator implementation](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-generator/src/generator.ts).

The product target is Start's **server routing and middleware features**, plus first-class validation of JSON/form bodies, query parameters, path parameters, and headers. Middleware lives in ordinary imported modules and is attached globally, to routes, or to individual methods. No `_middleware.ts` convention is required. SSR, components, browser navigation, loaders for pages, hydration, client/server RPC compilation, and browser middleware are outside this API-only scope.

## Sources and versions

- Source checkout: TanStack/router commit [`18154b1c45454a70aa77e9d6d27c8a6e0733d031`](https://github.com/TanStack/router/commit/18154b1c45454a70aa77e9d6d27c8a6e0733d031), committed 2026-10-16 at 15:35:33 +02:00. References below are pinned to that commit.
- npm registry checks during this investigation returned `@tanstack/router-generator@1.167.44`, `@tanstack/router-plugin@1.168.46`, and `@tanstack/react-start@1.169.2`. These are observed versions, not promises about future latest releases. The generator source package also reports [1.167.44](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-generator/package.json).
- Executable scanner probe: installed exactly `@tanstack/router-generator@1.167.44` into `/tmp/eldjs-tanstack-scanner-probe`, running Node 24.21.0. No product dependencies were installed into this repository.
- Current official documentation was checked, but pinned implementation wins when it is more specific. For example, source configuration includes a `vue` target while some general documentation still describes only React and Solid.

## What TanStack actually provides

TanStack's file router is a build-time compiler layered over its programmatic route system. The generated imports, route hierarchy, literal paths, and module augmentation let TypeScript connect a route file to its place in the tree. The watcher maintains those relationships when files move. This is separate from the runtime URL matcher. [Code-based routing explanation](https://tanstack.com/router/latest/docs/routing/code-based-routing), [generated implementation](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-generator/src/generator.ts).

It is also not inherently Vite-only. The generator is its own Node package; the Router CLI supplies `tsr generate` and `tsr watch`; the bundler plugin wraps the generator through `unplugin`. The Vite generator plugin initializes during `configResolved` and regenerates from file watch events. This means a new API library can provide a CLI first and add Vite integration without making Vite part of its deployed server runtime. [CLI documentation](https://tanstack.com/router/latest/docs/installation/with-router-cli), [watch implementation](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-cli/src/watch.ts), [bundler integration](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-plugin/src/core/router-generator-plugin.ts).

### The useful public reuse seam

The package root exports `physicalGetRouteNodes`, `virtualGetRouteNodes`, `inferFullPath`, `RouteNode`, `GetRouteNodesResult`, `getConfig`, and `Generator`. These are package exports, not imports through undocumented deep source paths. [Export list](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-generator/src/index.ts).

`physicalGetRouteNodes(config, root, tokenRegexes)` scans the filesystem, identifies filenames and special tokens, and returns nodes plus an optional root node. It does not execute endpoint modules, require a `Route` export, or itself emit the TanStack route tree. The full `Generator` performs those later steps. The scanner expects callers to supply regexes for the index and route tokens. With default conventions those are `/^index$/` and `/^route$/`; accepting arbitrary configurable tokens would require an adapter to reproduce TanStack's token compilation rules. [Scanner source](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-generator/src/filesystem/physical/getRouteNodes.ts).

`inferFullPath(node)` removes group and pathless-layout segments while respecting escaped names. It preserves an index route's trailing slash. That is useful for obtaining a URL pattern, but Hono registration still needs a deliberate conversion of parameter syntax and trailing-slash policy. [Path inference](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-generator/src/utils.ts#L929).

A disposable executable probe confirmed these results using the published package. All fixture files contained only a comment, and there was no `__root` file:

| Input file | Scanner kind | `inferFullPath` result |
| --- | --- | --- |
| `index.ts` | static | `/` |
| `users.index.ts` | static | `/users/` |
| `users.$id.ts` | static | `/users/$id` |
| `(v1)/health.ts` | static | `/health` |
| `_auth/orders.$orderId.ts` | static | `/orders/$orderId` |
| `files/$.ts` | static | `/files/$` |
| `report[.]csv.ts` | static | `/report.csv` |
| `users.loader.ts` | loader | `/users` |
| `-private.ts` | ignored | — |

The scanner succeeded; running the full `Generator` on the same directory failed because the root route was missing. This proves basic scanner reuse, not a complete API compiler.

Minimal reproduction, after installing the exact package and creating fixture files in `routes/`:

```js
import { getConfig, physicalGetRouteNodes, inferFullPath }
  from '@tanstack/router-generator'

const root = process.cwd()
const config = getConfig({ routesDirectory: './routes' }, root)
const { routeNodes } = await physicalGetRouteNodes(config, root, {
  indexTokenSegmentRegex: /^index$/,
  routeTokenSegmentRegex: /^route$/,
})
console.log(routeNodes.map(node => [node.filePath, inferFullPath(node)]))
```

The `.loader.ts` result exposes an important boundary: this scanner carries UI-routing vocabulary. `lazy`, `component`, `pendingComponent`, `errorComponent`, `notFoundComponent`, and `loader` have special meanings. An API adapter should reserve or reject them rather than silently assign surprising endpoint URLs. Groups and pathless segments also do not automatically imply API authentication or middleware inheritance; those semantics must be defined by the API library. [Special filename handling](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-generator/src/filesystem/physical/getRouteNodes.ts), [node types](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-generator/src/types.ts).

### Why the full generator is not a clean Hono plugin

`target` is restricted to `react`, `solid`, and `vue`. Templates choose the corresponding `@tanstack/*-router` package. `customScaffolding` replaces starter route-file text, not the architecture of generated output. [Configuration](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-generator/src/config.ts), [target templates](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-generator/src/template.ts).

The full generator additionally:

- Requires a root route and filters files without a named `Route` export.
- Rewrites recognized `createFileRoute` calls and normalizes imports to `@tanstack/${target}-router`.
- Emits route `.update(...)`, `_addFileChildren(...)`, and `_addFileTypes<...>()` calls.
- Produces `FileRoutesByPath` augmentation for the selected router module.

These are the main compatibility costs, not just naming differences. Even mutating the public `targetTemplate` property would leave the transform's hardcoded target package and the generated route-object protocol. [Generator](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-generator/src/generator.ts), [source transformer](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-generator/src/transform/transform.ts).

`GeneratorPlugin` has exactly three optional hooks: `init`, `afterTransform`, and `onRouteTreeChanged`. There is no declared replace-emitter, custom-target, or before-transform hook. `onRouteTreeChanged` is invoked after the normal generated file has been written. A plugin can emit an additional Hono artifact, but ordinarily still has to satisfy the TanStack pipeline first. Monkey-patching methods through `init` or impersonating a TanStack route object is possible engineering, but would couple a new product to behavior these hooks do not promise to abstract. [Hook interface](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-generator/src/plugin/types.ts), [hook invocation](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-generator/src/generator.ts#L588).

The root exports are usable APIs, but no general-purpose Hono backend contract was found in the checked API documentation. Pinning the dependency and testing file-convention fixtures is prudent. The package's engine requirement is Node >=20.19, and its development-time dependencies include router-core, router-utils, virtual-file-routes, Babel types, Zod, Prettier, Jiti, and MagicString. A scanner adapter does not make those deployed Hono runtime dependencies unless the build accidentally bundles it there. [Package manifest](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-generator/package.json).

## Does TanStack Start already solve this?

Partly. Start supports API-only route files using `createFileRoute('/hello')({ server: { handlers: { GET: ... } } })`. It has typed path parameters, per-route middleware, per-handler middleware, and Web `Request`/`Response` handling. For a project already using Start, these are the simplest supported endpoints to use. [Official server routes guide](https://tanstack.com/start/latest/docs/framework/react/guide/server-routes).

However, these handlers are executed through Start's server stack. The implementation obtains a TanStack router, matches its route tree, collects Start middleware, and may fall through to application rendering. The `server` option is introduced through module augmentation of router-core. This is not a standalone Hono adapter that can simply be imported into a Hono app. Reusing Start as the actual framework is an alternative; extracting its server-route internals would introduce more coupling than scanner-only reuse. [Server route types](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/start-client-core/src/serverRoute.ts), [server handler implementation](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/start-server-core/src/createStartHandler.ts#L1128).

## Alternatives

The effort and risk assessments below are engineering judgments based on the interfaces inspected above.

| Approach | Reused behavior | Additional work | Assessment |
| --- | --- | --- | --- |
| Use Start server routes | Full routing, watching, generation, middleware integration | Accept Start's runtime and route model | Good if Hono is optional and Start is already the app framework |
| Unmodified Router Vite plugin | Full TanStack generator | Must supply compatible TanStack routes; still no Hono registrations | Not a standalone solution |
| Generator hook emits extra Hono file | TanStack's full route discovery and tree | Keep TanStack route protocol; add Hono emitter/types | Reasonable only for an existing TanStack app needing an extra projection |
| Public scanner + own Hono compiler | File discovery, TanStack filename parsing, normalized paths | Hono emitter, type links, middleware semantics, watcher integration | Smallest dependency-based reuse option; less reuse than extraction |
| Independent small scanner | Chosen subset of familiar conventions | Own parser, tests, emitter, watcher | Suits a smaller convention set; less aligned with requested near-parity |
| Selectively extract generator and server middleware | Conventions, tree linking, source updates, watch/cache/write behavior, middleware typing and tests | Own target/output, HTTP validation, Hono bridge; maintain provenance and upstream patches | Preferred for the clarified Start-like scope |
| Upstream custom target architecture | Eventually a supported reusable compiler backend | Collaborate upstream; separate discovery/transforms/emission | Useful future direction, not an existing capability |

TanStack Router is MIT licensed. Vendoring or modifying code requires preserving its copyright and license notice in copies or substantial portions. [License](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/LICENSE).

## Proposed architecture and boundaries

This is a proposed design, not tested implementation:

1. **Build-time discovery adapter:** scan route files into a small owned manifest containing module location, route identifier, URL pattern, and ancestry. Do not leak TanStack `RouteNode` throughout the project.
2. **API-specific compiler:** validate duplicate method/path pairs; convert supported path syntax; resolve declared middleware; emit static imports, route registrations, and literal type information.
3. **Runtime package:** Hono plus small route-definition helpers. No filesystem discovery in production request handling.
4. **CLI:** `generate` for CI/editor bootstrapping and `watch` for development. Deterministic output, atomic writes, and write-only-on-change avoid loops.
5. **Vite adapter:** trigger the same compiler on startup and relevant changes, and ensure server-module invalidation. Watch generation and request-server reload are related but separate responsibilities.

A first feasibility slice can cover directories, dot-separated paths, `index.ts`, `$id`, and excluded helper files. The product compatibility target should also cover relevant Start conventions such as groups, pathless parent routes, break-out routes, optional segments, and splats. These should be verified against retained upstream fixtures, including middleware inheritance behavior.

The most consequential design questions for a first implementation are the route API's source of its literal path type; how middleware changes the typed Hono context; how validation and response types reach the client; and whether one file owns all HTTP methods or methods use separate files. These are product/type-system choices beyond filesystem reuse.

## Hono integration: a verified type seam

The generated application should contain ordinary static imports and chained Hono registrations. This preserves the schema accumulated by Hono's generic return types and makes it available to `hc<typeof app>()`. Registering endpoints in a loop against a broadly typed `Hono` object, or ignoring each registration's return type, does not automatically preserve that schema. This is why a runtime glob alone does not deliver the desired editor experience. [Hono RPC](https://hono.dev/docs/guides/rpc), [route composition example](https://hono.dev/examples/grouping-routes-rpc).

Minimal authoring helper used in the local type experiment below. This demonstrates the Hono type boundary; the intended product API is the Start-like `Route` object described later, rather than these named GET/POST exports:

```ts
// src/routes/users.$userId.ts — minimal probe API
import { createFileRoute } from 'eldjs'

export const GET = createFileRoute('/users/$userId')((c) => {
  const { userId } = c.req.param() // { userId: string }
  return c.json({ id: userId, name: 'Ada' }, 200)
})
```

In this probe, the method is conveyed by the named export. The string is a **file route identity** that the generator would create/update, including on moves. It is not a second independently maintained URL definition. An adapted TanStack transform can maintain the identity in the intended `Route` object API too.

The corresponding generated files could be:

```ts
// file-routes.gen.d.ts — type-only; must be included by tsconfig
import 'eldjs'
declare module 'eldjs' {
  interface FileRoutes {
    '/users/$userId': { path: '/users/:userId' }
  }
}
```

```ts
// routes.gen.ts — runtime composition
import { Hono } from 'hono'
import { GET as userGet } from './routes/users.$userId'

export const app = new Hono()
  .get('/users/:userId', ...userGet)

export type AppType = typeof app
```

The helper can stay small by reusing Hono's existing factory, which preserves middleware tuples, validator output, and handler returns. [Factory source, v4.13.13](https://github.com/honojs/hono/blob/v4.13.13/src/helper/factory/index.ts).

```ts
import { createFactory } from 'hono/factory'

export interface FileRoutes {}
type PathFor<K extends keyof FileRoutes> =
  FileRoutes[K] extends { path: infer P extends string } ? P : never

export function createFileRoute<K extends keyof FileRoutes>(_id: K) {
  return createFactory<{}, PathFor<K>>().createHandlers
}
```

This is an illustrative minimal helper, not a released package. A production version must configure the application environment and account for scoped middleware. The separate type registry avoids making route modules depend at runtime on the generated application that imports them.

### Why `createRoute(method, handler)` needs one more ingredient

That shape can infer a handler's response, but it has no type-level information identifying its source file. TypeScript does not automatically derive a callback's parameter type from the filename. A Vite-only transform also does not make that knowledge available to the normal editor/typechecker.

We therefore need either a literal route identity, a generated per-file helper/type import, or dedicated TypeScript tooling. The literal identity maintained by code generation is the most direct TanStack-like option. `createRoute('GET', handler)` remains possible if the helper itself is generated specifically for that file. Method selection syntax is secondary to preserving file identity and the Hono handler tuple.

### Experiment results

Executed on 2026-10-16 with Node **24.21.0**, TypeScript **5.9.3**, Hono **4.13.13**, HonoX **0.1.62**, and tsx **4.23.15**. npm reported Hono 4.13.13 as `latest` and 5.0.0-rc.1 as `next`; this is explicitly a Hono 4 result. Dependencies and probes were installed in `/tmp/eldjs-hono-research.eZG2Bk`, outside this repository.

Commands: `./node_modules/.bin/tsc --pretty false` and `./node_modules/.bin/tsx probe.ts` both exited successfully. Generated files were **manually authored stand-ins**, so this establishes the Hono/type boundary, not a finished generator or watcher.

| Check | Result |
| --- | --- |
| File identity maps to `/users/:userId` and handler receives `userId: string` | Passed |
| JSON validator output reaches the following handler | Passed |
| Exact client input and response types, including 400 and 201 cases | Passed |
| Wrong file identity, client parameter, body type, or HTTP method | Rejected by TypeScript as expected |
| Unchained registration exposes no accumulated endpoint schema | Confirmed with negative type check |
| HonoX `createApp()` return type exposes no discovered `users` endpoint | Confirmed with negative type check |
| GET `/users/42` | 200 and expected JSON |
| POST valid JSON | 201 and expected JSON |
| POST invalid JSON | 400 and expected validation error |

Hono itself permits arbitrary strings in `c.req.param('key')`, returning `string | undefined` for an unknown key. The probe verifies that `c.req.param().typo` fails and an unknown key cannot be assigned to a definite `string`; it does **not** claim every misspelled string argument is prohibited. [Request overloads](https://github.com/honojs/hono/blob/v4.13.13/src/request.ts).

These are focused feasibility checks. File creation/removal/rename, restart behavior, middleware inheritance, platform builds, and typechecking performance across hundreds of routes remain untested.

## Closely related projects

**HonoX** already combines Hono, Vite, file routing, named method exports, and a `createRoute` helper. It can serve JSON APIs and use folder middleware, so the basic filesystem idea already exists. [HonoX documentation](https://github.com/honojs/honox#routes).

The specific difference is generated end-to-end typing: in published 0.1.62, `createApp()` returns `Hono<E, BlankSchema, '/'>`, and the route factory has a general `string` path. Source inspection shows eager Vite globs feeding runtime registration. Our compiler probe independently confirmed the missing discovered-route client schema. This is a limitation of the inspected automatic aggregation API, not a claim that HonoX handlers or separately composed Hono routers cannot be typed. [Server implementation](https://github.com/honojs/honox/blob/v0.1.62/src/server/server.ts), [glob entry](https://github.com/honojs/honox/blob/v0.1.62/src/server/with-defaults.ts), [factory](https://github.com/honojs/honox/blob/v0.1.62/src/factory/factory.ts).

**Taser.js** is a particularly close existing project. Its own documentation describes generated Hono applications, file routes with HTTP method suffixes, middleware context inference, schema support, Vite integration, and a typed client. It deserves an evaluation before committing to a new framework. Those are documented capabilities; this investigation did not install it or establish its correctness or production maturity. [Project repository](https://github.com/taserjs/taserjs).

**hono-fsr** also documents filesystem routing, middleware files, manifests, and bundler integrations. This establishes another implementation reference, not verified parity with the desired type generation. [Project repository](https://github.com/itsbrunodev/hono-fsr).

## Suggested first implementation boundary

Recommendation, not an approved product specification:

1. A generator core independent of Vite: adapt TanStack's discovery, hierarchy, source-identity transforms, and file writer; emit real TypeScript for the API route graph. Keep static route imports and type references rather than executing route modules during discovery.
2. Establish a Start server-route compatibility suite using retained convention fixtures. Start the spike with index, static, `$param`, flat/nested routes, and ignored files, then cover the richer conventions. Define duplicate-path behavior against source tests: current Start documentation is inconsistent between its method-collision and unique-handler-file descriptions.
3. A typed `Route` object and Start-style request middleware builder, plus a Hono bridge. Preserve response/input type information for Hono clients explicitly; the earlier handler-tuple experiment proves a lower-level seam, not this entire facade. Offer a Hono entry point for bindings and existing Hono middleware.
4. A Vite plugin that runs the same generator before serving/building, watches adds/changes/deletes, and invalidates the server module graph so the next application instance reflects changed routes. Use atomic writes, deterministic ordering, and write only when content changes to avoid watch loops.
5. Reuse `@hono/vite-dev-server` for the development request bridge. It already loads a fetch-compatible server entry through Vite. Production still needs an explicit runtime/build adapter; a file-routing plugin alone is not a deployment system. [Official dev-server documentation](https://github.com/honojs/vite-plugins/blob/main/packages/dev-server/README.md).
6. Provide a standalone `generate` command for CI, editors before dev startup, and non-Vite builds. Clean checkout ordering must be generation, then typecheck/build.

The next useful spike is a vertical slice: add/rename/delete `users.$userId.ts`, keep its identity current, observe type errors update, call the generated client, and run the built fetch entry with no filesystem scanning at runtime. Include a validator and two HTTP methods in that slice.

For later middleware inheritance, preserve filesystem ancestry separately from URL shape: pathless groups can share a URL prefix but require different middleware. Never mark authenticated context as present unless the actual runtime chain guarantees it. Other explicit design decisions include static/dynamic precedence, trailing slashes, splats, optional parameters, 404/405 behavior, and HEAD/OPTIONS. Hono 4 dispatches HEAD through GET and removes the body, so simply generating a HEAD registration would not establish independent HEAD behavior. [Pinned Hono dispatch implementation](https://github.com/honojs/hono/blob/v4.13.13/src/hono-base.ts#L416-L419).

For large APIs, measure editor/typecheck cost before promising unlimited inferred route aggregation; Hono documents type-instantiation costs and suggests declaration compilation and splitting clients. [Hono RPC performance guidance](https://hono.dev/docs/guides/rpc#known-issues).

If the product is aimed at agent consumers, a machine-readable endpoint manifest and OpenAPI output would add concrete value. These need runtime schemas or explicit contract metadata; inferred TypeScript responses alone do not provide an automatically enforceable wire contract. Hono's Zod OpenAPI integration is an existing basis for schema-driven descriptions. [Official example](https://hono.dev/examples/zod-openapi).

## Start-like API with Standard Schema and explicit middleware

The intended authoring model is one named `Route` export with a method table, matching Start's server-route structure. The following is a **proposed API sketch**, not currently implemented or a claim about existing Start syntax. It promotes `server.middleware` and `server.handlers` to top-level options because every route in this library is a server route. Keeping the `server` wrapper is also possible if literal syntax compatibility is preferred.

```ts
// routes/teams.$teamId.posts.ts
import { createFileRoute } from 'eldjs'
import { z } from 'zod'
import { requireUser } from '../middleware/auth'

const params = z.object({ teamId: z.string().uuid() })
const query = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default(1),
})

export const Route = createFileRoute('/teams/$teamId/posts')({
  middleware: [requireUser],
  handlers: ({ createHandlers }) => createHandlers({
    GET: {
      validate: { params, query },
      handler: ({ input, c }) => c.json({
        teamId: input.params.teamId,
        page: input.query.page,
      }),
    },
    POST: {
      validate: {
        params,
        json: z.object({ title: z.string().min(1) }),
      },
      handler: ({ input, context, c }) => c.json({
        teamId: input.params.teamId,
        title: input.json.title,
        authorId: context.user.id,
      }, 201),
    },
  }),
})
```

`validate` and `input` are proposed additions. `c` exposes Hono's context/response helpers; `context` represents explicitly composed middleware output. The two should have documented roles so middleware typing and Hono bindings are not confused. Preserve native `Request` access for streaming and custom body handling. GET query validation and path-parameter validation are separate targets; GET bodies are not required for query support.

Middleware can live in any ordinary module, with a familiar builder:

```ts
// middleware/auth.ts — proposed API
export const requireUser = createMiddleware().server(
  async ({ request, next }) => {
    const user = await authenticate(request)
    if (!user) return new Response('Unauthorized', { status: 401 })
    return next({ context: { user } })
  },
)
```

Attach it through a global request middleware list, a route's `middleware` array, or a method's `middleware` array. Parent/pathless route attachments can be inherited, and break-out routes can escape that ancestry as in Start. This does not require a filename that implicitly registers middleware. Middleware dependency composition, before/after execution, short-circuit responses, and typed `next({ context })` propagation are the relevant compatibility behaviors. [Start server routes](https://tanstack.com/start/latest/docs/framework/react/guide/server-routes), [request middleware types](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/start-client-core/src/createMiddleware.ts).

### Validation that is reused versus added

Current Start distinguishes request middleware from server-function middleware. Only the function side exposes the typed `.validator()` API in the inspected version; HTTP route method options expose handlers and middleware. Its server-function executor already supports Standard Schema, but that is not built-in schema validation of raw HTTP body/query/path targets. The new library should make those targets first-class. [Server-route method types](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/start-client-core/src/serverRoute.ts), [validator execution](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/start-client-core/src/createServerFn.ts#L873).

Accept `StandardSchemaV1` at the public boundary. Validation must await `schema['~standard'].validate(value)`, return its transformed value on success, and normalize its issues on failure. Preserve **input and output as different types**: a wire query can accept `page: string` while the handler receives `page: number`. Support async schemas and defaults. Standard Schema itself does not specify HTTP extraction, repeated-query parsing, content-type handling, or error status/shape; those need an explicit library policy. [Standard Schema specification](https://standardschema.dev/).

`@hono/standard-validator` already supplies target-specific validation for Hono, including the mapping from schema input/output types to `c.req.valid()`. It is a strong reusable implementation boundary. Our method-level `validate` object can lower to that middleware rather than requiring users to manually wire validators. Use its hook to produce a stable framework error shape; its existing default need not become our public error contract. [Hono validation guide](https://hono.dev/docs/guides/validation#standard-schema-validator-middleware), [adapter implementation](https://github.com/honojs/middleware/blob/main/packages/standard-validator/src/index.ts).

Keep asynchronous validation after route selection. Do not insert it into synchronous route-matching parameter parsing. Ordinary invalid input should produce a deliberate HTTP validation response; an unexpected thrown schema/programming error should not automatically be treated as an ordinary input issue.

### Additional verified experiment

In the same disposable probe directory, installed `@hono/standard-validator@0.4.0`, `@standard-schema/spec@1.1.0`, `zod@4.6.7`, and `valibot@1.5.0`. Both `tsc --pretty false` and `tsx standard-probe.ts` passed. The experiment used the lower-level helper above, not the proposed Start-like facade.

- Zod path parameters and Valibot query parameters validated and transformed strings into numbers.
- Compile-time exact-type assertions kept client parameters/query values as strings and inferred numeric handler/response values.
- A missing query value received a schema default.
- JSON body validation awaited an asynchronous Zod transform.
- Explicit Hono middleware contributed a typed user, short-circuited unauthenticated requests with 401, and set a response header after the handler.
- Invalid path parameters, query values, and JSON payloads returned 400.
- Incorrect client input types failed compile-time negative checks.

This validates the schema/middleware/Hono integration components. The Start-style builder, inherited middleware context types, code generation, and its Hono client type projection remain work to implement and test.

## Concrete source extraction plan

All TanStack paths below refer to pinned commit `18154b1c45454a70aa77e9d6d27c8a6e0733d031`. These are adaptation candidates established by source inspection, not claims that they can all be imported unchanged.

| Area | Retain | Adapt |
| --- | --- | --- |
| Route compiler | `router-generator/src/filesystem/**`, tree/path helpers, parameter validation, generator traversal/event queue/cache/concurrent writes | Target configuration, templates, source import rewriting, route tree/type emission; remove UI component fragments |
| Watching and CLI | Generator plugin orchestration and CLI generate/watch loops | Use our generator target; exclude browser component splitting |
| Route model | File identity/module augmentation and server method/context type patterns | Own `ApiRoute` type in place of UI route, loader, rendering and Start-global generics |
| Request middleware | Request builder, context merging/inference, dependency flattening, safe merge utility | Hono execution bridge; remove server-function RPC and client middleware branches |
| Validation | Standard Schema execution/type patterns | HTTP target extraction and a stable validation response contract; prefer existing Hono adapter |
| URL matching if full parity requires it | Generic route processing/branch construction/matching in `router-core/src/new-process-route-tree.ts` | Owned dispatcher or Hono adapter, small dependencies and cache |

Source entry points: [generator](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-generator/src/generator.ts), [watch integration](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-plugin/src/core/router-generator-plugin.ts), [file route typing](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-core/src/fileRoute.ts), [server route typing](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/start-client-core/src/serverRoute.ts), [request middleware](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/start-client-core/src/createMiddleware.ts), [matcher](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-core/src/new-process-route-tree.ts).

Keep extracted code and fixtures traceable to upstream, preserve the MIT notice, and record local adaptations. Upstream fixes still need deliberate review; extracting code does not automatically inherit future fixes. There is no evidence-based percentage estimate for how much code will remain unchanged.

### Compatibility work that source reuse does not remove

**Dispatch semantics:** Start selects the URL route before selecting its method and supports an explicit HEAD handler, GET fallback, then ANY. Default Hono 4 routing selects method/path together and dispatches HEAD as GET before matching. A straightforward `.get/.post` emitter will not automatically reproduce all overlapping-route or HEAD cases. A Hono catch-all can delegate using the original request method to an extracted Start-style dispatcher, but then Hono's typed client needs a generated endpoint schema bridge. We should test these two designs against the parity suite before selecting the runtime structure. [Start server dispatch](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/start-server-core/src/createStartHandler.ts), [Hono dispatch](https://github.com/honojs/hono/blob/v4.13.13/src/hono-base.ts#L416-L419).

**Type preservation:** Start's route handler contract accepts Web Responses; it does not directly provide Hono's inferred JSON response schema. The new route builder must retain each handler's concrete return and schema input types through code generation. Copying its types unchanged would not establish `hc` support.

**Middleware composition:** Start-style `next({ context })` and Hono's mutable context plus `next()` have different contracts. An explicit bridge must preserve ordering, short-circuiting, before/after execution, and error handling. Flattening deduplicates by identity within a flatten call; do not promise universal deduplication across every parent/child/handler attachment without implementing and verifying it.

**Retained tests:** Start from generator convention/transform/config/concurrent-write fixtures; request middleware type tests in `start-client-core/src/tests/createServerMiddleware.test-d.ts`; selected runtime route/context/HEAD cases in `start-server-core/tests/createStartHandler.test.ts`; and optional/prefix/suffix/splat matcher tests. Adapt their expected generated output and add schema input/output and client typing checks. The inspected `start-server-core/tests/serverRoute.test-d.ts` has its substantive old cases commented out, so it should not be counted as existing coverage.
