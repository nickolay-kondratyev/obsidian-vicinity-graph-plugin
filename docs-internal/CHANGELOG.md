# Changelog

## 2026-07-16 — step-01-scaffold: plugin dev environment

Scaffolded the Obsidian plugin toolchain (executes [[plan/steps/step-01-scaffold]], Phase 0 of [[plan/high-level-plan]]):

- TypeScript + esbuild build (`obsidian` types-only external), strict tsconfig; npm scripts `dev`/`build`/`test`/`check`.
- React 18 placeholder `ItemView` ("hello graph") with createRoot/unmount lifecycle.
- vitest wired for our code plus the `obsidian-id-lib` submodule suite (2 + 69 tests).
- `obsidian-id-lib` consumed as `file:submodules/obsidian-id-lib` raw-TS dep, bundled by our esbuild; `DocIdServices` import smoke-checked.
- `manifest.json`: id `obsidian-neighborhood-graph`, name "Neighborhood Graph", `minAppVersion` **1.12.4** (floor; first public core canvas link indexing — the plan's original "canvas `metadata.frontmatter` version" premise was found false; human approved).
- Git-ignored `.dev-vault/` with build-time artifact copy; `.gitignore`, README fresh-clone docs (`git submodule update --init && npm install`).
- Follow-up ticket: [[tickets/ticket-eslint-adoption]].

Verified: `npm run build`, `npm test`, `npm run check` all pass (implementer + independent reviewer). GUI check confirmed by human (2026-07-16): plugin loads, placeholder view renders "hello graph", no console errors. All exit criteria met.
