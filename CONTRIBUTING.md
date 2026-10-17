# Contributing to Eld

Use Node 24 and the pnpm version pinned in `package.json`. This repository uses pnpm workspaces and Turborepo.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

`packages/eldjs` contains the request runtime and public types. `packages/dev` contains the generator, standalone CLI, and Vite plugin. `apps/api` consumes both through `workspace:*` and demonstrates the public API.

Before submitting a change:

```sh
pnpm check
pnpm check:packages
```

The first command builds, type-checks, and tests the workspace. The second installs actual tarballs in a separate project, checks generated declarations and client types, and runs the API with only production dependencies installed. It needs registry access for the fixture's dependencies.

Keep `apps/api/src/routeTree.gen.ts` committed so editor types work after checkout. Generation updates that file automatically; edit the route sources instead.

Changes to type inference should cover accepted and rejected usages in the existing type fixtures. Changes to request behavior should cover the response through `app.request()` or Hono's client. Keep development tooling out of the runtime package.

Adapted TanStack source lives under `src/vendor` in each package. Preserve its MIT notices and record the upstream revision when updating it. This repository is independently maintained.
