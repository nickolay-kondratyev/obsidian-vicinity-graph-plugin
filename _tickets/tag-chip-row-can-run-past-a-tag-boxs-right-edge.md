---
id: nid_17gg2gpet15i1b160hxbiej5n_e
title: "Tag chip row can run past a tag box's right edge"
status: open
deps: []
links: []
created_iso: 2026-11-17T22:12:09Z
status_updated_iso: 2026-11-17T22:12:09Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [tags-followup,decide]
---

## Goal
On a narrow note near a tag box's RIGHT edge, the note's leftover-tag chip row (which hangs below the note and can be wider than the note) runs past the tag box's border. This was seen in tags V1 screenshots and pre-dates the chip-fitting fix (epic `nid_xhed75cwiy0ui4fokv6l02cxf_e`). It is cosmetic. The chips stay readable and nothing gets hidden or made unclickable.

## Done criteria
- A chip row never crosses its enclosing tag box's border at default spacing. Options:
  1. Fit the chip row to the note's width; overflow folds into `+N`.
  2. Give tag boxes extra right padding.
  3. Accept the overflow as is.
  Recommendation: (1), since it reuses the existing fitting rule in `src/view/tagChips.ts`.
- Unit test for the rule; tag e2e specs stay green.

## Context
- `src/view/tagChips.ts`, `src/view/NoteNode.tsx`, `src/view/groupBoxPadding.ts`, `src/view/graph-view.css`.

## Non-goals
- Multi-row chips; node sizing changes.
