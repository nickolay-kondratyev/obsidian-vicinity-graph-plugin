# Changelog

## 2026-07-20 — step-06-controls: the machinery in the user's hands

Puts the depth/pin/sizing/cap engine (built + tested in steps 02–03) behind an in-view toolbar, node pin/unpin, and a global settings tab — executes [[plan/steps/step-06-controls]], goals 3 & 4 of [[plan/high-level-plan]]. Binding decisions in step-06 CLARIFICATION Q1–Q5 + Q-A/B/C: single collapsible top-left `<Panel>` toolbar (depth steppers front, pinned-centrals + sizing behind disclosures), `MAX_STEPPER_DEPTH=5` (min 0 = central only), pin/unpin on BOTH a hover button and the right-click menu, node cap + sizing **global-only in V1**, depth steppers the only per-doc/per-central write surface, reset-to-global = field delete, and the pinned-central stepper edits only the MAIN view's `centralDepths[X]` layer.

- **Pure contract core (unit-tested, no obsidian/react)**: `planSettingsWrite` (the single "which write lands where" mapping — every mutation on every surface routes through it, so the field-merge rule exists exactly once); `ControlsModelBuilder` (central-selector list + per-direction resolved depth + **presence-based** inherited-vs-pinned flag — value derived through the engine's own `TraversalSettingsResolver` so "value shown == value graphed" is structural, not a parallel `??` chain); shared `PinnedRootResolver` (DRY skip-rule with `GraphRequestAssembler`); `planNodePinAction`; `clampStepperDepth`; `SIZING_METRICS` (invariant-tested vs engine `SizeMetricId`). `DIRECTION_DEPTH_FIELD` lives once in `engine/types.ts`.
- **Wiring**: `NeighborhoodGraphBuilder.build` returns `{graph, controls}` from ONE assembled-inputs read (no extra disk IO, no race); `GraphViewController` publishes `controls` in `FlowSnapshot` and gains `handleSettingsChanged()` (immediate rebuild, latest-wins token absorbs stepper spam) + `currentMainPath()`, staying obsidian-free; `ControlsActions` adapter executes commands against `PersistenceServices`/`PluginDataStore`, resolves the MAIN `TFile`, and shows a `Notice` when a doc can't be pinned (`not-persistable`); `FlowNodeData` carries `docid` for unpin.
- **UI**: `GraphToolbar` (`<Panel top-left>`, collapsible), `CentralDepthControls` → `DepthStepper` (−/value/+, clamp, reset, inherited-vs-pinned styling), `SizingSection` (in-view global mirror); `NoteNode` hover pin button (`nodrag nopan`, stopPropagation) + `onContextMenu` → native `Menu` via `ObsidianGraphUi.showNodeMenu`; all new `graph-view.css` keyed to Obsidian theme vars (zero plugin colors), compact + vertically-scrolling at ~300px.
- **Settings tab**: `NeighborhoodGraphSettingTab` (global depth defaults, sizing, node cap) routes writes through the SAME `planSettingsWrite` contract, then `main.ts refreshOpenViews()` fans out `getLeavesOfType → view.refresh()` so open graphs update without reopening.
- **Scenario proven at two levels**: `CentralDepthRoundTrip.test.ts` (persistence — pin X at depth 3 while MAIN Y at 1, switch Y→Z→Y, X's own DocData byte-identical throughout) + a `NeighborhoodEngine.test.ts` block (BFS actually re-explores X at the adjusted depth).

Verified: `npm test` (49 files / 499 tests) + `npm run check` (tsc) + `node esbuild.config.mjs production` green across all four implementation phases. Each phase independently reviewed; IMPLEMENTATION_REVIEW verdict APPROVE-WITH-FOLLOWUPS (0 Critical/Important, 2 minor DRY cleanups applied), PARETO verdict JUSTIFIED — ship. Two follow-ups filed: manual restart-round-trip QA ([[tickets/ticket-step-06-controls-human-smoke-run]]) and optimistic-input latency on rapid edits ([[tickets/ticket-controls-optimistic-input-latency]]). Per-view sizing, per-doc cap, and folder colors remain V2.

## 2026-07-20 — edge-polish: arrowhead clarity + cleaner ×N badge

Resolves the two human-judged visual issues from the step-05 smoke run (QA_CHECKLIST §4/§7, [[tickets/ticket-edge-arrowhead-and-badge-visual-polish]]) that automation can't catch — arrowheads reading unclear and the collapsed-count badge looking cluttered:

- **Arrowheads**: `EDGE_ARROWHEAD_SIZE` 18→24 (`NeighborhoodGraphFlow.tsx`) for legible direction; `EDGE_PAIR_CURVATURE_PX` 24→34 (`edgeGeometry.ts`) so the mirrored A↔B pair fans apart and each arrowhead is individually visible near the shared node (was reading as one clipped smudge). Color stays `--text-faint` — locked by the e2e both-theme contract, so the levers were size + geometry, not color.
- **"×N" badge**: split out of the shared folder-badge CSS rule (folder `+N` chip unchanged) and restyled to a borderless theme-var pill (`--radius-l` + `--shadow-s`, tight padding) for a cleaner, less-cluttered midpoint.
- CSS-first, all theme-variable-driven (zero plugin colors). Contract preserved: polyline arrowhead + `--text-faint` override, `marker-end url()` on every edge, `×N` text + `data-count`; `edgeGeometry.test.ts` needed no edit (asserts interpolate the curvature symbol).

Verified: `npm run check` + `npm test` (451 root + 69 sublib) green; implementer + independent reviewer CONVERGED-READY on round 1 (0 blockers). Pending human confirmation on a real render (tuned on a faithful chromium proxy, not live Obsidian) and an e2e run in a display-capable env — see ticket.

## 2026-07-18 — step-05-rich-rendering: nodes that carry information

Plain rectangles become rich, themed, information-dense nodes — the plugin's reason to exist (executes [[plan/steps/step-05-rich-rendering]], Phase 5 of [[plan/high-level-plan]]; binding decisions in step-05 CLARIFICATION Q1–Q5 + palette deferral — engine edge counts approved, ctrl/cmd = new tab, native `Menu`, corner overlay for orphaned truncation counts, Playwright e2e in scope, **NO folder colors** (human decision: deliberate design pass later, [[tickets/ticket-folder-color-ux-design-pass]])):

- **Engine/data (Phase A)**: `GraphEdge.count` carries real link multiplicity (from `resolvedLinks`/canvas parse — not fabricated) through both edge-visibility modes; display titles honor frontmatter `title`/`name` (trimmed, fallback basename); `FlowNodeData`/`FlowEdge`/`FlowSnapshot` widened (folder, attachments, firstImagePath, explicit tier discriminant, edge pairing, per-group + orphan-aggregate truncation counts); pure modules for folder-group derivation (2+ rule; contract-commented dual elk/flow derivation), elk compound nesting, attachment→icon-strip grouping, breadcrumb derivation; dev-vault fixtures extended (folders, singleton, duplicate + bidirectional links, attachment types, frontmatter-title note).
- **Rendering (Phase B)**: rich `NoteNode` (breadcrumb `<folder>/<title>` on ungrouped nodes with muted folder part, lazy fixed-height thumbnail + "+N" images badge, attachment icon chips → native Obsidian `Menu` capped at `ATTACHMENT_MENU_MAX_ITEMS=20` with "…and N more"); neutral `FolderGroupNode` (subtle border, `--background-secondary` fill, label, "+N" badge, elk label padding); directed edges with themed arrowheads (CSS override defeats RF v12's hard-coded `#b1b1b7` marker color), mirrored A↔B offset curvature via pure `edgeGeometry.ts`, "×N" badge when count > 1; corner "+N hidden" overlay with per-folder tooltip; tier styling MAIN / pinned-central / regular.
- **Interactions**: click opens note (current tab), ctrl/cmd-click new tab (`getLeaf(true)`, RF multi-select disabled to avoid gesture conflict), hover fires `hover-link` for native page previews (source registered in Page-preview settings). All Obsidian UI access behind new `GraphUiPort`/`ObsidianGraphUi` + navigator extensions (resource paths via `vault.getResourcePath`) — obsidian imports stay out of `.tsx`.
- **Theming**: all new styling in authored `src/view/graph-view.css` keyed to Obsidian theme variables — light↔dark works with zero plugin changes (e2e-asserted).
- **Playwright e2e (Phase C)**: `npm run test:e2e` drives REAL Obsidian (headless, sandboxed user-data-dir + vault copy) via `chromium.connectOverCDP` (fused Electron ignores `--inspect` — documented); 18 state-based DOM assertions (tiers, badges, breadcrumb, arrowhead theming both themes, icon strips, thumbnail `app://` src) — no screenshots/LLM judgment; fail-fast without `OBSIDIAN_PATH`; separate from the unit gate, re-runnable at release.

Verified: `npm test` (451 root + 69 sublib), `npm run check`, `npm run build` green; `npm run test:e2e` 18/18 against Obsidian 1.12.7, independently re-run twice by reviewer (idempotent). Three implementation phases each independently reviewed → iterated → CONVERGED-READY (Phase B round 1 caught a real theming violation + an incorrect implementer claim, both fixed). Visual-polish smoke run pending: [[tickets/ticket-step-05-human-smoke-run]].

## 2026-07-18 — step-04-view-shell: first visible graph

The milestone where it feels real: an `ItemView` (right sidebar, draggable to main) renders the active file's neighborhood as plain React Flow nodes laid out by elkjs, rebuilding on navigation and debounced vault changes (executes [[plan/steps/step-04-view-shell]], Phase 4 of [[plan/high-level-plan]]; binding decisions in step-04 CLARIFICATION Q1–Q5 — layered elk, inline async, latest-wins, no V1 scroll/zoom persistence, `@xyflow/react` v12):

- Thin `ItemView` (`src/view/NeighborhoodGraphView.tsx`): createRoot/unmount lifecycle, registers `active-leaf-change`/`file-open`/metadataCache `resolved` via `registerEvent`, thin `getState`/`setState` that persist nothing (Q4); `main.ts` passes `graphBuilder` in through the `registerView` closure.
- `GraphViewController` (`src/view/`): owns the pipeline `events → graphBuilder.build → structural diff → elkjs → React Flow` as a `useSyncExternalStore` store; **latest-wins** via a monotonic rebuild token checked after every await (no sleeps, Q2); metadata-resolve rebuilds debounced `REBUILD_DEBOUNCE_MS=500`; MAIN tracking gates on `FileKinds.isNodeBearingPath` (md/canvas only), and active-file change cancels a pending debounce. Obsidian navigation sits behind a `NoteNavigatorPort` (`viewPorts.ts`/`ObsidianNoteNavigator.ts`) so the controller is fully node-testable.
- Pure, node-tested decision modules (no obsidian/React/elkjs-runtime imports): `GraphStructureDiff` (unchanged structure ⇒ `reuse-layout`; any surviving node grown past `SIZE_RELAYOUT_THRESHOLD=1.0` = +100% `sizePx` ⇒ `relayout`), `RebuildDecision`, `flowMapping` (engine → React Flow, node id = `path`, edge id = `${source}->${target}`), `elkMapping` (compound-ready: root + children + parent-offset extraction so step-05 folder groups lay out), `graphIdentity` (shared id/size conventions).
- Layout: `ElkLayoutRunner` wraps `elkjs` in-thread (no worker, Q3) with `layered` + `hierarchyHandling: INCLUDE_CHILDREN` chosen now for the compound-graph future; `NeighborhoodGraphFlow.tsx` renders default nodes + `<Background>`/`<Controls>`, pan/zoom/fit-view, click-opens-note, empty state on `build()===null`.
- Deps `@xyflow/react` + `elkjs` bundle into `main.js` (no externals change); `styles.css` is now **generated at build time** (`@xyflow/react` base CSS + authored `src/view/graph-view.css`) so it can't drift from the installed version — gitignored like `main.js`.

Verified: `npm test` (335 root + 69 sublib), `npm run check`, `npm run build` all green (implementer + independent reviewer round 1 READY → iteration adds controller latest-wins tests behind a DIP seam → round-2 CONVERGED-READY, 0 blocking). Human smoke run in real Obsidian pending: [[tickets/ticket-step-04-human-smoke-run]].

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
