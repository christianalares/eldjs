# Eld

Typed file-based APIs with Hono, Standard Schema validation, and TanStack routing conventions.

Experimental 0.x preview; the API may change between minor releases. Install from the `next` tag:

```sh
pnpm add @eldjs/core@next hono
pnpm add -D @eldjs/dev@next
```

```ts
import { createFileRoute, createHandler } from '@eldjs/core'
import { z } from 'zod'

// This definition can live in a separate module.
const createPost = createHandler({
  validate: { json: z.object({ title: z.string().trim().min(1) }) },
  handler: ({ c, input }) => c.json({ title: input.json.title }, 201),
})

// src/routes/posts.ts; the generator supplies the path registry.
export const Route = createFileRoute('/posts')({
  handlers: { POST: createPost },
})
```

Export a `createRootRoute()` as `Route` from `src/routes/__root.ts`, generate the route tree with `pnpm exec eld generate`, and pass it to `createApp({ routeTree })`. The result is a Hono app with a Fetch handler and typed Hono client schema.

Install `@eldjs/core` and `hono` as application dependencies, and `@eldjs/dev` as a development dependency. Hono is a peer dependency so your app and Eld share the same installation. Install your chosen schema library as an application dependency when using validation; Eld's runtime does not require Zod.

Use `eld()` from `@eldjs/dev/vite` with Vite, or `pnpm exec eld watch` for standalone generation. Programmatic generation is available from `@eldjs/dev`. The `eld` executable belongs to that tooling package. Middleware is explicit and imported; handlers can use any Standard Schema v1 implementation for params, query, JSON, form, and header validation.

Build with the development dependencies installed, then deploy the compiled application with only production dependencies. No generator, watcher, CLI, or development server is needed to handle requests. Runtime imports use `@eldjs/core`. The former `eldjs/vite` and `eldjs/generator` exports have moved to `@eldjs/dev/vite` and `@eldjs/dev`, respectively.

`GET`, `HEAD`, and `ANY` reject JSON/form validators. Attach body validators to explicit `POST`, `PUT`, `PATCH`, `DELETE`, or `OPTIONS` handlers; those can also validate query parameters. The check applies to inline and extracted handlers, both in TypeScript and when routes are created at runtime.

`validate` autocompletes supported targets and rejects unknown keys. The handler helpers also check declared parameter schema input keys against the route: `/teams/$teamId` supplies `teamId`, so a schema requiring `hello` is a type error. Extracted handlers are checked when attached to a route. Output transforms remain unrestricted; schemas whose input types expose no named keys cannot receive this check.

For parameters, use `validate: { params: { teamId: z.string().min(1) } }` to autocomplete route parameter names and get errors on invalid fields. Each field accepts any Standard Schema implementation, supports async transforms and defaults, and appears in `input.params` with its output type. The object-schema form (`params: z.object({ ... })`) remains supported for validation across fields and object transforms. Other targets still take a single schema.

Every configured `validate.X` produces `input.X`: validated parameters are in `input.params`, headers in `input.headers`, and so on. Without validators (including an empty `validate` object), `input` is absent from the handler type and runtime context. `params` always holds the original decoded path values, and `request.headers` provides the original headers.

The runtime matcher is adapted from TanStack Router's MIT-licensed source. The generator lives in `@eldjs/dev`. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). This is an independent project and an initial implementation, not a complete TanStack Start replacement.
