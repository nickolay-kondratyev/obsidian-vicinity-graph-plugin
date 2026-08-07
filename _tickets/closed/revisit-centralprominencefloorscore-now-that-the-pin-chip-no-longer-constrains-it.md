---
closed_iso: 2026-08-06T16:32:10Z
id: nid_s1474ljrdqneqhqt5zrkpwva2_e
title: "Revisit CENTRAL_PROMINENCE_FLOOR_SCORE now that the pin chip no longer constrains it"
status: closed
deps: []
links: []
created_iso: 2026-08-05T18:58:40Z
status_updated_iso: 2026-08-06T16:32:10Z
type: chore
priority: 3
assignee: nickolaykondratyev
tags: [ui, decide]
---

`CENTRAL_PROMINENCE_FLOOR_SCORE` in `src/engine/constants.ts` was raised from its originally tuned 0.35 to 0.44 by ticket `nid_tclb98q9hxhmcuonamvr4ig1f_e`, for ONE reason: at the shipped 40/160 dials 0.35 floored an EMPTY central at 82px, whose content box missed the hover pin chip's full-size rung in `src/view/graph-view.css`, so the most-pinned node wore the compact chip.

Ticket `nid_8i5936g90vrllosssaz7v3xbr_e` removed that rung: the chip is now FULL SIZE by default and the stylesheet only steps it down on a node that is small on BOTH axes (a central never is). So the reason for 0.44 is gone, but the value was KEPT rather than reverted — reverting would shrink every empty central from 93px to 82px, a visible sizing change nobody asked for in that ticket.

Decision needed from the owner: keep 0.44 as the shipped prominence (and let the constant's doc simply say so), or revert to the originally tuned 0.35. Also update `docs-internal/plan/high-level-plan.md` (the centrals bullet, ~line 81) with whichever is chosen.

