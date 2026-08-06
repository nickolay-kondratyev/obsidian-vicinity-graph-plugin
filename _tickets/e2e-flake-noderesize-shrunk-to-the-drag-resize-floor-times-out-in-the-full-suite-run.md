---
closed_iso: 2026-08-06T17:10:22Z
id: nid_g1f5tjmxzr0hbfdeujvgwywsd_e
title: 'e2e flake: nodeResize ''shrunk to the drag-resize floor'' times out in the
  FULL-suite run'
status: closed
deps: []
links: []
created_iso: '2026-08-05T18:21:46Z'
status_updated_iso: 2026-08-06T17:10:22Z
type: bug
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [e2e, flaky]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Observed 2026-08-05 while landing nid_k2pa8khm6ugozmhkd6nlbdrq6_e.

SYMPTOM: `npm run test:e2e` (FULL suite, one worker) failed twice in a row on
`e2e/nodeResize.e2e.ts:360` — "WHEN a node is shrunk to the drag-resize floor THEN
the chip that would cover its centre is withheld". The helper
`renderTargetAsNeighbourAt(NODE_OVERRIDE_HARD_MIN_PX /* 24 */)`
(e2e/nodeResize.e2e.ts:325-330) polls for 15s and keeps reading the PREVIOUS
test's box:

    Expected {widthPx: 24, heightPx: 24}
    Received {widthPx: 40, heightPx: 40}

i.e. the store-override write + `refreshOpenViews()` did not repaint the node at
the new box within 15s. Because the file is serial, the case after it did not run.

NOT reproducible in isolation: `npm run test:e2e -- nodeResize.e2e.ts` (13 passed),
`-- nodeOutline.e2e.ts nodeResize.e2e.ts` (28 passed) and
`-- controlsRestart.e2e.ts nodeResize.e2e.ts` (14 passed) are all green. Two LATER
full-suite runs on the same tree were green (139 passed), so it is order/state
dependent, not a regression of the preview-tier change (a clean-tree full run was
also green).

SUSPECT: shared vault state across e2e FILES (each file launches its own Obsidian,
but `data.json` persists). `e2e/nodeOutline.e2e.ts` E7 sets `maxNodeSizePx` to 96
and never restores it, and nodeOutline runs immediately before nodeResize; the pair
run did not reproduce, so if that is the cause it needs a third file's leftovers too.

WHAT TO DO: make the failure legible before chasing it — have
`renderTargetAsNeighbourAt` assert the STORED override reached 24 before polling
the rendered box, so a future failure says whether the write or the repaint was
lost. Then consider resetting the plugin's stored settings in each spec's
`beforeAll` (or restoring `maxNodeSizePx` at the end of nodeOutline E7) so files
stop inheriting each other's dials.

## Acceptance Criteria

The full `npm run test:e2e` suite is green across repeated runs, and the nodeResize floor case either cannot inherit another spec's stored dials or fails with a message naming which half (store write vs repaint) was lost.

## Resolution (2026-08-06)

Closed. Two findings that reframe the ticket, plus the legibility fix it asked for.

1. **The SUSPECT (cross-file dial inheritance) is impossible.** Every spec's
   `beforeAll` calls `ObsidianHarness.launch()`, which for the dev-vault mode runs
   `prepareVaultCopy` — that wipes the throwaway vault copy AND deletes
   `.obsidian/plugins/<id>/data.json` before boot
   (`e2e/obsidianHarness.ts:560-602`). So nodeResize starts with a FRESH
   `data.json`; nodeOutline E7's un-restored `maxNodeSizePx=96` cannot reach it.
   The failure's `Received {40,40}` was the IMMEDIATELY-PRECEDING test's box within
   the SAME file (`SHIPPED_MIN_NODE_PX = minPx = 40`), i.e. a within-file repaint
   stall, not an inherited dial. No `beforeAll` reset was added (it would be dead
   code guarding an impossible leak).

2. **The underlying repaint defect was already fixed after this ticket was filed.**
   Ticket filed 2026-08-05; commit `b610e39` (2026-08-06 16:06) — "fix(view): stop
   RF re-measurements clobbering a fresh publish" — closed
   `nid_c78k90su87jrzigxvfjv5t95g_e`, the exact swallowed-fan-out that produced the
   stale-box symptom, by filtering `onNodesChange` to resize-GESTURE dimension
   changes only (`isResizeGestureChange`), and restored the helper to the real
   `refreshOpenViews()` fan-out. The flake in this ticket was observed on the
   pre-`b610e39` tree.

**Change made:** the "make the failure legible" step. `renderTargetAsNeighbourBox`
(`e2e/nodeResize.e2e.ts`) now asserts the STORED override equals the requested box
(`expect.poll(readNodeOverrides()[TARGET_DOCID].sizePx).toEqual(box)`) BETWEEN the
`saveNodeSizeOverride` write and the rendered-box poll. A store already holding the
box means any later failure of the render poll can only be a lost REPAINT, never a
lost write — the two halves are now distinguishable in the failure output. Exact
equality is safe: `clampNodeSizeOverridePx` only bounds `24..1200`, so every box the
helper uses (24 / 40 / 160) stores verbatim.

**Verification:** `npm run check` clean; `npm run test:e2e` FULL suite green twice
consecutively (145 passed each), including
`nodeResize.e2e.ts:452 › ...shrunk to the drag-resize floor...`.
