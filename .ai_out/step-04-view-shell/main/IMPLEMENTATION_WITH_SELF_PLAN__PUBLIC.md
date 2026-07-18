# Step 04 — View Shell — IMPLEMENTATION (for the reviewer)

First visible graph delivered: an `ItemView` renders the active file's neighborhood as
plain React Flow nodes, laid out by elkjs, rebuilding on navigate and on debounced vault
changes, with a structural diff that skips layout when nothing structural changed.

## Test / check / build status (all green)
- `npx vitest run` → **325 passed / 35 files** (root suite; +34 new view tests). Log: `.tmp/step04-vitest.log`
- `npm run check` (`tsc -noEmit`) → **PASS**. Log: `.tmp/step04-check.log`
- `npm run build` (production esbuild) → **PASS**; bundles the new deps into `main.js` (1.84 MB) and
  generates + copies `styles.css` into `.dev-vault`. Log: `.tmp/step04-build.log`

## Dependencies added (as `dependencies`)
`@xyflow/react` ^12.11.2 (React Flow v12, per CLARIFICATION Q5) and `elkjs` ^0.12.0. Both bundle
into `main.js` automatically (esbuild) — no externals change.

## Architecture — thin ItemView, pure tested core
The `.tsx` holds only React-root + Obsidian-event lifecycle; every decision lives in a pure,
node-tested module. Obsidian/React/elkjs-runtime are confined to the three glue files.

### Pure modules (no obsidian/React/elkjs-runtime imports — node-testable)
- `src/view/graphIdentity.ts` — the two shared conventions: `edgeIdOf` (`${source}->${target}`) and
  `nodeSideLengthPx` (= `sizePx`). DRY seam so the RF map, elk map, and diff agree.
- `src/view/constants.ts` — `SIZE_RELAYOUT_THRESHOLD=1.0`, `REBUILD_DEBOUNCE_MS=500`, `ELK_DIRECTION`,
  `ELK_LAYOUT_OPTIONS` (layered + `hierarchyHandling: INCLUDE_CHILDREN`, compound-ready), `ELK_ROOT_ID`.
- `src/view/flowMapping.ts` — `neighborhoodGraphToFlow` (engine → `FlowNode`/`FlowEdge`; id = path,
  dims = sizePx) and `withPositions` (apply/keep positions). Own types, no `@xyflow/react` import.
- `src/view/elkMapping.ts` — `neighborhoodGraphToElk` (root + children + edges, compound-ready) and
  `extractElkPositions` (recursive, parent-offset-accumulating so folder nesting in step-05 works).
  `import type { ElkNode }` only (erased).
- `src/view/GraphStructureDiff.ts` — `decideLayout(prev, next, threshold)` → `"relayout" | "reuse-layout"`.
  Relayout on first build, any node/edge id-set change, or a surviving node grown `> threshold`.
- `src/view/RebuildDecision.ts` — `decideActiveFileRebuild(activePath, currentMain)` → rebuild/ignore.
  MAIN tracking gate via `FileKinds.isNodeBearingPath` (md/canvas only); same-path is a no-op.

### Glue (imports obsidian / elkjs-runtime / React)
- `src/view/ElkLayoutRunner.ts` — wraps `elkjs/lib/elk.bundled.js` (in-thread, no worker per
  CLARIFICATION Q3). Imports elkjs but not obsidian/React, so it is exercised by a real-ELK test.
- `src/view/GraphViewController.ts` — owns the pipeline `events → build → diff → elk → RF` and is a
  `useSyncExternalStore` store. Latest-wins via a monotonic `rebuildToken` checked after every await
  (no sleeps). Debounces metadata-resolve rebuilds. `openNode(path)` opens the note. The ONLY view
  class touching obsidian + the async builder; kept minimal, delegates all decisions to the pure modules.
- `src/view/NeighborhoodGraphFlow.tsx` — renders `<ReactFlow>` + `<Background>` + `<Controls>` from the
  store snapshot; click-to-open; empty state. React Flow's types live only here (`toReactFlowNode`/`Edge`).
- `src/view/NeighborhoodGraphView.tsx` — `ItemView`: keeps the createRoot/unmount lifecycle, builds the
  controller, registers `active-leaf-change` / `file-open` / metadataCache `resolved` via
  `this.registerEvent` (auto-cleanup), thin `getState`/`setState` (persist nothing — CLARIFICATION Q4).
- `src/main.ts` — passes `this.graphBuilder` into the view through the `registerView` closure.
- `src/view/HelloGraph.tsx` — **deleted** (placeholder replaced).

## Tests (BDD, ~1 assert, `Partial` fixtures, structural fakes; no DOM, no RF mounted)
`src/view/testFixtures/graphFixtures.ts` (`makeNode`/`makeEdge`/`makeGraph`). Suites:
`GraphStructureDiff.test.ts` (incl. **size-growth boundary**: exactly +100% → reuse, +100%+ε → relayout),
`RebuildDecision.test.ts`, `flowMapping.test.ts`, `elkMapping.test.ts`, and `ElkLayout.test.ts`
(**real elkjs** headless: fixture lays out, siblings don't overlap, deterministic — the CLARIFICATION-Q1 spike).

## Exit-criteria evidence
- No-structural-change edits provably skip layout: `decideLayout` returns `"reuse-layout"` (unit test)
  and the controller emits `console.debug("...structural diff skipped elk layout...")` on that path.
- Pure pipeline under test; ItemView stays thin (lifecycle + event wiring only).
- Latest-wins is token-based, no timing hacks.

## React Flow CSS approach (esbuild bundles JS only)
`styles.css` is **generated at build time** = `@xyflow/react/dist/style.css` + `src/view/graph-view.css`
(esbuild `onStart` hook in `esbuild.config.mjs`). Regenerating from `node_modules` every build means it
can never drift from the installed React Flow version — no vendored copy to go stale. The existing copy
step ships it to `.dev-vault`. Authored rules live in `src/view/graph-view.css`; edit there, not `styles.css`.

## CALLOUTS for TOP_LEVEL
- **`styles.css` is now a generated artifact** and was added to `.gitignore` (consistent with `main.js`).
  It was previously git-tracked, so it still shows as tracked. **Please `git rm --cached styles.css`**
  when committing so the generated file stops being version-controlled. (I did not stage/commit anything.)
- I did not write the CHANGELOG entry or commit (per instructions).

## Iteration 1 — review feedback incorporation (reviewer verdict was READY)

Gates re-run, all green: `npx vitest run` → **335 passed / 36 files** (+10 tests, +1 file;
log `.tmp/step04-iter-vitest.log`); `npm run check` → exit 0 (`.tmp/step04-iter-check.log`);
`npm run build` → exit 0, `main.js` 1.84 MB, `styles.css` 19 KB copied (`.tmp/step04-iter-build.log`).

**Finding #1 [SHOULD-FIX] — controller latest-wins now tested. ADDRESSED.**
Introduced a narrow structural-port seam so `GraphViewController` has ZERO obsidian/elkjs/builder
runtime coupling and is fully node-testable (repo's hexagonal convention, cf. `adapters/obsidianPorts.ts`):
- New `src/view/viewPorts.ts` — `GraphSourcePort` (`build`), `GraphLayoutPort` (`layout`),
  `NoteNavigatorPort` (`activeFilePath`/`openNote`). Types only, no runtime import.
  `NeighborhoodGraphBuilder`/`ElkLayoutRunner` satisfy the first two structurally — production
  wiring unchanged.
- New `src/view/ObsidianNoteNavigator.ts` — adapts `App` (vault/workspace) to `NoteNavigatorPort`.
  The `getFileByPath`/`getLeaf(false).openFile` logic moved OUT of the controller into this adapter,
  so the controller no longer imports `obsidian` at all. Also removed the duplicated `activeFilePath`
  that lived in both the ItemView and the controller (ItemView now reuses the navigator for event wiring).
- `GraphViewController` constructor now takes `(navigator, graphBuilder, layoutRunner)` as ports.
- New `src/view/GraphViewController.test.ts` (10 tests, BDD WHEN/THEN, structural fakes, no DOM/RF/elk):
  - **Latest-wins** — two rebuilds queued, builds resolved OUT OF ORDER via deferred promises
    (no sleeps/timers): stale earlier result is discarded (snapshot stays empty), never reaches elk
    layout, and only the latest graph renders. Concurrency is driven by explicit `resolveBuild(i, …)`.
  - `build()` → `null` and `build()` → empty-node graph both yield the empty snapshot.
  - Non-node-bearing active file (`pic.png`) triggers no `build` (isNodeBearingPath gating).
  - Structural-diff-skip: identical id-set on the next graph reuses layout (elk called once) and
    **preserves prior positions**; a node-set change relayouts (elk called twice).
  - `openNode` delegates to the navigator.

**Finding #2 [NICE-TO-HAVE] — clearDebounce on active-file change. ADDRESSED.**
`handleActiveFileChanged` now calls `this.clearDebounce()` on the rebuild branch (before triggering
the fresh rebuild), cancelling any pending metadata-resolve rebuild so there is no redundant second
pass. Cleared only when we actually rebuild — an `ignore` outcome (same-path / non-eligible) leaves a
pending resolve-debounce armed, which is correct.

**Finding #3 [NICE-TO-HAVE] — always-on `console.debug`. KEPT as-is (judgment call).**
The single reuse-layout `console.debug(...)` is retained. Rationale: `console.debug` is the lowest
console severity and is hidden by default in the Obsidian/Chromium console (shown only when the user
opts into "Verbose"), so it is NOT noisy in normal use; it is the one meaningful "skip-layout" runtime
signal the exit criterion asks for. Gating it behind a real dev flag would require adding an esbuild
`define` for `process.env.NODE_ENV` (there is none today) and risks perturbing React's own NODE_ENV
branching — not worth it for V1 (Pareto). The "provably skips layout" guarantee is anchored by the
unit tests (`decideLayout` reuse + the new controller reuse test), not the log.

**Finding #4 — getState/setState no-op. KEPT (intentional, per binding CLARIFICATION Q4).**
V1 persists nothing view-specific (no scroll/zoom snapshot, no view-settings UI until step-06). The
super-delegating overrides remain as documented step-06 anchors; this is by design, not an oversight.

**Finding #4 — openNode / `getLeaf(false)`. Behaviour UNCHANGED.**
`openNode` still opens in a main-area editor leaf via `getLeaf(false)` (correct: not the sidebar
hosting the graph). The logic simply relocated into `ObsidianNoteNavigator` (documented there). No
correctness change; still worth the manual smoke check (report step 3).

## Manual dev-vault smoke steps (for the human — TOP_LEVEL can file a smoke-run ticket)
Prereq: `npm run setup:dev-vault` (creates fixtures note1/note2/note3/test.canvas/pic.png) then open
`.dev-vault` in Obsidian with the plugin enabled.
1. Run command "Open neighborhood graph" → view opens in the right sidebar.
2. Open `note1.md` → graph shows note1 (central) with note2/note3; pan, zoom, and the fit-view control work.
3. Click a node → the corresponding note opens.
4. Switch active note (note2, note3) → graph follows the active file; open `pic.png` → graph does NOT change.
5. Edit a link in a note (add/remove) → within ~500ms the graph updates (structural change relayouts).
6. Make a non-structural edit (e.g. body text only) → graph refreshes without a layout jump; the dev
   console shows "structural diff skipped elk layout".
7. Drag the view from the sidebar into the main area → still works.
8. Open a second graph view (split), then reload Obsidian (workspace restore) → both views restore and
   each follows its active file (nothing view-specific persisted by design).
