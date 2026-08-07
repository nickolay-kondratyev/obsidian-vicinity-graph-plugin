---
closed_iso: 2026-08-06T16:06:21Z
id: nid_c78k90su87jrzigxvfjv5t95g_e
title: A refreshOpenViews fan-out can be swallowed, leaving the screen stale against
  data.json with nothing to re-converge it
status: closed
deps: []
links: []
created_iso: '2026-08-06T00:40:08Z'
status_updated_iso: 2026-08-06T16:06:21Z
type: bug
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [view, decide]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
---
Found while reviewing ticket `nid_8i5936g90vrllosssaz7v3xbr_e` (the pin-chip ladder). NOT caused by it — that ticket only added the e2e spec that exposes it.

## Reproduction (~1 in 3 runs; the spec below now REMOUNTS instead, so reproducing needs the step-3 variant restored)

`npm run test:e2e -- nodeResize.e2e.ts`, spec "WHEN a node is short but WIDE THEN its pin chip is the same size as a large node's" in `e2e/nodeResize.e2e.ts`. Its setup helper `renderTargetAsNeighbourBox` does exactly what the production write pipeline does:

1. `harness.openFile(HUB)` (awaited; active file polled to HUB, HUB polled to `data-tier=main`)
2. `harness.saveNodeSizeOverride(TARGET_DOCID, {widthPx:160, heightPx:40})` — awaited, so `PluginDataStore` memory is already updated
3. `harness.refreshOpenViews()` — the same call `ViewsRefreshPort.refreshAllViews` makes
4. poll the rendered box

Observed on a failing run, instrumented:

```
DEBUG stored=            {"docid_resizetarget_e":{"sizePx":{"widthPx":160,"heightPx":40}}}
DEBUG rendered=          {"widthPx":40,"heightPx":40}     <- stable for the full 15s poll
DEBUG after-2nd-refresh= {"widthPx":160,"heightPx":40}    <- ONE more refreshOpenViews() fixes it
DEBUG activeFile= rz_hub.md
DEBUG hubTier= main
```

So: the store is correct, the screen is stale, and NOTHING re-converges it — only a second, unprompted fan-out does.

## Why this matters beyond the test

`refreshOpenViews()` is THE fan-out for every settings write, for the pinned-set write and for the per-node size-override write (`src/main.ts:150` -> `VicinityGraphView.refresh()` -> `GraphViewController.handleSettingsChanged()`). If one can be swallowed, a pin toggle or a settings change can leave the pane painting the previous state until some unrelated event rebuilds it. A committed drag-resize happens to HIDE this, because the released box is already in React Flow local node state (see the `GuardedWriteOutcome` note in `CLAUDE.md`) — which is likely why it was never noticed.

## What the experiments showed (do not redo these)

- **One extra fan-out sometimes fixes it, a retry loop does NOT.** Re-issuing `refreshOpenViews()` on every poll attempt (8 of them across 15s, 2s apart so none could supersede another) still left the screen on the previous box. So this is not a lost-signal race that a retry papers over; once the pane is in the stale state it can STAY there.
- **The stale box goes both directions** — 40x40 held against a stored 160x40, and 160x40 held against a stored 40x40. Nothing direction-specific (not "shrink only", not a `layoutFit` fit/no-fit asymmetry).
- **A REMOUNT always renders the store correctly.** `harness.remountGraphView()` (detach the leaf, reopen) was green 8/8 where the fan-out was flaky. So the store, the engine, the sizer and `nodeDimensionsPx` are all fine — what is stale is state that survives inside the LIVE view.

## Leading hypothesis: React Flow's measured dimensions clobber the publish

`VicinityGraphFlow` keeps nodes in LOCAL state and applies RF's own dimension changes unconditionally:

```ts
const onNodesChange = useCallback<OnNodesChange>(
    (changes) => setNodes((current) => applyNodeChanges(changes.filter(isDimensionsChange), current)),
    [],
)
```

A publish reseeds that local state from `snapshot.nodes`; RF's ResizeObserver then MEASURES the DOM. If the observer fires against the pre-reseed box, `isDimensionsChange` lets that stale measurement straight back into local state — and it then agrees with the DOM forever. That matches every observation: the stickiness, the flakiness (observer vs reseed commit order), the both-directions symmetry, and why a remount is immune (no local state to clobber).

It also predicts a USER-visible case that has nothing to do with tests: with TWO graph views open, a drag-resize in view A fans out to view B, whose local state never saw the drag.

`isDimensionsChange` is in `src/view/VicinityGraphFlow.tsx` (see the `onNodesChange` WHY block, which reasons about which change TYPES to apply but not about which SOURCE they came from — a resize gesture vs RF re-measuring what it already rendered).

## What was ruled out by reading the code

`GraphViewController.runRebuild` looks airtight on latest-wins: `rebuildToken` is incremented SYNCHRONOUSLY at entry (`src/view/GraphViewController.ts:307`) and `isStale(token)` is re-checked after the build, after layout, after routing and immediately before `publish`. So a rebuild that started BEFORE the store write cannot publish after one that started AFTER it. The rebuild triggered at step 3 reads `graphBuilder.build(mainPath)` fresh. By that reasoning the observed outcome should be impossible — which is exactly why this needs a real investigation rather than a guess.

Candidates NOT yet excluded (each needs checking):
- `VicinityGraphView.refresh()` is `this.controller?.handleSettingsChanged()` — a null controller makes the fan-out a SILENT no-op.
- `VicinityGraphBuilder` / `pathDocIdMap` reading a docid->override association from a snapshot captured before the write.
- an `attemptBuildAndPublish` retry path returning early on a stale token in a way that leaves no successor.

## Acceptance

A failing test FIRST that pins the invariant "after an awaited store write followed by ONE refreshOpenViews(), the pane renders the stored state" — ideally at the `GraphViewController` unit level (it is fake-driven) rather than only in e2e. Then the fix. Then `renderTargetAsNeighbourBox` (`e2e/nodeResize.e2e.ts`) can go back to `refreshOpenViews()` instead of `remountGraphView()` — it remounts ONLY because of this bug, and says so in its comment.

## Notes

**2026-08-06T16:06:21Z**

## RESOLUTION (2026-08-06) — FIXED

The leading hypothesis was correct: React Flow's ResizeObserver re-measurement
clobbered a fresh publish.

### Root cause
`onNodesChange` in `src/view/VicinityGraphFlow.tsx` folded RF `dimensions`
changes into controller-owned local node state filtered only by change TYPE
(`isDimensionsChange` = `change.type === "dimensions"`). RF emits `dimensions`
changes from TWO sources:
  - a NodeResizer drag GESTURE — carries a `resizing` boolean (`true` mid-drag,
    `false` on release). Verified: `@xyflow/react` index.js:4876/4898.
  - RF's own ResizeObserver RE-MEASURING a node it already rendered — a plain
    `{type:'dimensions', dimensions}` with NO `resizing` field. Verified:
    `@xyflow/system` updateNodeInternals, index.js:1874-1878.

A publish reseeds local state with the NEW box; a ResizeObserver callback that
measured the node's PRE-reseed DOM then fed the OLD box straight back in. Local
state then agreed with the (still-stale) DOM, so nothing re-converged it — the
whole fan-out was swallowed. Matches every observation (stickiness, both
directions, remount immunity, retry-loop not helping).

### Fix
Extracted `isResizeGestureChange` into `src/view/nodeResize.ts`:
`change.type === "dimensions" && change.resizing !== undefined`. The `resizing`
flag's PRESENCE is the source discriminator — a gesture carries it, a
re-measurement never does. `onNodesChange` now filters on it, so RF
re-measurements no longer touch controller-owned state while the resize-drag
box still survives to the commit rebuild (GuardedWriteOutcome "screen-ahead").

### Tests
- FAILING-first unit test at the seam: `src/view/nodeResize.test.ts` —
  `isResizeGestureChange` applies mid-drag + released resizes, does NOT apply a
  re-measurement (the case the old predicate got wrong) or a selection change.
  This is the fake-driven unit level; the GraphViewController itself was already
  airtight (it publishes the correct snapshot — the staleness was purely in the
  view's RF local state, so a controller test would pass with or without the fix).
- `renderTargetAsNeighbourBox` (`e2e/nodeResize.e2e.ts`) restored to
  `refreshOpenViews()` (was `remountGraphView()` only to dodge this bug); comment
  updated. Green 3/3 full-spec runs (was ~1-in-3 flaky).

### Verification
`npm run check` clean; `npm test` 1660/1660; `npm run test:e2e -- nodeResize.e2e.ts`
15/15 ×3; `npm run test:e2e -- vicinityGraph.e2e.ts` 26/26.

Also fixes the predicted USER-visible case: two graph views open, a drag-resize
in view A fans out to view B whose local state never saw the drag.
