---
closed_iso: 2026-08-05T02:23:14Z
id: nid_tclb98q9hxhmcuonamvr4ig1f_e
title: "UX decide: hover pin chip is hidden on small nodes \u2014 now including a\
  \ default-sized empty MAIN/pinned central"
status: closed
deps: []
links: []
created_iso: '2026-08-04T23:36:52Z'
status_updated_iso: 2026-08-05T02:23:14Z
type: bug
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [ui]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
---
Pre-existing density rule: the hover pin chip renders only when the node is at least 72px CONTENT-box tall (`src/view/graph-view.css`, the @container (min-height: 72px) reveal — about 90px border-box after padding+border). Below that, pin/unpin is only reachable via the node's right-click menu.

Content-fit sizing (ticket nid_cx5zoz7ptucg9nxalibv0mbjb_e, owner-decided) made this the COMMON case: a title-only note now renders at ~minPx (40px), and an EMPTY central sits at the 0.35 prominence floor = 82px border-box (64px content) — so even the MAIN central of an empty note has NO hover pin affordance at shipped defaults. Two e2e pin fixtures had to be padded with headings to keep the hover gesture testable (e2e/controlsRestart.e2e.ts, e2e/pinnedCentralScenario.e2e.ts).

Options to decide between (not exclusive):
1. Always reveal the pin chip on hover regardless of node height (maybe a smaller chip below 72px). - Yes lets always show the pinning when hoevered
2. Raise CENTRAL_PROMINENCE_FLOOR_SCORE so a default central clears the chip threshold (0.35 -> ~0.42 at 40/160 defaults) — couples a sizing constant to a CSS density threshold. - Yes I think making the nodes big enough to fit the pin makes sense.

## Acceptance Criteria

Owner decision recorded; if a change is made, the hover pin affordance on a default-sized (empty, title-only) node and on an empty MAIN central is either present or explicitly decided against, with e2e coverage matching.


## Notes

**2026-08-05T00:55:15Z**

Partly moved by the reveal-floor fix (nid_1mq3t7706vw2kj2kv7ljqlw6l_e): a node carrying an outline or a thumbnail is now floored at 122px and one carrying attachments at 90px, so BOTH clear the chip's 90px threshold. Still open for the cases named above: a title-only note (minPx, 40px) and an EMPTY MAIN/pinned central (prominence floor, 82px) have no hover pin affordance.

## Resolution (2026-08-05) — BOTH options implemented, as marked above

**1. The chip is now revealed on hover at EVERY node height** (`src/view/graph-view.css`).
The `@container (min-height: 72px)` `display` gate is gone; the base rule is
`display: inline-flex` with the pre-existing `opacity: 0` + `pointer-events: none`
guard (unchanged — an invisible chip must not eat the node's open-click). Below the
rung the chip only goes COMPACT: `14px` chip / `10px` icon / `2px` inset, driven by
three custom properties (`--vicinity-graph-pin-chip-{size,inset}`,
`--vicinity-graph-pin-icon-size`) that the 72px query re-declares as `20px` / `13px` /
`--size-4-1`. WHY compact rather than one size: at minPx a node can be ~40x40, and a
20px chip inset 4px reaches the node's CENTRE point — exactly where a click meant to
open the note lands. The custom-property split also keeps the chrome reset (which
must out-specify Obsidian's `button:not(.clickable-icon)`) declared once.

**2. `CENTRAL_PROMINENCE_FLOOR_SCORE` 0.35 -> 0.44** (`src/engine/constants.ts`), so the
node people pin/unpin most gets the FULL-SIZE chip. 0.42 (the figure guessed in the
ticket) is 2px short: a central's 2px accent ring costs it content box, so it needs
92px border-box, not 90. 0.44 -> 93px / 73px content. Deliberately still a FRACTION of
the user's `minPx..maxPx` ramp, so it can never exceed `maxPx`; at dials with no room
for the full-size chip the chip simply stays compact — it is revealed either way.

New constant `PIN_CHIP_FULL_SIZE_CONTENT_BOX_PX` (aliases the attachment rung — one
ladder, not two) names what the tuning is against.

### Coverage
- `src/engine/NodeSizer.test.ts` — an empty central's floor clears
  `revealMinNodePx(PIN_CHIP_FULL_SIZE_CONTENT_BOX_PX, true)` (the 0.44 tuning, executable).
- `src/view/nodeDensityThresholds.test.ts` — two new guards: the chip's base rule is
  `display: inline-flex` (never height-gated again), and the sole container query that
  resizes it sits on the rung the engine tunes against.
- e2e: both padded pin fixtures are BARE again — `rt_x.md` (`e2e/controlsRestart.e2e.ts`)
  is a minPx node and `sc_hub.md` (`e2e/pinnedCentralScenario.e2e.ts`) is an EMPTY MAIN
  central, so each spec's existing hover-and-click IS the affordance proof. Each also
  asserts its precondition (content box below / at-or-above the rung) so re-padding the
  fixture cannot silently retire the coverage. `sc_x.md` keeps its headings — it doubles
  as the pinned-central depth fixture.
- Stale comment in `e2e/vicinityGraph.e2e.ts` (why the click tests use the big-node
  vault, and the "tracked follow-up" pointer at this ticket) rewritten.
- `docs-internal/plan/high-level-plan.md` updated (prominence floor + a new node-render
  bullet for the always-on chip).

`npm test` (1611), `npm run check` and the FULL `npm run test:e2e` (135 passed, 1 skipped)
all green. Visually verified with screenshots of a hovered minPx node and a hovered empty
MAIN central (`.out/`, not source-controlled).

## Follow-up (2026-08-05, adversarial review of the fix)

The "compact chip clears the node's centre point" claim above held only for the
SHIPPED 40px `minPx`. `minPx` is a dial with a 1px floor and a drag-resize override
may be as low as `NODE_OVERRIDE_HARD_MIN_PX` (24px) — on such a node the 14px/2px
chip sits ON the centre point and, being revealed by the same hover that precedes
the click, swallowed the open-click. Before this ticket the 72px `display` gate had
hidden it there, so the always-on chip regressed click-to-open at those sizes.

Added a CENTRE-CLEARANCE rung in `src/view/graph-view.css`: the chip is withheld
when the node's content box is ≤16px on BOTH axes — `2 x (inset + size) - padding`,
the exact band in which the corner chip covers the centre. `and`, not a comma: a
wide-but-short node's centre is nowhere near the chip. Stated as `max-*` so it fails
OPEN (a broken container leaves the chip present rather than deleting it everywhere),
and the chip now declares `box-sizing: border-box` so its reach is what the rung
assumes. `nodeDensityThresholds.test.ts` recomputes the 16px from the chip's own
declarations plus the node padding. At shipped defaults nothing changes (a 40px node
is 22px of content), so the ticket's decision stands intact.

## Follow-up (2026-08-05, second adversarial review)

The centre-clearance invariant was proven for only ONE of the two chip rungs. The
withholding query (`max-height: 16px and max-width: 16px`) is derived from the
COMPACT chip's declarations, but above 72px the chip grows to `20px` inset `4px` —
a 24px reach, which covers the centre of any node whose content box is ≤32px. The
72px rung itself is inherited from the attachment row for an unrelated reason
(`PIN_CHIP_FULL_SIZE_CONTENT_BOX_PX` aliases it), so nothing tied it to that reach:
lowering the rung, or growing the full-size chip, would reinstate the swallowed
open-click in a band the `max-*` query never fires in, with every existing guard
still green — the same "a claim about defaults, not a guarantee" criticism the
first follow-up levelled at guard 2.

`nodeDensityThresholds.test.ts` now recomputes the clearance for BOTH rungs from
each rung's own declarations (the parser accepts the `--size-4-N` token the
full-size inset uses, so neither rung has to be restated in px for the guard's
benefit) and asserts the full-size rung sits above its chip's covered band. No
behavior change — 72 > 32 today; verified the new guard bites by temporarily
growing the full-size chip to 40px.
