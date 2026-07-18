# Changelog

## 2026-07-17 — step-03-adapters-and-persistence: Obsidian adapters + persistence

Implemented everything between the pure engine and Obsidian (executes [[plan/steps/step-03-adapters-and-persistence]], Phases 2+3 of [[plan/high-level-plan]]; binding decisions in step-03 CLARIFICATION Q1–Q3):

- `ObsidianLinkProvider` (`src/adapters/`): outgoing links in true reference order via `getFileCache().links/embeds` (resolution via `resolvedLinks`); incoming via a single typed wrapper over undocumented `metadataCache.getBacklinksForFile` with runtime presence check + `resolvedLinks`-inversion fallback (Q1).
- Canvas capability detection at build time + fallback `.canvas` JSON parser (file-type nodes only, malformed JSON never throws, mtime-cached). Devtools check on the target install found NO `.canvas` keys in `resolvedLinks` → the fallback parser is the active path there (Q2, recorded in the step doc).
- `obsidian-id-lib` wired per contract: `getDocId` (read-only) on all bulk/read paths; `ensureDocId` only on explicit write intent; `null` → doc not pinnable/persistable, surfaced as typed reason.
- Persistence (`src/persistence/`): versioned JSON shapes from day one; `data.json` (global settings + pinned set with pin timestamps); per-doc files at `doc-data/<docid>.json` via `vault.adapter.write`; pin-on-toggle per-field semantics (absence = inherit); unsafe-docid filenames refused with typed reason for a future non-popup node emblem (Q3).
- Live cleanup: `vault.on('delete'/'rename')` + path→docid map (warmed by sweep, lazily filled); orphan sweep delayed ~15s, chunked with yields, tolerant of foreign files, race-safe via drop-time re-verification.
- `GraphRequestAssembler` translates docid-keyed persistence → path-keyed `GraphBuildRequest`; main.ts lifecycle wiring + debug command harness for real-vault builds; shared `VaultPathFacts`/`FileKinds` extracted (resolves step-02 iteration finding 4).

Verified: `npm test` (297 root + 69 sublib), `npm run check`, `npm run build` all green (implementer + independent reviewer; 8 review findings fixed test-first and empirically re-verified). Human smoke run in real Obsidian pending: [[tickets/ticket-step-03-human-smoke-run]].

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
