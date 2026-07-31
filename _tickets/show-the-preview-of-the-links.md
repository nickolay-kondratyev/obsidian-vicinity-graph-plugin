---
id: nid_tohotgq2s92dvd1iov1rd0umv_e
title: "Show the preview of the links"
status: in_progress
deps: [nid_1drobt9qaq3e89gt76fzghlik_e, nid_5q8dri0jtwnzwt34vfkcnw49x_e, nid_tpghu4nsbt08slhm2vannrnqw_e, nid_z2k1eebic1nilpz9z3r65cnrx_e, nid_q9xrbnj9kjtznese9xfsdgerp_e]
links: []
created_iso: 2026-07-31T18:30:48Z
status_updated_iso: 2026-07-31T18:49:33Z
type: task
priority: 3
assignee: nickolaykondratyev
---

Right now when we click on the links we get NO preview whatsoever. I would like a modal to be shown after we clicked on the links in the vicinity graph that shows where the links are used and a short context of those links COLLAPSED

The view is going to be a list of short context of each link, and we should be able to click on that context to expand the context around that link within the preview. When we click on the context we still remain in the same focus note. There should be an icon to GO to that particular link reference which in the case of a backlink can change the center note. 

Within this link preview we should have two buttons collapse all/expand all. They should have active state when they are able to be used. IF all elements are collapsed then we should be able to use expand all but not collapse all, if all the elements are expanded we should be able to use collapse all, but not expand all. If there is a mix then both are enabled. 

We should load in /Users/nkondrat/vintrin-env/config/claude/ai_input/deep/my-frontend-design.md when designing the UX/UI of the preview. 

IF rendering the context around the link is hard, then its ok to show raw markdown of the context.

Also when we show the links in the preview we should group the links and the backlinks.
The backlinks must be grouped from which note they are backlinking from as well.

## Clarified requirements (HUMAN, 2026-07-31)

- **Node click → node-preview modal** (plain click no longer opens the note; Ctrl/Cmd-click still opens the note in a new tab). Contents, in order:
  1. **Outline** — the headings of the clicked note (reuse existing `FileMetadata.outline`).
  2. **Links** — the note's outgoing link occurrences, each with short context.
  3. **Backlinks** — grouped by the source note they come from, each with short context.
- **Edge click → edge-preview modal** showing ONLY the link occurrences that fall under that clicked edge (source→target). This is an important part of the task, not optional polish.
- Context rows start COLLAPSED; clicking a row expands its context inline without changing the focus note. GO icon per row navigates to the occurrence (backlink GO recenters the graph). Collapse all / Expand all enablement exactly as described above.
- Raw markdown context is acceptable for v1; rendered markdown is a follow-up.

## Plan

Implementation is split into dependency-ordered sub-tickets (this ticket depends on all of them; each is self-contained):

1. `nid_1drobt9qaq3e89gt76fzghlik_e` — **Occurrence data layer**: new narrow port exposing per-occurrence link positions (outgoing from metadata cache, backlinks via extended `src/adapters/BacklinksAdapter.ts` position extraction, edge-scoped query) + pure context-snippet extraction (short = link's line, expanded = surrounding block) + `Fake*`.
2. `nid_5q8dri0jtwnzwt34vfkcnw49x_e` — **Pure view-model**: node/edge preview model builders (outline + links + backlink groups) and the collapse/expand state machine incl. Expand-all/Collapse-all enablement matrix. BDD-tested, no obsidian/react imports.
3. `nid_tpghu4nsbt08slhm2vannrnqw_e` — **Modal UI**: Obsidian `Modal` hosting a React root (precedent `src/view/ConfirmModal.ts`), sections + rows + buttons, line-based GO navigation added to `src/view/ObsidianNoteNavigator.ts`, theme-variable CSS, jsdom component tests. Design per `${MY_DEEP_MEM}/my-frontend-design.md`.
4. `nid_z2k1eebic1nilpz9z3r65cnrx_e` — **Gesture wiring**: `onNodeClick` behavior change + new `onEdgeClick` in `src/view/VicinityGraphFlow.tsx`, port seam through `GraphUiPort`, README/architecture-map updates, human smoke-run checklist ticket.
5. `nid_q9xrbnj9kjtznese9xfsdgerp_e` — **Follow-up**: rendered-markdown context via a ported `MarkdownRenderer` seam (raw text stays as fallback).

Key research facts the plan rests on: node click today opens the note (`src/view/VicinityGraphFlow.tsx` `onNodeClick` → `GraphViewController.openNode`); edges have no click handler; `src/engine/LinkProvider.ts` exposes only deduped paths — offsets exist in `src/adapters/ReferenceOrder.ts` / raw `getBacklinksForFile` but are not surfaced; no `MarkdownRenderer` usage exists anywhere in `src/` yet.