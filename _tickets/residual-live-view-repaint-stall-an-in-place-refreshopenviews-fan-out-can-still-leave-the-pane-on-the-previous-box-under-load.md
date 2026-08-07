---
id: nid_1s77g4wx33uj8b380d1oph1d6_e
title: "Residual live-view repaint stall: an in-place refreshOpenViews fan-out can still leave the pane on the previous box under load"
status: open
deps: []
links: [nid_8vekpgg97n5x7ckxbwswr5uar_e]
created_iso: 2026-08-06T23:15:09Z
status_updated_iso: 2026-08-06T23:15:09Z
type: bug
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [view]
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

--------------------------------------------------------------------------------

This ticket was done prior to hard reset look for a branch with 'nid_1s77g4wx33uj8b380d1oph1d6_e' to see how it was handled.