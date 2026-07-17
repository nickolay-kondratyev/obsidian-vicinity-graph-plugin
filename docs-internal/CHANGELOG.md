# Changelog

## 2026-07-17 — step-02-core-engine: pure graph engine

Implemented the pure, fully-tested neighborhood-graph engine under `src/engine/` (executes [[plan/steps/step-02-core-engine]]; binding decisions in step-02 CLARIFICATION Q1–Q5):

- Path-keyed identity (branded `VaultPath`; docids opaque, echoed through — adapter translates before the engine).
- Sync `LinkProvider` seam (the ONLY Obsidian touchpoint) + fixture-driven `FakeLinkProvider`; `NodeEligibility` owns node-bearing resolution.
- Multi-root directional BFS (independent per-root per-direction depth limits, full depth tags + `minDepth`, never re-expands), attachments + first image collected.
- Composable sizing metrics (own-file-size, total-linker-size, backlink/outlink counts, depth-decay) → `sizeScore` → `sizePx`; centrals forced to max.
- Truncation: hard cap on non-centrals (default 100), distance-to-MAIN ranking via the ONE shared `NodePriorityChain` comparator, per-folder hidden counts.
- Settings cascades: depth (own override → global), view per-field (MAIN → pinned gaps via priority chain → global).
- **Edge-visibility toggle** (Q5): `"walked-from-center"` (BFS-walked only, human-confirmed default — cleaner graph) vs `"all-edges"` (induced subgraph, available via toggle).
- Import-guard test keeps the engine pure (zero `obsidian`/`obsidian-id-lib`/react imports, all import forms matched).

Verified: `npm test` (136 root + 69 sublib) and `npm run check` green (implementer + independent reviewer + iteration). Review findings dispositioned in `.ai_out/step-02-core-engine/`.

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
