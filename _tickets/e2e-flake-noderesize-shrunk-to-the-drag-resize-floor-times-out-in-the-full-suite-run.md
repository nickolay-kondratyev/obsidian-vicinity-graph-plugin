---
id: nid_g1f5tjmxzr0hbfdeujvgwywsd_e
title: "e2e flake: nodeResize 'shrunk to the drag-resize floor' times out in the FULL-suite run"
status: open
deps: []
links: []
created_iso: 2026-08-05T18:21:46Z
status_updated_iso: 2026-08-05T18:21:46Z
type: bug
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [e2e, flaky]
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

