---
id: nid_k2pa8khm6ugozmhkd6nlbdrq6_e
title: "auto preview: do NOT show the outline by default for non-central non-pinned notes"
status: open
deps: [nid_jcxzhexfaksge2arjzca3w7ff_e]
links: [nid_1mq3t7706vw2kj2kv7ljqlw6l_e, nid_jcxzhexfaksge2arjzca3w7ff_e, nid_9hx6okamx3yt0rg9iad2f4151_e]
created_iso: 2026-08-05T17:58:46Z
status_updated_iso: 2026-08-05T17:58:46Z
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [ui, sizing, decide]
---

OWNER DECISION (2026-08-05), taken while closing the density-floor decide ticket nid_1mq3t7706vw2kj2kv7ljqlw6l_e (_tickets/closed/ux-decide-content-fit-nodes-are-floored-at-the-css-density-rungs-any-note-with-one-heading-is-122px.md).

WHERE WE WANT TO GO: in the AUTO node preview mode, an ordinary note - NOT the central, NOT pinned - should render TITLE ONLY by default. The outline (and by extension the preview slot) becomes a thing the central / pinned nodes get, not something every neighbour in the vicinity gets.

WHY: with content-fit sizing landed (nid_cx5zoz7ptucg9nxalibv0mbjb_e), any note with even ONE renderable heading is floored at the CSS reveal rung (122px, 124px for centrals) so the outline actually paints. At shipped defaults 40/160 that means nearly every content-bearing node sits in 122..160px: node size stops discriminating, and the graph reads as a wall of near-identical big boxes. Rather than lower the CSS density rungs (option 2/3 in the closed ticket) the owner wants to cut the demand for the outline instead - peripheral notes do not need their headings shown, the central does.

EXPECTED CONSEQUENCE (the point of the change): a peripheral note with headings falls back to minPx (40px at defaults) because it shows no preview region, so the reveal floor never engages for it. Size discrimination is restored where it matters and the graph gets much lighter. The density-floor question in the closed ticket then only concerns centrals / pinned / explicitly-overridden nodes, where the 104px slot is genuinely wanted.

SCOPE / TOUCH POINTS:
- src/view/nodePreviewChoice.ts - the pure chooser is where auto resolves today; it must become tier-aware (main / pinned-central / pinned vs ordinary neighbour). Keep it PURE and unit-tested.
- src/engine/NodeSizer.ts - sizing must agree with what the chooser resolves, otherwise we reintroduce exactly the dead-space bug the floor was added to fix (a node sized for an outline the view never renders). revealFloorPx / revealMinNodePx(rung, isCentral) in src/engine/constants.ts only apply where a preview is actually shown.
- Explicit per-node overrides and an explicit GLOBAL Outline preference must still win - this changes AUTO only.
- src/view/nodeDensityThresholds.test.ts pins engine constant == css rung + chrome; keep it green.
- e2e/nodeOutline.e2e.ts asserts outline reveal bands on rendered nodes - several of those are behaviour-capturing on NON-central nodes and will need explicit re-alignment as part of this change, not silent edits.

RELATED / SEQUENCING: overlaps the Title-only preference ticket nid_jcxzhexfaksge2arjzca3w7ff_e (adds the "title-only" preview kind to the enum + copy) - this ticket is most cheaply built ON TOP of that kind rather than inventing a second way to render a bare title. Per-node override menu: nid_9hx6okamx3yt0rg9iad2f4151_e.

STILL TO DECIDE (flag to owner before implementing): (a) do PINNED non-central notes get the outline, or only the central + pinned-CENTRAL? (b) is this fixed behaviour or a global setting with the new tier-aware behaviour as the default? Prefer fixed first (80/20) and add a knob only if it is missed.

## Acceptance Criteria

In auto mode an ordinary non-central non-pinned note renders title only and sizes to minPx; the central (and pinned, per the decision above) still renders its outline; an explicit global Outline preference or a per-node override still forces the outline anywhere; NodeSizer never sizes for a region the chooser will not render; npm test and npm run test:e2e green with the nodeOutline e2e bands explicitly re-aligned.

