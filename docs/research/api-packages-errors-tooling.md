# API packages, error responses, and TanStack tooling

Investigated 2026-10-17. This records current implementation findings, source-backed comparisons, and proposed API direction. The proposals below are not implemented.

> Historical snapshot: Eld now declares Hono as a peer dependency and includes automatic validation errors and typed Eld middleware responses in its client schema. The descriptions of those gaps below record the state during the investigation.

## Recommendation

Treat an API as a reusable package with a small deployment application around it. Keep Hono's `Context`, `Response`, `c.json`, `hc`, and `onError` as the underlying HTTP primitives. Add a small typed response helper for named HTTP errors and explicit customization for errors produced by Eld itself. Continue adapting TanStack's generator and watch integration, without importing Start's page-rendering or server-function compilation pipeline.

The important release gap is not just prettier error names: framework-generated errors and custom error responses must appear in the exported client contract. A response that is typed as success-only while validation can actually return 400 or 415 is an incomplete contract.

## Reusable package boundaries

An application can put its reusable API in `packages/api-core`. These are proposed package exports, not a requirement to introduce four separate packages:

| Export | Responsibility | Consumers |
| --- | --- | --- |
| `/server` | Route tree, HTTP handlers, `createApi(dependencies)` factory | API deployment app, server-side tests |
| `/client` | Hono `hc` wrapper and public request/response types | BFF, other services, browser code where appropriate |
| `/contracts` | Browser-safe Standard Schema validators and shared data contracts | Server, BFF/forms |
| `/domain` | Domain operations usable without an HTTP request | HTTP handlers, workers |

`apps/api-server` should own environment loading, database/job clients, process lifecycle, and the Node listener. It supplies dependencies to the package's factory. `apps/web` imports the package's client/contracts; workers import its domain operations. Neither needs to import another application's source.

For a pure client export, use `import type` for the server type. That prevents runtime evaluation of server imports, but is not the whole packaging test: inspect emitted declarations for transitive private/server imports, inspect the client runtime bundle, verify importing it does not evaluate environment variables or initialize connections, and compile a consumer using two independent API clients. Hono recommends precompiling client types to reduce repeated type-instantiation work and documents problems caused by mismatched Hono versions. [Hono RPC package guidance](https://hono.dev/docs/guides/rpc#compile-your-code-before-using-it-recommended)

A compatibility probe used Hono 4.13.7 in the consumer and Eld's 4.13.13 dependency. Native Hono injection and `hc` typing failed with the split versions and passed when the version was shared. Proposed fix: make Hono a peer dependency, retain a dev dependency for Eld's own tests, and test the declared supported range. This is an observed integration result, not a claim that every pair of Hono versions is incompatible.

A focused temporary-project probe created two independent APIs with the same `/health` path and different root middleware contexts (`one` and `two`). Each API built declarations successfully on its own. A consumer importing both compiled `dist/client.d.ts` entry points passed with `skipLibCheck: false` and exact literal response-type checks. The emitted client declarations referenced Hono client/status types, without a route-tree or server-runtime import.

The equivalent consumer importing both `src/client.ts` files failed: the second route received the first API's inferred context, so `context.two` was missing. The shared `FileRoutesByPath` module augmentation collides when independently generated route graphs coexist in one TypeScript program. This does **not** mean two compiled clients inevitably collide. Recommend built `/client` exports now, with this probe converted into a regression test. Supporting source-level authoring of multiple APIs in one TypeScript program would require an API-scoped registry/environment instead of the current shared globals.

## What is standardized about error names?

The standards define numeric HTTP status codes and their semantics. IANA registers descriptions such as “Not Found” for 404 and “Method Not Allowed” for 405. They do not prescribe TypeScript identifiers such as `NOT_FOUND`. RFC 9110 also makes clear that reason phrases themselves are advisory. Uppercase snake case is therefore a useful library convention built on the standard, not a separate HTTP naming standard. [IANA status registry](https://www.iana.org/assignments/http-status-codes), [RFC 9110 §15.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.1)

tRPC has its own named codes mapped to HTTP statuses, plus an RPC error envelope. Some names differ from current HTTP descriptions: `METHOD_NOT_SUPPORTED` maps to 405, `TIMEOUT` to 408, and `PAYLOAD_TOO_LARGE` to 413. Its `CLIENT_CLOSED_REQUEST` maps to an unregistered 499. Borrowing the ergonomic idea does not require importing those choices or the tRPC protocol. [tRPC error codes](https://trpc.io/docs/server/error-handling#error-codes)

Proposed Eld names should follow current HTTP descriptions: `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `METHOD_NOT_ALLOWED`, `REQUEST_TIMEOUT`, `CONFLICT`, `CONTENT_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `UNPROCESSABLE_CONTENT`, `TOO_MANY_REQUESTS`, and `INTERNAL_SERVER_ERROR`. Domain identifiers such as `CHANNEL_ARCHIVED` are a different layer and have no universal status mapping; applications can include those in typed JSON bodies.

Hono already exports numeric status unions such as `ClientErrorStatusCode`, `ServerErrorStatusCode`, and `ContentfulStatusCode`; its checked status utility does not provide a named runtime constant table. A small Eld table can be constrained by those Hono types. [Hono 4.13.13 status types](https://github.com/honojs/hono/blob/v4.13.13/src/utils/http-status.ts)

### Problem Details is an optional wire format

RFC 9457 standardizes a JSON error representation using `application/problem+json`, with `type`, `title`, `status`, `detail`, and `instance` members. `type` is the primary problem identifier and is a URI reference; it is not an uppercase code. Additional members, such as `code` or validation issues, can be extensions. Any body `status` must agree with the actual HTTP response status. Its validation example does not mandate a particular validation-issue representation for all APIs. [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html)

Recommendation: do not make Problem Details mandatory just to obtain named errors. Keep the default JSON shape small and let a customization hook return a typed Problem Details response when a service needs it. If Eld later ships a `problem()` helper, it should implement the actual media type and fields instead of calling an ordinary `{ error: ... }` object “RFC compliant.”

## Explicit returned errors that stay close to Hono

Proposed API sketch:

```ts
import { errorResponse } from 'eldjs'

handler: async ({ c, params, context }) => {
  const channel = await context.channels.find(params.channelId)

  if (!channel) {
    return errorResponse(c, 'NOT_FOUND', {
      message: 'Channel not found.',
    })
  }

  return c.json({ channel }, 200)
}
```

The proposed helper returns an ordinary Hono JSON response with HTTP 404 and a default body such as `{ error: { code: 'NOT_FOUND', message: 'Channel not found.' } }`. It does not throw or alter handler control flow. Plain `return c.json(body, 404)` remains supported. The smallest proposed primitive is a literal-preserving constant such as `HTTP_STATUS.NOT_FOUND`, used as `return c.json(body, HTTP_STATUS.NOT_FOUND)`. The helper is an optional convenience for consistent bodies, not a replacement for Hono responses.

Hono's RPC documentation recommends explicit status-bearing `c.json` responses for inferable error outputs. Global `onError` and global middleware responses are not automatically included; Hono supplies `ApplyGlobalResponse` for an explicit shared contract. [Hono RPC response typing](https://hono.dev/docs/guides/rpc#status-code)

An in-memory TypeScript probe against the installed Hono 4.13.13 verified the essential helper shape:

```ts
const status = { NOT_FOUND: 404, BAD_REQUEST: 400 } as const

function errorResponse<C extends keyof typeof status>(
  c: Context,
  code: C,
  message: string,
) {
  return c.json({ error: { code, message } }, status[code])
}
```

For a route returning this helper or `c.json({ name: 'example' }, 200)`, `InferResponseType<Endpoint, 404>` was exactly `{ error: { code: 'NOT_FOUND'; message: string } }`, and the 200 result remained `{ name: string }`. The probe had zero compiler diagnostics and wrote no implementation files. A production implementation still needs tests for custom data, middleware headers, status narrowing, and schema projection through Eld.

Hono's `HTTPException` remains appropriate for exceptions from middleware or nested application code. It supports a numeric status, a message or custom response, and a cause; Hono handles it through `onError`. It is not a way for TypeScript to infer checked thrown-error unions. `getResponse()` also does not know about headers already set on `Context`, so a response helper using `c.json` is a better default for explicit handler returns. [Hono HTTPException](https://hono.dev/docs/api/exception), [checked implementation](https://github.com/honojs/hono/blob/v4.13.13/src/http-exception.ts)

## Customization and typing gaps in Eld today

Local source inspection found:

- `validation.ts` throws `InputError` with status 400 for validation/malformed input and 415 for unsupported JSON/form content types. The response is currently `{ error: 'VALIDATION_ERROR', target, issues }` for both statuses.
- `app.ts` catches `InputError` and responds before Hono's `onError` can see it. It also generates its own JSON 404 and 405 inside its catch-all route; a user Hono `notFound` handler cannot customize these responses today.
- `client-types.ts` projects handler return values only. Its current `ApiSchema` does not include the runtime validation errors or early responses from Eld middleware. Existing success/client checks therefore do not establish a complete error contract.

Sources: [`validation.ts`](../../packages/eldjs/src/validation.ts), [`app.ts`](../../packages/eldjs/src/app.ts), [`client-types.ts`](../../packages/eldjs/src/client-types.ts).

Recommended design constraints:

1. Add focused customization for framework-produced errors: validation failure, malformed body, unsupported media type, route not found, and method not allowed. A hook can return a Hono response or defer to the default. Do not silently change already returned handler responses.
2. Keep unexpected exceptions on Hono's existing `onError` path. Users can map known domain error classes there. Unknown failures should get a generic 500 response; arbitrary exception messages, causes, database details, and stacks should not automatically become public fields.
3. Preserve current HTTP distinctions: 400 for invalid/malformed input, 415 for unsupported content type. Applications may deliberately choose 422 for semantic validation. A broad customization hook must not accidentally turn unsupported media into a validation 400. A discriminated error category would be clearer than inferring the cause from the issue message.
4. Infer each hook's typed response into the appropriate client route union. Include default validation errors only where validation can run, include the default branch when a hook can defer, and keep status/body relationships. Never widen a helper or hook to plain `Response` prematurely. An explicit `ApplyGlobalResponse` contract is a useful Hono escape hatch for genuinely global responses; do not claim arbitrary thrown errors are automatically inferred.
5. Retain `Allow` on 405, response headers set by middleware, and HEAD's body behavior. Do not echo raw submitted payloads in the default error body.

Hono's Standard Schema adapter already demonstrates a validation-result hook that can return a custom response and carries a generic response type. Its default failure uses 400. This is a closer model to borrow than a new exception hierarchy. [Standard Schema adapter source](https://github.com/honojs/middleware/blob/main/packages/standard-validator/src/index.ts)

tRPC's formatter-to-client type propagation is the useful feature to emulate: choosing a custom shape should alter the client contract. Its implementation is not a drop-in Hono response layer. [tRPC error formatting](https://trpc.io/docs/server/error-formatting)

## Reusing TanStack's build and watch machinery

The checked TanStack source is pinned to commit `18154b1c45454a70aa77e9d6d27c8a6e0733d031`. Eld already adapts the generator's scanning, route-node cache, event queue, atomic writes, route-identity rewriting, and generated module augmentation. Its Eld target is an adaptation: upstream's target enum only has React, Solid, and Vue, and the generator plugin hooks (`init`, `afterTransform`, `onRouteTreeChanged`) are not a general arbitrary-runtime output interface. [Generator configuration](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-generator/src/config.ts), [plugin hooks](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-generator/src/plugin/types.ts)

There are two relevant upstream integrations to reuse selectively:

- The Router CLI watches configuration and route files with Chokidar and reconstructs the generator when configuration changes. [CLI watcher](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-cli/src/watch.ts)
- The Router bundler integration uses `unplugin`, with Vite and other build-tool hooks including esbuild setup. This is a useful adapter pattern; it does not require Start's SSR or server-function compilation pipeline. [Generator plugin](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-plugin/src/core/router-generator-plugin.ts)

Eld currently has its own CLI watcher and Vite integration around the adapted generator. Its watch paths cover physical route directories, cached route files, and virtual configuration. One concrete gap is documented in Eld's README: changing `eld.config.json` requires restarting the watcher/server. Upstream's CLI already rebuilds the generator on configuration changes, so this is a useful next behavior to reuse. Reuse should mean comparing behavior and retaining upstream fixtures where compatible, rather than replacing a working API runtime with Start internals. [Current Eld limitation](../../README.md#vite-and-cli)

Schema edits and route-graph edits are different kinds of changes. A changed imported schema normally needs TypeScript to update inferred types and the application build tool to reload its dependency graph; there is no separate runtime schema code generator to copy. Adding/removing/moving route files changes the generated route graph. Packages that expose built declarations also need their `tsc` watch/build to refresh those declarations before consumers check types. The task dependency is: generate route graph, build package JS/declarations, then check/build consumers. These are architecture deductions from Eld's source imports and generated type model.

TanStack's own generator package uses `@tanstack/vite-config` with `tanstackViteConfig`; its package checks include `publint`, `@arethetypeswrong/cli`, and multiple TypeScript versions. These are useful candidates for shared development tooling and release checks. Evaluate that exact config package's assumptions before adopting it; retain pnpm and Turborepo, and do not infer that adopting TanStack's generator requires adopting its whole repository toolchain. [Generator Vite config](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-generator/vite.config.ts), [generator scripts](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-generator/package.json)

Existing `tsx`/esbuild applications can keep those tools and call the standalone route generator. Vite remains an optional development/build adapter rather than a required deployed runtime.

## Proposed next work

1. Establish an API-package example consumed by a deployment app and a second consumer, including a shared Hono peer and verified client-only imports/declarations.
2. Introduce the small returned-response helper and a consistent default error body; make framework and customized error outputs visible to `hc`.
3. Add the framework-error customization seam while retaining Hono `onError` for exceptions.
4. Close package isolation gaps found by the two-API probe, and test route/schema changes across built workspace packages.
5. Add package-level publication checks and reuse compatible TanStack tooling patterns. Scaffolding should follow the proven package layout.

These are historical recommendations for an implementation plan, not claims of completed features. See the current README for implemented behavior.
