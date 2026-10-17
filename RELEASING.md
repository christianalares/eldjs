# Releasing Eld

The public packages are `@eldjs/core` (runtime) and `@eldjs/dev` (development tooling). Both belong to the `eldjs` npm organization. The monorepo root and example app are private packages.

The current preview release is `0.2.0`, tagged `next`. Eld is experimental; an install must opt into that tag:

```sh
pnpm add @eldjs/core@next hono
pnpm add -D @eldjs/dev@next
```

## Prepare

1. Update both package versions and the tooling package's `@eldjs/core` peer range when needed. Update the lockfile with `pnpm install --lockfile-only`.
2. Run `pnpm install --frozen-lockfile`, `pnpm check`, and `pnpm check:packages`.
3. Review the package contents with the dry run below. Commit and push the reviewed source to `main`, and confirm GitHub CI passes.

```sh
pnpm --filter @eldjs/core --filter @eldjs/dev -r publish --dry-run --access public --tag next
```

The packed packages include built JavaScript, declarations, their mapped TypeScript sources, README, license, and third-party notices. The package check verifies these contents and installation outside this workspace. Do not publish local environment files, authentication configuration, or private integration notes.

## Publish from a maintainer's machine

Sign in through pnpm's browser flow; complete npm's security-key/2FA prompts yourself. Do not put authentication tokens in this repository.

```sh
pnpm login --registry=https://registry.npmjs.org/
pnpm whoami
pnpm --dir packages/eldjs publish --access public --tag next
pnpm --dir packages/dev publish --access public --tag next
pnpm view @eldjs/core@0.2.0 version dist-tags --json
pnpm view @eldjs/dev@0.2.0 version dist-tags --json
```

Publish the runtime first. If publication is interrupted, check the registry before retrying: an accepted package version cannot be overwritten. Each release needs a new version. Replace `0.2.0` in the verification commands for subsequent releases.

npm scans new uploads before making them installable. A successful publish can therefore be followed by a temporary 404 from registry reads or installs. Wait for both versions and their tarballs to become available; do not republish an accepted version to resolve this delay. See [npm's publication-scanning guidance](https://github.blog/changelog/2026-07-28-npm-publish-time-malware-scanning-and-dual-use-metadata/).

After both versions are installable, create a matching Git tag and GitHub prerelease, and verify a fresh consuming project can install from the registry. Keep the README's installation instructions aligned with the published tag.

## Later CI publishing

Prefer npm trusted publishing with GitHub Actions OIDC over storing a long-lived publishing token. Configure each package for the exact repository and workflow filename, then grant that workflow `id-token: write`. Public packages published from a public repository receive provenance automatically. This repository's CI currently checks packages only; it does not publish on a push.

See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) and [pnpm publish](https://pnpm.io/cli/publish).
