---
closed_iso: 2026-08-18T02:35:52Z
session_ids: [{"a": "claude", "type": "execution", "id": "0cc2d87e-4308-4767-a015-ba0b0e377fbe"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_1ycy9aszptp9fih76equxtcqa_e
title: "Named relationships: GREAT UI for multi-name edges"
status: closed
deps: [nid_wnagjm2j144u0jsgixpcmmpar_e]
links: []
created_iso: 2026-08-17T16:44:24Z
status_updated_iso: 2026-08-18T02:35:52Z
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [named-relationships, ui]
---

Part of the named-relationships set. Read the PLAN first: `_tickets/add-ability-for-named-relationships.md` (closed plan ticket nid_fg66tanwkoyq3cqs1wdxagn21_e) — full syntax spec, signed-off decisions, architecture. Repo conventions: `CLAUDE.md` (layering view→adapters→engine, BDD tests, settings machinery).

Design-quality presentation when one drawn edge carries SEVERAL relation names (explicit sign-off: all names shown ON the edge, and this deserves focused design work — load the UI skill / ${MY_DEEP_MEM}/my-frontend-design.md before coding).

Scope (presentation only, no data-model changes): legibility across zoom levels; label collision with React Flow edge paths; truncation when a pair has many names; how names attach to DIRECTION on a collapsed bidirectional edge (A→B names vs B→A names on one edge); coexistence with the count badge; light/dark via Obsidian theme variables.

Iterate with screenshots into .out/ (never source-controlled). e2e for final behavior.

--------------------------------------------------------------------------------

## Resolution (2026-08-17)

GREAT multi-name edge UI shipped. Presentation-only, no engine data-model change
(the direction split is derived in the VIEW layer from data the engine already
carries as separate ordered-pair edges).

### What was built

1. **Direction-aware labels (view layer).** `src/view/flowMapping.ts` now tags
   every rendered relation label with the direction it travels relative to the
   edge's drawn `source → target` orientation — new `DirectedRelationLabel` /
   `RelationDirection` types, and `FlowEdge.relations` carries them. The collapse
   accumulator keeps a `forwardRelations` / `backwardRelations` bucket pair (each
   deduped on its own), so a collapsed **bidirectional** edge preserves which
   names go which way (previously a flat union that lost direction). Passthrough
   edges are all-forward. Per-pair flyout attribution (`EdgeNotePair.relations`)
   is unchanged.

2. **Pure label planner** `src/view/edgeRelationLabels.ts` (`planRelationLabelStacks`,
   node-tested, RF-free) turns the directed labels + edge geometry into the
   drawn stacks and owns the two design rules:
   - **Truncation:** each direction shows at most `MAX_RELATION_LABELS_PER_STACK`
     (= 3) names; the rest fold into a single `+N` overflow chip (copy in
     `badgeText.ts`: `relationOverflowBadgeText` / `relationOverflowTitle`). The
     full list stays one click away in the edge flyout.
   - **Direction on a collapsed bidirectional edge:** names travelling both ways
     split into TWO stacks, each biased toward the arrowhead it points INTO
     (forward → target arrowhead, backward → source arrowhead via
     `DIRECTION_STACK_BIAS`), so the arrowhead disambiguates without glyph noise.
     Every one-directional edge keeps ONE midpoint stack (its lone arrowhead
     already tells the direction), leaving the count badge on the midpoint.

3. **Rendering + styling.** `src/view/VicinityEdge.tsx` maps the planned stacks to
   markup inside React Flow's `EdgeLabelRenderer` (`RelationLabelColumn`, keyed by
   direction, `data-direction` seam for tests; chips stay `pointer-events:none` so
   the edge underneath stays clickable). `src/view/graph-view.css` polishes the
   chips into accent-bordered pills with an opaque `--background-primary` fill
   (occludes the edge line for legibility), a muted `--overflow` variant, and a
   capped `max-width` with ellipsis. All theme vars → light/dark both correct.
   EdgeLabelRenderer is screen-space, so labels stay legible at every zoom.

### Where the coverage lives

- `src/view/edgeRelationLabels.test.ts` — planner: empty / one-stack / two-stack
  anchoring / independent truncation.
- `src/view/flowMapping.test.ts` — directed union incl. a collapsed edge that
  unions OPPOSING named pairs keeping each label's direction.
- `e2e/namedRelationships.e2e.ts` — real Obsidian: single forward-tagged stack,
  and an edge with 5 names truncating to 3 + `+2` (fixtures `many-src`/`many-dst`).
- Design eyeballed via `.out/relation-two-forward.png` and
  `.out/relation-truncated.png` (temp shot spec used then removed; `.out/` is
  git-ignored). `npm test` (2377 pass), `npm run check` (0 errors),
  `npm run test:e2e -- namedRelationships.e2e.ts` (6 pass) all green.

### Notes for the next reader

- `e2e/` is a plain directory in THIS checkout (no `.gitmodules`), despite the
  CLAUDE.md submodule note — committed together with `src/`.
- No caret/arrow glyph on labels was a deliberate call: the edge arrowhead is the
  direction signifier, so the two-way case relies on spatial anchoring beside the
  arrowhead rather than adding a `→`/`←` that would be ambiguous on a mutual edge
  and fight the "collapse, don't multiply / glance cedes to flyout" owner principle.

