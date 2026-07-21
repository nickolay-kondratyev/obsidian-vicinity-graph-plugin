# PHASE B (Performance pass) — PRIVATE working memory

Role: IMPLEMENTATION_WITH_SELF_PLAN. Phase A (engine dense fixtures) done+committed — untouched here.

## Goal
Deliver B1..B5 perf-hardening items; fix-if-cheap else ticket; no perf item left unfixed without a ticket. Structural/invariant assertions (per CLARIFICATION), no wall-clock.

## Plan / status
- **B1 hover-pin CSS** (FIX NOW): edit SOURCE `src/view/graph-view.css`. `pointer-events:none` while hidden (opacity 0) + re-enable on hover/focus; hide button entirely below the 72px container-query threshold (same threshold as attachment strip). Right-click menu path (NoteNode onContextMenu) untouched. styles.css is build output — rebuild to regenerate.
- **B2 image culling**: add `onlyRenderVisibleElements` to `<ReactFlow>`. Investigated RF v12 source (see caveat notes). + pure flowMapping test guarding firstImagePath stability across unchanged rebuild.
- **B3 debounce test**: new tests in GraphViewController.test.ts using `vi.useFakeTimers()` + `vi.stubGlobal("window", globalThis)` (node env; controller calls window.setTimeout/clearTimeout). Burst → one rebuild; active-file change immediate + cancels pending debounce.
- **B4 skip-rate invariant**: new test — after initial layout, N same-structure rebuilds → layout.callCount stays 1 (0 elk across repeats). Use handleSettingsChanged (immediate, no timers). No counter added (Pareto).
- **B5 orphan sweep 500**: new fixture in OrphanSweeper.test.ts, 500 live files, assert yieldCount >= 24 (warm phase: 500/20 → boundaries at 20..480 = 24 yields, no trailing).

## Key findings / decisions
### B2 React Flow onlyRenderVisibleElements caveat investigation (node_modules/@xyflow)
- Visible set computed by `getNodesInside(nodeLookup, viewportRect, transform, partially=true)` (selector$c in react/dist/esm/index.mjs:2112).
- Per-node: uses `node.internals.positionAbsolute` (children get parent-origin applied by RF), width/height from measured|node.width. So child visibility is computed independently/correctly.
- `forceInitialRender = !node.internals.handleBounds` → a node with NO handles never gets handleBounds → ALWAYS renders. Folder-group nodes render no `<Handle>` (FolderGroupNode) → **group parents never culled**. Note nodes force-render once until handles measured. => enabling the prop is SAFE for the subflow/parent-child feature; children culled by own absolute rect, parents always present.
- `fitView` default: whole graph fits → all nodes "partially" visible → nothing culled at rest; culling kicks in when zoomed in (correct, and matches current behavior at fit).
- CANNOT browser-verify here (no RTL/jsdom component infra; e2e needs Obsidian binary). Code-level analysis supports safety; flagged for e2e/manual smoke as verification follow-up (not a blocker).

### B2 "no refetch storm" invariant
- Emergent: NoteNode thumbnailUrl useMemo keyed on primitive data.firstImagePath; Obsidian getResourcePath mtime-cache-busts. Guarded at pure level: flowMapping produces identical firstImagePath primitive across two neighborhoodGraphToFlow calls on structurally-equal graphs (the useMemo key stability contract). No React harness stood up.

### B3 window seam
- vitest.config.ts has NO environment → defaults to node → no `window`. Least-invasive: `vi.stubGlobal("window", globalThis)` + `vi.useFakeTimers()` scoped to the debounce describe (beforeEach/afterEach restore). window===globalThis so window.setTimeout is the faked timer. No jsdom switch needed, no leak.

## Files touched
- src/view/graph-view.css (B1)
- src/view/NeighborhoodGraphFlow.tsx (B2 prop)
- src/view/flowMapping.test.ts (B2 stability test)
- src/view/GraphViewController.test.ts (B3 debounce + B4 skip-rate)
- src/persistence/OrphanSweeper.test.ts (B5 scale)

## Gates
- npm run check → .tmp/phaseB-check.log
- npm test → .tmp/phaseB-test.log
- npm run build → .tmp/phaseB-build.log (CSS regen)

## Measured (all gates PASS)
- check: EXIT 0. test: 559 passed (main) + 69 (sublib), 0 fail. build: EXIT 0, styles.css regenerated with pin-button fix (grep confirmed `pointer-events: auto` + two `@container (min-height:72px)` blocks).
- 11 new tests: flowMapping +3 (thumbnail key stability), GraphViewController +6 (1 skip-rate + 5 debounce), OrphanSweeper +2 (scale).
- B5 yield count: MIN_WARM_PHASE_YIELDS = floor((500-1)/20) = 24; test asserts `>= 24` and passed (warm phase alone; later phases add more).
- B4: skip-rate test drives 5 same-structure rebuilds → layout.callCount stays 1 (5/5 elk skips; console.debug "structural diff skipped elk layout" printed 5×, expected).

## Outcomes
- B1 FIXED (CSS source + regenerated). B2 FIXED (onlyRenderVisibleElements + pure stability test). B3 FIXED (debounce tests, fake timers + window stub, no jsdom). B4 VERIFIED+STRENGTHENED (repeated-rebuild invariant). B5 FIXED (500-file scale test).
- NO tickets created — every perf item was cheap enough to fix. B2 browser-verify is a follow-up smoke note, not a ticket (code analysis supports safety; see caveat notes above).
- e2e workaround note: the e2e interaction tests click the ALPHA (3 large nodes) graph to dodge this exact bug. With B1, small-node clicks should open again (pin button gone below 72px, pointer-events:none while hidden). Did NOT run full e2e (needs Obsidian binary) — flagged for TOP_LEVEL to optionally revert that workaround.
