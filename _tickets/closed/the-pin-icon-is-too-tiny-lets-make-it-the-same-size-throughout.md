---
closed_iso: 2026-08-05T19:04:52Z
id: nid_8i5936g90vrllosssaz7v3xbr_e
title: The pin icon is too tiny lets make it the same size throughout
status: closed
deps: []
links: []
created_iso: '2026-08-05T18:52:13Z'
status_updated_iso: 2026-08-05T19:04:52Z
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
---
The "to pin" icon on smaller nodes appears quite tiny even though there is enough space to actually show the full sized icon. Lets show the full size "to pin" icon even when nodes are small.


## Resolution (commit cc97b84)

**Root cause.** `src/view/graph-view.css` declared the COMPACT chip (14px box,
10px icon) as the default and GREW it to full size (20px box, 13px icon) in a
`@container (min-height: 72px)` rung — i.e. on the node's HEIGHT alone. The
common small node is a title-only note: ~minPx (40px) TALL but as wide as its
title, so it fell under that rung and wore the tiny chip even though its
top-right corner had room to spare.

**Fix.** Inverted the ladder. The full-size chip is now the DEFAULT, and two
`max-*` container queries only ever step it DOWN, each firing exactly where the
chip above it would cover the node's CENTRE point (where a click means "open the
note" — the reason the compact chip existed at all):

| chip | reach (`inset + size`) | rung: content box on BOTH axes |
|---|---|---|
| full-size (default) | 4 + 20 = 24px | `<= 32px` -> step down to compact |
| compact | 3 + 14 = 17px | `<= 18px` -> withheld (right-click menu) |

Both rungs read BOTH axes (`and`, not a comma), which is the whole point: a
short-but-WIDE node's centre is nowhere near the chip, so it keeps the full-size
one. A square node at the shipped 40px minPx still steps down, and the
drag-resize floor (24px) still withholds — unchanged behaviour there.

**Files.**
- `src/view/graph-view.css` — the ladder above.
- `src/view/nodeDensityThresholds.test.ts` — each rung re-derived from the
  declarations of the chip it steps down FROM (32 and 18 are computed, never
  literals), plus a new monotonicity guard so no rung can grow the chip again.
- `src/engine/constants.ts` / `index.ts` — deleted
  `PIN_CHIP_FULL_SIZE_CONTENT_BOX_PX` (the rung it named no longer exists) and
  its assertions in `src/engine/NodeSizer.test.ts`,
  `e2e/pinnedCentralScenario.e2e.ts`, `e2e/controlsRestart.e2e.ts`.
- `e2e/nodeResize.e2e.ts` — new coverage: a short-but-WIDE node's chip renders
  the SAME box as a large node's, and a node small on both axes still steps
  down. The first was verified FAILING against the old height-only rung before
  the fix was kept.
- `docs-internal/plan/high-level-plan.md` — the pin-chip and central-floor
  bullets.

**Called out / follow-up.** `CENTRAL_PROMINENCE_FLOOR_SCORE` was raised 0.35 ->
0.44 solely so an empty central cleared the old full-size rung. That reason is
now gone, but the value was KEPT (reverting would shrink every empty central
93px -> 82px, a visible sizing change this ticket did not ask for). The owner
decision is tracked in `nid_s1474ljrdqneqhqt5zrkpwva2_e` (tagged `decide`).

**Verification.** `npm test` 1647 passed, `npm run check` clean,
`npm run test:e2e` 141 passed.
