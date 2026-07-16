# Step 01: Scaffold

**Covers:** Phase 0 of [[../high-level-plan]]
**Depends on:** nothing (first step)

## Objective

A working battle station: the plugin builds, loads in a dev vault, and `npm test` runs — before any product code exists. Everything after this step assumes the dev loop works.

## Scope

- TypeScript + esbuild plugin toolchain (standard Obsidian plugin template layout: `main.ts` entry, `manifest.json`, `styles.css`).
- **React 18** + ReactDOM as dependencies; a placeholder `ItemView` that mounts a trivial React component ("hello graph") to prove the mount/unmount lifecycle.
- **vitest** configured for the pure layers; one trivial passing test committed so the test loop is proven, not assumed.
- **Submodule wiring** (`submodules/obsidian-id-lib`):
    - `package.json`: `"obsidian-id-lib": "file:submodules/obsidian-id-lib"` then `npm install` (per the submodule README's "Consuming the library" section).
    - The lib is raw TypeScript bundled by our esbuild — no build step in the submodule.
    - `obsidian` stays a types-only external in the esbuild config (never bundled).
    - Smoke check: an import of `DocIdServices` from `obsidian-id-lib` type-checks in our build.
- `manifest.json` with plugin id, name, and `minAppVersion`.
- Dev vault under a git-ignored path (e.g. `.dev-vault/`) plus a build/copy script (or symlink) that puts `main.js`/`manifest.json`/`styles.css` where Obsidian loads them.
- Repo hygiene: `.gitignore` (node_modules, build output, `.tmp/`, `.out/`, dev vault), `tsconfig.json` strict, npm scripts: `dev`, `build`, `test`, `check` (tsc -noEmit).

## Out of scope

- Any graph logic, any real view content, any settings.
- ESLint setup (nice-to-have; if skipped, ticket it — the submodule README already carries a similar follow-up).

## Open items for step-level planning

1. **`minAppVersion` value.** The high-level plan pins it to the Obsidian version that introduced canvas `metadata.frontmatter`. Research the exact version during step planning; record the finding in the manifest and a WHY comment.
2. Plugin id/name — default to repo name (`obsidian-neighborhood-graph` / "Neighborhood Graph") unless the human prefers otherwise.
3. Whether to run the submodule's own vitest suite in our CI loop (cheap confidence in the vendored code) or trust it as-is.

## Exit criteria

- `npm run build` produces a plugin that loads in the dev vault with no console errors; placeholder view opens and renders React content.
- `npm test` and `npm run check` pass.
- `git submodule update --init && npm install` from a fresh clone reaches the same state (document in README stub).
