# TanStack package reuse and Eld maintenance

Investigated 2026-10-17. This records source inspection and isolated experiments; it does not replace Eld's generator or change its public API. No published packages or repository dependencies were changed by this investigation.

## Implementation follow-up

The subsequent packaging change split the runtime (`eldjs`) from development tooling (`@eldjs/dev`), made Hono a peer dependency, and removed the constant-only router-core dependency. The generator remains adapted source in `packages/dev`; the experimental upstream patch has not been integrated. Measurements and recommendations below describe the earlier combined package. See the root README for the current setup and `pnpm check:packages` for the external-consumer regression check.

## Generator recommendation

The published generator is close to usable through a small Eld adapter, but cannot currently preserve Eld's source imports unchanged. Prefer a small upstream extension over rewriting routing conventions or hiding a source-rewriting shim inside a virtual filesystem. Until that extension exists, retain a narrowly tracked adaptation and reduce its distribution/maintenance cost separately.

At investigation time, Eld maintained 16 generator source files, totaling 5,306 lines including comments and blank lines. Most are unchanged upstream logic apart from ESM import extensions. The substantive changes are Eld templates/import recognition, the `api` target/config filename, rejection of UI split files, and exposing watch dependencies. [Generator provenance](../../packages/dev/THIRD_PARTY_NOTICES.md), [Eld generator wrapper](../../packages/dev/src/generator.ts)

## What the real package exposes

The npm registry returned `@tanstack/router-generator@1.167.45`, with an unpacked package size of 936,021 bytes. It depends on router-core 1.171.38, router-utils 1.162.4, virtual-file-routes 1.162.0, Babel types, Jiti, Magic String, Prettier, and Zod. These are package-install facts, not production bundle measurements. Eld's copied generator came from 1.167.44. The generator and transform source relevant to this investigation are unchanged between that pinned checkout and the downloaded 1.167.45 package. [Registry metadata](https://registry.npmjs.org/@tanstack/router-generator/latest), [Published package](https://www.npmjs.com/package/@tanstack/router-generator)

The package exports `Generator`, configuration schemas/functions, `physicalGetRouteNodes`, `virtualGetRouteNodes`, route-node types, and selected utilities. Its class declarations expose `targetTemplate`, `config`, `run`, `getRoutesByFileMap`, `getCrawlingResult`, and `buildRouteTree`. In particular, `targetTemplate` really is public; using it through a plugin's `init` hook does not require casting away a private member. The package export map does not expose the transform implementation or arbitrary internal files. Actual deep-import probes failed with `ERR_PACKAGE_PATH_NOT_EXPORTED`. [Exports](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-generator/src/index.ts), [Class surface](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-generator/src/generator.ts#L202-L274), [Export map](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-generator/package.json)

The supported plugin hooks are `init({ generator })`, `afterTransform({ node, prevNode })`, and `onRouteTreeChanged({ routeTree, routeNodes, rootRouteNode, acc })`. Neither latter hook receives or returns route source text. `afterTransform` executes after the built-in transform; the tree-change hook executes after the generated file is written. [Plugin hooks](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-generator/src/plugin/types.ts), [Transform lifecycle](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-generator/src/generator.ts#L1096-L1159)

## The direct-package blocker, demonstrated

Setting `generator.targetTemplate.fullPkg = 'eldjs'` correctly changes generated type augmentation and tree imports. Custom templates can also scaffold Eld routes. However, the built-in route transform independently constructs `@tanstack/${ctx.target}-router`; the config supports only `react`, `solid`, and `vue`. It does not use `targetTemplate.fullPkg` for import recognition. [Transform implementation](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-generator/src/transform/transform.ts#L122-L168), [Configuration](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-generator/src/config.ts#L23-L80)

The isolated probe installed the real published package, supplied an Eld template plugin, and generated an existing Eld route. It updated the stale route identity and emitted `declare module 'eldjs'`, but wrote both imports:

```ts
import { createFileRoute } from '@tanstack/react-router'
import { createFileRoute } from 'eldjs'
```

A fresh generator instance then failed with `SyntaxError: Identifier 'createFileRoute' has already been declared`. Reusing the same instance without a file change did not detect it because the route was cached. Probe: `/tmp/eld-upstream-generator-UYl4e4/probe.mjs`; fixture: `/tmp/eld-direct-generator-probe-mzTGku`.

Renaming the route-constructor identifier could avoid the built-in transform, but would also lose automatic path correction and rename support. Mapping the React package name to Eld would burden consumer module resolution and violate the desired import API. Neither is an appropriate simplification.

## A small upstream extension is promising

An isolated copy of the published ESM output was modified to pass `importSource: this.targetTemplate.fullPkg` into the transform and use it when recognizing/writing imports. The corresponding source change would additionally add `importSource?: string` to `TransformContext`. This is a proposed extension, not an available upstream capability.

With that change and the existing public template/plugin API, the prototype passed root scaffolding, route scaffolding, Eld imports, stale route-ID correction, file renaming, deletion, and emission of Eld type augmentation. These were file-content/behavior assertions, not a TypeScript compilation of the resulting API. Probe: `/tmp/eld-upstream-generator-UYl4e4/patched-probe.mjs`; fixture: `/tmp/eld-generator-extension-probe-ZeDZAS`. It did not certify all routing conventions or a production replacement.

For a complete adapter, also account for:

- Eld's `eld.config.json`, because upstream `getConfig` reads `tsr.config.json`. We must not accidentally consume another application's TanStack Router configuration.
- Rejecting page-specific lazy/component/loader split files before generating an unusable API tree. Current hooks alone do not provide the same early preflight point.
- Public watch dependencies. Upstream tracks mounted physical directories privately; known route files can be obtained through `getRoutesByFileMap`, but that does not discover newly added files in an otherwise empty mounted directory. Eld currently exposes those directories explicitly.
- Keeping the `.js` import-extension setting, Eld templates, default paths, and error messages in the adapter.

The strongest upstream request is therefore a configurable import source consistently derived from the target template, plus access to generator watch dependencies and an early route-node validation hook. This would let Eld reuse the package's cache, hierarchy construction, escape handling, transform safety, and atomic writes. [Watch/relevance state](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-generator/src/generator.ts#L1627-L1662), [Atomic writes](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-generator/src/generator.ts#L1203-L1287)

## Alternatives and their costs

| Approach | What it preserves | Remaining cost |
| --- | --- | --- |
| Public generator plus upstream extension | Full generator lifecycle and current Eld route API | Small adapter and compatibility tests; depends on upstream accepting/releasing the extension |
| Public filesystem scanners plus our emitter | File conventions, virtual routes, mounted directories | We own source correction, scaffolding, parent relationships, type emission, caches, race-safe writes, and watching |
| Public generator with a translating filesystem | Potentially most of the lifecycle | Source translation around read/write caches and temporary atomic-write files; fragile coupling disguised as filesystem behavior |
| Small pnpm patch, bundled into Eld's tooling build | Upstream package baseline with reviewable changes | Still a maintained derivative; build must incorporate patched code and preserve notices |
| Current source adaptation | Existing tested behavior | Roughly 5,300 copied lines and manual upstream merges |

The scanners are useful public APIs, but return route nodes and mounted directories rather than the completed typed hierarchy. `Generator.buildRouteTree` still expects an accumulator built by private hierarchy-processing logic. Scanner-only reuse is possible but not a drop-in simplification, and retaining a large local generator while installing the complete upstream generator can duplicate code. [Physical scanner](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-generator/src/filesystem/physical/getRouteNodes.ts), [Virtual scanner](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-generator/src/filesystem/virtual/getRouteNodes.ts), [Tree builder](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-generator/src/generator.ts#L604-L622)

The constructor's filesystem injection is public, but covers file reads/writes/stats rather than the complete scanner filesystem. Scanners call Node filesystem APIs themselves. Rewriting import sources through it would require care with cached content, temporary files, and concurrent user edits; no such adapter was implemented or validated here. [Filesystem contract](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-generator/src/generator.ts#L61-L138)

pnpm records patches in the consuming project's top-level configuration. A library dependency does not automatically apply Eld's development-workspace patch configuration in a customer's project. Consequently, a patch strategy must bundle the patched generator into our distributed tooling, publish a maintained fork, or ask consumers to patch their own installation. The first can be reasonable; the last undermines simple installation. This distribution conclusion follows from pnpm's project-level patch model. [pnpm patch documentation](https://pnpm.io/cli/patch)

## Watchers and bundler plugins

Upstream's CLI watcher reloads configuration and recreates its generator on config changes; that behavior is worth reusing. Its CLI watcher itself watches `routesDirectory`, so copying it alone does not preserve Eld's additional mounted-directory watching. The published router plugin creates the same framework-targeted generator internally, so it inherits the import-source blocker. Its cross-bundler hooks are useful reference code once a proper Eld generator adapter exists. [CLI watcher](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-cli/src/watch.ts), [Bundler generator plugin](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-plugin/src/core/router-generator-plugin.ts)

Schema changes inside handler modules need TypeScript/module rebuilding, not a separate schema generator. Routing generation should remain concerned with the file graph and route identities; built shared packages also need declaration watching. [Existing package/tooling investigation](./api-packages-errors-tooling.md)

## Runtime, bundles, and dependency packaging

The main investigation separately measured the installed Eld/Hono versions using esbuild 0.28.2, minified ESM, `target: es2022`, neutral platform, the `worker` condition, and a production environment define. Each application exposed one parameterized GET endpoint and was fully bundled. Results are in `/tmp/eldjs-reuse-measurements.json`.

| Measurement | Minified bytes | Gzip bytes |
| --- | ---: | ---: |
| Plain Hono application | 18,405 | 7,725 |
| Eld application including Hono | 32,161 | 12,763 |
| Difference in this fixture | 13,756 | 5,038 |
| Eld's standalone copied matcher | 8,396 | 3,349 |
| Public router-core class exports: `RouterCore`, `BaseRoute`, `BaseRootRoute` | 66,538 | 23,343 |

The runtime bundle metafile contains no generator, Zod, Prettier, or Babel. Therefore removing copied generator code is primarily a maintenance/install concern, not a saving to the measured request runtime. The matcher-versus-router-class comparison is illustrative, not an equivalent alternative implementation: no full Eld adapter using those classes was built. It nevertheless gives no reason to replace the small matcher copy with the broad UI-router runtime solely to reduce size.

The current Eld tarball is 112,862 bytes. Its regular transitive dependency graph contains 61 packages totaling 36,142,470 logical unpacked file bytes. This sum excludes peer/dev dependencies and does not account for pnpm store sharing, filesystem block compression, hardlink/reflink deduplication, or registry download compression. It is not a promised fresh-install disk cost. Largest entries include Prettier at 9,961,663 bytes, Zod at 6,148,944 bytes, and router-core at 3,076,503 bytes. Dependencies that serve build-time tooling are currently regular dependencies because tooling and runtime share a package. [Current manifest](../../packages/eldjs/package.json)

The sole source import from router-core is the generator's `rootRouteId`, whose value is `'__root__'`. A local constant would remove that direct dependency while the generator remains vendored. Graph subtraction finds five then-unneeded packages totaling 3,859,009 logical bytes: router-core, cookie-es, seroval, seroval-plugins, and history. This is a potential install reduction, not an implemented change or runtime bundle saving. Do not confuse that ID with the distinct filename token `rootPathId = '__root'`. Switching to the published generator would bring router-core back transitively. [Generator after the cleanup](../../packages/dev/src/vendor/generator/generator.ts), [Filename token](../../packages/dev/src/vendor/generator/filesystem/physical/rootPathId.ts), [Upstream root ID](https://github.com/TanStack/router/blob/18154b1c45454a70aa77e9d6d27c8a6e0733d031/packages/router-core/src/root.ts)

The larger packaging improvement is separating runtime from generator/CLI/Vite tooling, with tooling installed as a development dependency. That allows production-only installs to omit the compiler/generator dependency graph while keeping route code generated before deployment. Two exports from one package alone do not remove its regular dependencies from production installs. Naming and compatibility shims should be decided before implementing that package split.

## Suggested implementation order

1. Remove the constant-only router-core dependency while retaining the current generator; validate a packed consumer and generation output.
2. Separate runtime and development tooling, keep the user-facing setup small, and make Hono a shared peer dependency with an explicitly tested range.
3. Track the upstream generator extension described above, or choose a bundled patch as a deliberate temporary maintenance strategy. Do not make consumer projects apply patches.
4. Retain the small matcher adaptation for now, with provenance and upstream compatibility tests. Avoid replacing it with a UI-router instance merely to eliminate copied files.
5. Preserve route renames, virtual mounts, empty mounted folders, escaped/optional/splat paths, file-write races, and consumer type inference in the migration test gates.

These are recommendations only. This investigation changed the research note, not Eld source, build configuration, or dependencies.
