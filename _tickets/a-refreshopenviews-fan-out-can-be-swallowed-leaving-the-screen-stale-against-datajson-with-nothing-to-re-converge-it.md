---
id: nid_c78k90su87jrzigxvfjv5t95g_e
title: "A refreshOpenViews fan-out can be swallowed, leaving the screen stale against data.json with nothing to re-converge it"
status: open
deps: []
links: []
created_iso: 2026-08-06T00:40:08Z
status_updated_iso: 2026-08-06T00:40:08Z
type: bug
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [view, decide]
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

