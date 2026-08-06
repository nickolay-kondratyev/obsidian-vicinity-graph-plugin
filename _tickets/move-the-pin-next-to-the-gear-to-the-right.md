---
closed_iso: 2026-08-06T23:05:07Z
id: nid_370bypsi9y00wa0ln8embafn6_e
title: move the pin next to the gear (to the right)
status: closed
deps: []
links: []
created_iso: '2026-08-06T22:57:26Z'
status_updated_iso: 2026-08-06T23:05:07Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-3
---
Right now the pin appear on the left side of the node 
Move the pin next to gear so that we will have



CURRENT:
------------------------------
| PIN                   GEAR |
|                            |
|                            |
------------------------------

DESIRED:
------------------------------
|                   PIN GEAR |
|                            |
|                            |
------------------------------

## Resolution (DONE)

The pin chip now rides the top-RIGHT corner beside the gear (reads `PIN GEAR`)
instead of the top-left corner.

CSS-only move in `src/view/graph-view.css` (no JS change needed):
- Gear stays corner-anchored at `right: var(--vicinity-graph-node-chip-inset)`.
- Pin switched from `left: <inset>` to
  `right: calc(inset + chip-size + gap)`, so it sits exactly one chip-width plus
  a gap to the LEFT of the gear.
- Added a `--vicinity-graph-node-chip-gap` custom property (`var(--size-2-1)`).
  The pin's offset is built from the SAME `--vicinity-graph-node-chip-*`
  properties the size ladder steps, so the pin stays flush against the gear at
  both the full-size and compact rungs.

Centre-clearance/grip-band arithmetic is unchanged: both chips still share the
top edge and the base-class inset, and the gear is the corner-most chip the
grip-band guard measures. Stale "top-left" comments updated in
`src/view/NoteNode.tsx` (PinButton/GearButton docs) and
`src/view/nodeDensityThresholds.test.ts`.

Verification: `npm run check`, `npm test` (1705 passed), and
`npm run test:e2e -- vicinityGraph.e2e.ts` (27 passed) all green;
`styles.css` regenerated via `npm run build`.
