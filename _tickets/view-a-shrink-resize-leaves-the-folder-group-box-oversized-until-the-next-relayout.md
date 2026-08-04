---
closed_iso: 2026-08-04T22:26:49Z
id: nid_brzatca9hp65cg6w3s4xz27k6_e
title: 'view: a shrink-resize leaves the folder-group box oversized until the next
  relayout'
status: closed
deps: []
links: [nid_9ep12hkmk4zjv2p28emmrhieq_e]
created_iso: '2026-08-04T19:15:41Z'
status_updated_iso: 2026-08-04T22:26:49Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [ui, sizing]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-4
---
Follow-up spotted while reviewing ticket nid_9ep12hkmk4zjv2p28emmrhieq_e (the fit rule in `src/view/layoutFit.ts`).

A committed resize now reuses the layout whenever the new box FITS. A SHRINK (drag smaller, or the context menu's "Reset size") always fits, so it always reuses — and the reuse path also keeps `GraphViewController.groupDimensions`, the elk-computed folder-group boxes. If the shrunken node is a GROUP MEMBER, its folder box therefore keeps the size it needed for the OLD, bigger box: a visibly oversized folder rectangle with dead space inside, persisting until the next structural relayout.

This is knowingly accepted in the ticket ("the hole it leaves behind is not worth re-arranging the whole graph for") and it is the right call for an UNGROUPED node — a gap between free-floating nodes reads as whitespace. A drawn group BORDER is different: the rectangle is a visible object whose size is now a lie about its contents.

HUMAN DECISION REQUIRED — the options are not obviously ranked:
1. Accept as-is (cheapest; the box self-corrects on the next structural change). 
   2. YES fow now lets accept it that we dont shrink grouping until next layout. - DOCUMENT as neccesary close to implementation/interface not claude.md

## Resolution (2026-08-04) — accepted + documented, no behavior change

Human picked option 1/2: the folder-group box stays as elk sized it until the next
structural relayout. Documented next to the implementation (NOT in `CLAUDE.md`):

- `src/view/layoutFit.ts` — an `ACCEPTED LIMITATION` paragraph in the module doc:
  what happens (a shrink always fits ⇒ always reuses ⇒ the group border keeps the
  old, roomier size), WHY it is accepted (a whole-graph re-arrange is worse than a
  temporarily roomy border, and it self-corrects), and WHY-NOT shrink the box in
  the view (its size is elk's answer to the subtree's packing, not a max over
  member boxes — recomputing it here would be a second, diverging layout opinion).
- `src/view/GraphViewController.ts` — a pointer on the `reuse-layout` branch, the
  code that actually keeps `groupDimensions`, back to that reasoning.
- `src/view/layoutFit.test.ts` — behavior-capturing test
  `WHEN a group member SHRINKS THEN it fits, leaving the group box oversized`,
  so the accepted behavior is pinned rather than folklore.

Verified: `npm run check` clean, `npm test` 1592 passed (116 files). No e2e run —
this change is documentation plus one node-level test; no rendered behavior moved.
