---
closed_iso: 2026-08-18T03:01:33Z
session_ids: [{"a": "claude", "type": "execution", "id": "86bf33f4-3a20-4d47-ae57-87c1e03f4737"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_adesjb4clls56623vdu773ubg_e
title: "Idea: per-relation-name edge styling (color/dash)"
status: closed
deps: [nid_wnagjm2j144u0jsgixpcmmpar_e]
links: []
created_iso: 2026-08-17T16:44:24Z
status_updated_iso: 2026-08-18T03:01:33Z
type: feature
priority: 4
assignee: CC_WITH-nickolaykondratyev
tags: [named-relationships, idea]
---

Deferred idea from the named-relationships set. Read the PLAN first: `_tickets/add-ability-for-named-relationships.md` (closed plan ticket nid_fg66tanwkoyq3cqs1wdxagn21_e) — full syntax spec, signed-off decisions, architecture. Repo conventions: `CLAUDE.md` (layering view→adapters→engine, BDD tests, settings machinery).

Distinct visual styling per relation name (color/dash/weight), so e.g. `supports` vs `contradicts` edges are distinguishable at a glance without reading labels. Deliberately EXCLUDED from V1 (sign-off). Consider: user-configurable name→style mapping vs deterministic hashing; interplay with the multi-name edge UI; theme-variable-based palettes.

## Resolution (2026-08-17)

Shipped **deterministic per-relation-name colour** (the 80/20 slice). Ran
NON-INTERACTIVELY; the open product choices were decided as below and are stated
here so a reader need not re-derive them.

**Decisions taken (no human round-trip needed — small, reversible, no persisted
data to regret):**
- **Deterministic hashing, NOT a user-configurable name→style map.** The name
  hashes to a hue; nothing to configure, persist, or migrate. A configurable map
  stays deferred — the hashed default doesn't foreclose it (a future map would
  just override the slot). This is the signed-off "just works" 80/20.
- **Colour only — no dash/weight.** Kind-based dashing was already dropped as
  reading WEAKER than a solid stroke (ticket `nid_zxnhehkpoj3q2peirauby6w4q_e`,
  see the graph-view.css kind-seam note), so colour is the one distinguisher
  worth spending.
- **Interplay with multi-name edges:** the ticket's literal goal (distinguish
  WITHOUT reading labels) needs the LINE coloured, but a collapsed edge carrying
  several different names has no single honest colour. Resolution: the **line +
  arrowhead** take the hue only when EVERY name on the edge shares one slot (the
  dominant single-name argument-map case); a mixed edge keeps the neutral theme
  stroke. The **name chips** are ALWAYS tinted (keyed off the bare name, so a
  qualifier never shifts the hue), so a mixed edge stays legible chip-by-chip.
- **Theme-variable palette:** 8 slots → Obsidian's stable `--color-red …
  --color-pink`. The plugin owns zero colour VALUES, so light/dark just work.

**What was built / where it lives:**
- `src/view/relationColor.ts` (NEW) — pure, node-tested: `relationColorSlot(name)`
  (djb2 hash, case/whitespace-folded, mod `RELATION_COLOR_SLOT_COUNT`=8),
  `relationChipColorClassName(name)`, `relationEdgeColorClassName(names)` (single
  shared slot or `undefined`). Tests: `relationColor.test.ts`.
- `src/view/graph-view.css` — palette vars `--vicinity-rel-color-0..7` on
  `.vicinity-graph-flow`, plus per-slot chip rules
  (`.vicinity-graph-edge__relation--color-N`) and edge-line + arrowhead rules
  (`.vicinity-graph-edge--relation-color-N …`). Guarded by
  `src/view/relationColorPalette.test.ts` (a slot with no CSS FAILS).
- `src/view/flowMapping.ts` `edgeClassName` — appends the line-colour wrapper
  class when the edge's names share one hue. Tests added in `flowMapping.test.ts`.
- `src/view/edgeRelationLabels.ts` — the label planner's stack now carries
  `RelationLabelChip { text; name }` (was a bare display string) so the chip can
  colour off the bare NAME. `VicinityEdge.tsx` applies the chip class.
  `edgeRelationLabels.test.ts` updated to the chip shape.
- `e2e/namedRelationships.e2e.ts` — asserts a single-relation edge tints line +
  chip with the SAME slot. `npm run test:e2e -- namedRelationships.e2e.ts` green
  (7/7).

**Gates:** `npm run check` (0 errors), `npm test` (2415 pass), touched e2e spec
green. README + `docs-internal/plan/high-level-plan.md` updated.

**Deferred (not this ticket):** user-configurable name→style mapping; any
dash/weight styling.

