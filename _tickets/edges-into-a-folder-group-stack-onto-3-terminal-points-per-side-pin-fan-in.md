---
id: nid_g1zb4b06gew54gnwcn5hx237j_e
title: "edges into a folder group stack onto 3 terminal points per side (pin fan-in)"
status: open
deps: []
links: []
created_iso: 2026-07-25T03:33:09Z
status_updated_iso: 2026-07-25T03:33:09Z
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [edge-routing, layout, aesthetics]
---

Surfaced while reviewing edge-routing__06 item (a), which made the folder-group boundary pins non-exclusive (`src/view/edgeRouting.ts`, `pin.setExclusive(false)`).

That change is a clear net win -- non-facing attachments 82 -> 40, route length -2.3%, and crowded sides stop wrapping. But because many connectors may now share one pin, distinct terminal points COLLAPSE. Measured on a 200x800 group with N leaves stacked down one side, one edge each:

    N=8 : 8 distinct terminals before -> 3 after, 6 of 8 at exactly the same point
    N=16: 13 distinct terminals before -> 3 after

3 is an architectural FLOOR, not a tuning artifact: `BOUNDARY_PIN_SPECS` (`src/view/edgeRouting.ts`) places exactly 3 pins per side, at 1/4, 1/2 and 3/4. No value of `EDGE_ROUTING_SHAPE_BUFFER_PX` changes it -- verified across buffers 5/8/11/14/16/17 in `.ai_out/edge-routing__06/main/SWEEP__PUBLIC.md` section 6.

User-visible consequence: N arrowheads drawn on top of each other at one point on the group border.

NOT YET CONFIRMED VISUALLY. No e2e fixture could show it at the time of filing: the `medium` fixture gives each group a single collapsed x4 edge, and the `dense` fixture has no folder groups. edge-routing__06 added a new dev-vault fixture with a folder group approached by several separate edges -- check that fixture FIRST and confirm the effect is actually objectionable on screen before building anything.

Evidence: `.ai_out/edge-routing__06/main/IMPLEMENTATION_REVIEW__PUBLIC.md` section 7.3 and `SWEEP__PUBLIC.md` section 6.

## Design

Only pursue if the fixture screenshot shows it actually looks bad.

Two candidate levers:
1. More pins per side (e.g. 5 at 1/6..5/6 instead of 3 at 1/4..3/4). Cheapest by far. WATCH PERF: `docs-internal/research/facing-side-edge-attachment.md` records that 4 directional pins per NOTE square revived a ~64x layout pathology (~8838ms vs ~1450ms). Group boxes are far fewer than notes, so per-group pins are much cheaper than per-note pins -- but measure, do not assume.
2. A spread heuristic that offsets co-terminal edges along the border at render time (view-only, no routing change). Avoids the pin-count/perf question entirely but adds geometry code in `src/view/edgeGeometry.ts`.

Prefer 1 if perf allows; it keeps the fix inside the routing model instead of papering over it at draw time.

## Acceptance Criteria

- Confirmed visually FIRST on the folder-group fixture that the stacking is objectionable (screenshot in `.out/`, never source-controlled). If it is not objectionable, close this ticket as a measured non-issue and record the screenshot evidence.
- If pursued: distinct terminal points per side increase, measured on the same probe corpus.
- Dense-fixture layout time does not regress (the 64x per-note-pin pathology must not return); the committed PERF BUDGET gate in `e2e/edgeRoutingEval.e2e.ts` stays green.
- No route terminates at a group CENTRE.
- `npm run check` and `npm test` green.

