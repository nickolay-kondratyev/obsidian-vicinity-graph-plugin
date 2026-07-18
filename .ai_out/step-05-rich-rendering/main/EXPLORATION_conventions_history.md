# EXPLORATION — Conventions + Prior-Step History for Step 05: Rich Rendering

(Persisted by TOP_LEVEL_AGENT on behalf of read-only Explore agent.)

## 1. Step 05 scope & plan positioning
Source: `docs-internal/plan/steps/step-05-rich-rendering.md`, `docs-internal/plan/high-level-plan.md` (Phase 5, line 121; rendering decisions lines 88–95).

- Step 05 = Phase 5 "rendering": rich nodes (thumbnail, icon strips, dropdowns), MAIN/pinned/regular styling tiers, folder groups (RF subflows), directed/collapsed edges, truncation badges, Obsidian theme-variable integration, interactions (click-open, ctrl/cmd-click alt target, hover `hover-link`).
- Node size comes from the engine's sizing score (`sizePx`); centrals forced to max (high-level-plan sizing section).

## 2. Boundary: what is 05 vs 06 vs 07
Source: step-05 "Out of scope" (lines 36–39), `step-06-controls.md`, `step-04-view-shell.md`.

- **05 renders pinned styling but NOT the pin affordance** — the button/menu to pin/unpin arrives in step 06 (step-05 line 38).
- **Out of 05:** toolbar, steppers, pin/unpin buttons, settings UI (all step 06); performance tuning beyond lazy loading (step 07).
- **Step 04 already delivered**: plain default RF nodes with title labels, pan/zoom/fit-view, click-to-open. Step 05 replaces the plain node body and adds rich interactions.
- Step 06 owns depth steppers, sizing controls, cap setting, reset-to-global, pin/unpin nodes, `PluginSettingTab`.

## 3. Binding decisions from step 04 that CONSTRAIN step 05
Sources: step-04 CLARIFICATION__PUBLIC.md, IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md, IMPLEMENTATION_REVIEW__PUBLIC.md, CHANGELOG.md.

- **elkjs baseline (CLARIFICATION Q1) is fixed and compound-ready.** `ELK_LAYOUT_OPTIONS` in `src/view/constants.ts`: `elk.algorithm=layered`, `elk.direction=DOWN` (via `ELK_DIRECTION` const), `elk.hierarchyHandling=INCLUDE_CHILDREN`, `elk.layered.spacing.nodeNodeBetweenLayers=80`, `elk.spacing.nodeNode=40`. `INCLUDE_CHILDREN` was chosen precisely so folder-group compound layout works in step 05.
- **elk mapping is already compound-ready.** `src/view/elkMapping.ts`: `neighborhoodGraphToElk` builds root + children + edges; `extractElkPositions` recursively accumulates parent offsets "so folder nesting in step-05 works." `ELK_ROOT_ID="root"`.
- **elk runs inline async, no web worker (Q3).** `src/view/ElkLayoutRunner.ts` wraps `elkjs/lib/elk.bundled.js` in-thread.
- **React Flow package = `@xyflow/react` v12 (Q5)**, `elkjs` ^0.12. Both bundle into `main.js` via esbuild (no externals change). Import RF types ONLY in `.tsx` render files.
- **Node/edge typing approach (hexagonal, must be preserved):**
  - Pure mapping `src/view/flowMapping.ts` emits plain `FlowNode`/`FlowEdge`/`FlowNodeData` objects with NO `@xyflow/react` import (node-testable). Current `FlowNodeData` = `{path, title, isCentral, isMain, sizePx}` — **step 05 must extend this payload** (attachments, firstImagePath, folder, minDepth, pinned-vs-main distinction) since the engine `GraphNode` already carries `folder`, `attachments`, `firstImagePath`, `minDepth`, `depthTags` (per step-04 EXPLORATION_PUBLIC).
  - `src/view/NeighborhoodGraphFlow.tsx` is the ONLY place RF `Node`/`Edge` types live; `toReactFlowNode`/`toReactFlowEdge` adapt at the render boundary. Default node currently renders `data.label`; step 05 introduces custom `nodeTypes`.
  - Shared id conventions in `src/view/graphIdentity.ts`: `edgeIdOf` = `${source}->${target}`, `nodeSideLengthPx` = `sizePx`. RF map, elk map, and diff all agree via this DRY seam — keep using it.
- **Structural diff constrains rendering churn.** `src/view/GraphStructureDiff.ts` + `SIZE_RELAYOUT_THRESHOLD=1.0`, `REBUILD_DEBOUNCE_MS=500` (constants.ts). Reuse-layout path keeps old positions but refreshes node DATA (`withPositions`) — step 05 rich node data must flow through the data-refresh path without forcing relayout.
- **Controller / port pattern (DIP) is the established convention.** `GraphViewController` has zero obsidian/elkjs/builder runtime coupling; obsidian access sits behind ports in `src/view/viewPorts.ts` (`GraphSourcePort`, `GraphLayoutPort`, `NoteNavigatorPort`) with `ObsidianNoteNavigator.ts` as adapter. Repo-wide convention mirrors `adapters/obsidianPorts.ts`. **Step 05 interactions needing new Obsidian APIs (`hover-link` trigger, `vault.getResourcePath`, native `Menu`, ctrl/cmd-open) should be added behind a port/adapter, not called from a `.tsx`/controller directly.**
- **CSS approach is fixed.** `styles.css` is GENERATED at esbuild `onStart` = `@xyflow/react/dist/style.css` + authored `src/view/graph-view.css`; gitignored, copied to `.dev-vault`. **Edit `src/view/graph-view.css` only, never `styles.css`.** Step-05 theme work (Obsidian CSS variables like `--text-muted`, `--size-4-4` already used) goes in `graph-view.css`.
- **openNode uses `getLeaf(false)`** (main-area leaf, not the sidebar) via the navigator; ctrl/cmd-click alt-target in step 05 should extend the navigator.

## 4. Deferred-to-05 items (explicitly punted from step 04 / owned here)
- Rich node components, folder groups (RF subflows), edge styling/direction, theme CSS variables (step-04 "Out of scope").
- Full node interactions beyond click-open (step-04 rendering note: "full interactions in step 05").
- `getState`/`setState` overrides are intentional no-ops retained as **step-06** anchors (not 05) — per CLARIFICATION Q4; don't repurpose in 05.
- Folder grouping relies on the already-installed compound-elk plumbing (extractElkPositions parent-offset accumulation) — no elk rework needed, just supply group container nodes + `parentId`.

## 5. Step-05 open items still needing step-level planning (from the step doc)
1. Thumbnail resolution: `vault.getResourcePath` + cache-on-rebuild behavior.
2. Dropdown: Obsidian native `Menu` (leaning native) vs custom React popover.
3. Folder palette definition + stable hash fn (no magic numbers, stable across sessions).
4. Truncation badges attaching to groups whose visible members were all truncated.
- Groups render only at 2+ members; singletons get folder-colored accent. Folder color = deterministic hash of path into palette (user-assignable folder colors are V2 — high-level-plan "Deferred to V2+").

## 6. Testing conventions (must follow)
Sources: step-04 EXPLORATION_PUBLIC, IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC, high-level-plan testing section, step-05 doc.

- Pure logic vitest-covered; **BDD** `describe`/`it("WHEN...THEN...")`, ~1 assert/test, structural fakes, `Partial`-override fixtures (`src/view/testFixtures/graphFixtures.ts` — `makeNode`/`makeEdge`/`makeGraph`), determinism checks.
- **Never mount React Flow / no DOM in tests** — test pure transforms only. elkjs CAN run headless in node (real-ELK tests exist: `ElkLayout.test.ts`).
- Step-05 pure units to cover: folder color hashing (deterministic), edge collapsing/pairing, group-membership derivation (2+ rule), attachment→icon-strip mapping.
- Visual/behavioral: dev-vault checklist per feature, light + dark theme pass; consider `PLAYWRIGHT_REVIEW_WITH_SCREENSHOTS` sub-agent, else structured manual QA with screenshots to `/.out`.
- Step doc says load master UI memory `${MY_DEEP_MEM}/my-frontend-design.md` during step-level planning (UI-heavy step).
- Engine stays pure (import-guard test); Obsidian adapters stay thin.

## 7. Build / dev / test workflow
Sources: `package.json`, `esbuild.config.mjs`, `scripts/setup-dev-vault.sh`.

- Scripts: `npm run dev` (esbuild watch), `npm run build` (= `npm run check` then production esbuild), `npm run check` (`tsc -noEmit`), `npm test` (`vitest run` + `test:sublib`), `npm run test:watch`, `npm run setup:dev-vault` (bash `scripts/setup-dev-vault.sh`).
- `test:sublib` installs + runs `submodules/obsidian-id-lib` tests (69).
- esbuild: single entry `src/main.ts` → `main.js` (cjs, es2021, bundle, treeshake; minify in prod). `obsidian`/electron/codemirror/lezer/builtins external; `obsidian-id-lib` bundled (raw TS). Two plugins: `generate-styles` (onStart regenerates styles.css) and `copy-to-dev-vault` (onEnd copies `main.js`/`manifest.json`/`styles.css` to `.dev-vault/.obsidian/plugins/<id>/`).
- `setup-dev-vault.sh`: idempotent; creates fixtures note1/note2/note3/test.canvas/pic.png (note1 embeds `![[pic.png]]` — the first-image thumbnail candidate for step 05), auto-enables plugin, runs `npm run build`. `.dev-vault/` is gitignored.
- Green gates baseline from step 04: `npx vitest run` → 335 passed / 36 files; `npm run check` exit 0; `npm run build` → `main.js` ~1.84 MB, `styles.css` ~19 KB.

## 8. CHANGELOG convention
Source: `docs-internal/CHANGELOG.md`.

- Newest entry on top. Header format: `## <YYYY-MM-DD> — <step-slug>: <title>`. Body = intro line citing `[[plan/steps/...]]` + Phase of `[[plan/high-level-plan]]` and binding CLARIFICATION Qs, then bullet list of what shipped, then a final `Verified:` line (test/check/build results + reviewer convergence + any pending human-smoke ticket link). **TOP_LEVEL_AGENT writes exactly ONE entry** (implementer does not write the changelog or commit).

## 9. Tickets
Source: `docs-internal/tickets/`.

- `ticket-eslint-adoption.md` — **OPEN.** Adopt Obsidian ESLint 9 flat config + `eslint-plugin-obsidianmd` as `npm run lint`. Not step-05-specific but would touch new `.tsx`.
- `ticket-step-04-human-smoke-run.md` — **DONE** (observed 2026-07-18). Relevant carry-overs for step 05: (a) end-to-end link-edit latency is a few seconds (Obsidian save/reindex ~2s + our 500ms) — expected, not a bug; (b) **single-instance view is accepted V1 behavior** (opening a second view refocuses the existing leaf) — step 05 need not support multiple simultaneous views.
- `ticket-step-03-human-smoke-run.md` — present (step 03), not step-05-relevant.

## 10. Repo standards / CLAUDE.md
- **No `CLAUDE.md` at repo root and no `ai_input/` directory exist.** Standards live in the plan docs, CHANGELOG conventions, and prior-step `.ai_out` records.
