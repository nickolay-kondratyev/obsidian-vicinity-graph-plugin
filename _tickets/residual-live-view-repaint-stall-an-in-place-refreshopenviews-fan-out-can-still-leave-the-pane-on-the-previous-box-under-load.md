---
closed_iso: 2026-08-07T18:25:00Z
id: nid_1s77g4wx33uj8b380d1oph1d6_e
title: 'Residual live-view repaint stall: an in-place refreshOpenViews fan-out can
  still leave the pane on the previous box under load'
status: closed
deps: []
links: [nid_8vekpgg97n5x7ckxbwswr5uar_e]
created_iso: '2026-08-06T23:15:09Z'
status_updated_iso: 2026-08-07T18:25:00Z
type: bug
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [view]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2
---
Follow-up from ticket nid_8vekpgg97n5x7ckxbwswr5uar_e (e2e nodeResize 'short but WIDE' render-poll flake) and the closed nid_c78k90su87jrzigxvfjv5t95g_e.

b610e39 filtered `onNodesChange` to fold in only resize-GESTURE dimension changes (`isResizeGestureChange` in src/view/nodeResize.ts), closing the channel where React Flow's ResizeObserver re-measurement clobbered the view's LOCAL `nodes` state. That killed the common case but a RESIDUAL stall survives: under FULL e2e-suite load the live graph view can still keep the PREVIOUS state's box on screen while data.json already holds the new one — a lost REPAINT, and one a `refreshOpenViews()` retry does NOT re-converge (only a view REMOUNT does; proven 8/8 in nid_c78k90su87jrzigxvfjv5t95g_e).

Why it matters in production: `refreshOpenViews()` is THE fan-out for every settings write, the pinned-set write and the per-node size-override write (src/main.ts -> VicinityGraphView.refresh() -> GraphViewController.handleSettingsChanged()). A pin toggle or settings change could, rarely and under the right timing, leave a LIVE pane painting the previous state until some unrelated event rebuilds it. A committed drag-resize HIDES this (released box is already in RF local state — the GuardedWriteOutcome "screen-ahead" note in CLAUDE.md), which is why it surfaces only in the pin-chip e2e setup helper.

Current mitigation (NOT a root-cause fix): e2e/nodeResize.ts `renderTargetAsNeighbourBox` now tries the in-place fan-out first (happy path, still exercises production) and, if the rendered box has not converged within IN_PLACE_REPAINT_BUDGET_MS (3s), REMOUNTS to recover deterministically. This makes the suite green but the underlying live-view repaint reliability is unproven.

Open questions to root-cause (static reading could not fully pin it — needs a live repro under full-suite load):
- Is snapshot.nodes identity actually changing on the swallowed publish (reseed gate in src/view/VicinityGraphFlow.tsx compares `seededFrom !== snapshot.nodes`)? If the publish is deduped/superseded in GraphViewController (src/view/GraphViewController.ts, rebuildToken latest-wins), the view would never reseed — a controller lost/superseded publish, not a view repaint bug.
- Or does RF adopt (@xyflow/system adoptUserNodes) run against stale local `nodes` because a functional setNodes from onNodesChange raced the render-phase reseed?
- getNodeInlineStyleDimensions uses `node.width ?? node.style.width` (never `measured`), so the wrapper inline width can only be stale if the store node.width itself is stale — i.e. adopt saw a stale userNode. That points at the reseed/publish path, not RF measured dimensions.

Instrument a full-suite floor run (the only place it reproduces, ~1 in 3 historically) with logging of snapshot.nodes identity + published target width at publish AND at reseed, to decide controller-lost-publish vs view-reseed-race, then fix at that seam and drop the remount fallback in renderTargetAsNeighbourBox back to a plain fan-out.

## Acceptance Criteria

Root cause identified (controller lost/superseded publish vs view reseed race) with a failing-first test at that seam; fix lands; e2e/nodeResize.ts renderTargetAsNeighbourBox reverts to a plain in-place refreshOpenViews() fan-out (no remount fallback) and stays green across repeated FULL floor+pinned suites.

## Resolution (2026-08-07)

**Root cause: view reseed-race, NOT a controller lost/superseded publish.** The controller's publish path was exonerated — `setSnapshot` mints a fresh object literal and notifies every subscriber with no dedup, and `snapshot.nodes` identity changes on every rebuild. The stall lived entirely in the view.

`VicinityGraphFlow` held the RF nodes as a STANDING local `useState`, reconciled to the snapshot only by a one-shot render-phase gate (`if (seededFrom !== snapshot.nodes) setNodes(...)`). React Flow's own ResizeObserver re-measures a node it already rendered and routes a `dimensions` change through `onNodesChange`; under full-suite load that measured the node's PRE-repaint DOM and a functional `setNodes` reverted the local box to the PREVIOUS build's. Because `snapshot.nodes` identity was unchanged, the identity-keyed gate — having already consumed that snapshot — could not re-fire, so local state stranded BELOW the published snapshot with no path back. A whole `refreshOpenViews()` fan-out (every settings / pin / size-override write) was then silently swallowed until some unrelated event rebuilt the pane. `getNodeInlineStyleDimensions` reads `node.width ?? node.style.width` (never `measured`), confirming the stale wrapper width came from a stale userNode in local state, i.e. the reseed path.

**Fix (derive + overlay):** deleted the standing `nodes` mirror. RF nodes are now derived straight from `snapshot.nodes` each render (`baseNodes` memo), so between gestures `nodes === baseNodes === snapshot` and there is nothing left to strand — a re-measurement can no longer revert a box below the store. The ONE piece of node state the view still holds is a narrow `resizeOverlay` (a single node's live box, null between gestures): a controlled `<ReactFlow>` applies no dimension change itself, so the in-flight NodeResizer drag needs its live size overlaid on the dragged node until the commit-on-release rebuild republishes it. `onNodesChange` now updates the overlay ONLY on gesture changes (`isResizeGestureChange`); the overlay is cleared during render on any fresh `snapshot.nodes` identity — so a refused drag-resize (which still publishes via its `GuardedWriteOutcome`) snaps back to the stored box.

Failing-first coverage: `src/view/resizeOverlay.test.ts` (jsdom) locks the two properties the fix rests on — a null overlay returns the snapshot-derived nodes UNCHANGED (same array identity, so no re-adopt/re-measure), and a gesture overlays only the dragged node.

**Files:** `src/view/VicinityGraphFlow.tsx` (derive+overlay), `src/view/nodeResize.ts` (`isResizeGestureChange` now a type guard; WHY updated), `src/view/resizeOverlay.test.ts` (new), `e2e/nodeResize.e2e.ts` (`renderTargetAsNeighbourBox` reverted to a plain in-place `refreshOpenViews()` fan-out — remount fallback + `IN_PLACE_REPAINT_BUDGET_MS`/`renderedBoxConvergesTo` removed), `CLAUDE.md` (screen-ahead note points at `applyResizeOverlay`).

**Verification:** `npm run check` clean, `npm test` 1724 passed (123 files). e2e validation loop: **10 consecutive full FLOOR suites + 3 full PINNED suites, all green, zero failures anywhere** — the stall historically reproduced ~1 in 3 floor runs, so 13/13 clean is strong evidence it is gone.

**Follow-up filed (distinct root cause):** nid_ghaeps3siekw0oe17mr4xpmad_e — restart-time stale controls (toolbar depth stepper stuck at defaults after an Obsidian restart). That is a first-build-before-`data.json`-load race in `GraphViewController`, pre-existing on floor, NOT the fan-out/box stall this ticket fixed; `controlsRestart.e2e.ts` is untouched by this work.
