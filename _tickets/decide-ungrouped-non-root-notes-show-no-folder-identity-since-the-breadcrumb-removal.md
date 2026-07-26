---
id: nid_rdx8ea6w1km9eywyvhpx1v7rt_e
title: "[decide] ungrouped non-root notes show no folder identity since the breadcrumb removal"
status: open
deps: []
links: [nid_yccejkvl0ccqc77olsgg5deka_e]
created_iso: 2026-07-26T16:15:42Z
status_updated_iso: 2026-07-26T16:15:42Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [ux, graph-nodes]
---

`998fdac` ("snug capped node width + remove folder prefix", 2026-07-23) removed the grayed `folder/` breadcrumb end-to-end (render in `src/view/NoteNode.tsx`, `.vicinity-graph-node__breadcrumb` CSS, `FlowNodeData.breadcrumbFolder` threading in `src/view/flowMapping.ts` + `elkMapping.ts`, `breadcrumbFolderOf()` in `src/view/graphIdentity.ts` and its unit tests), and rewrote the sizing model in `docs-internal/plan/high-level-plan.md` so a node width hugs its title alone.

Consequence nobody has explicitly signed off on: a note in a folder that renders UNGROUPED — i.e. any folder contributing fewer than 2 nodes to the current vicinity — now shows **no folder context at all**. Folder identity survives only on 2+-member folder group boxes. In the dev vault `solo/gamma.md` is exactly this case: it renders as a bare title with no hint it lives in `solo/`.

This ticket exists because the removal was justified by NODE REAL ESTATE, not by a judgement that folder identity is worthless — so the gap deserves a conscious human yes/no rather than being inherited by accident.

## Design

Options, cheapest first:
1. Accept the gap as-is (status quo). Node real estate stays maximal; folder identity is a group-box-only concept. Zero work.
2. Non-layout affordance: put the folder path in the node `title=` tooltip / hover preview only. Costs no pixels.
3. Bring the breadcrumb back in a cheaper form (e.g. second line, only for ungrouped non-root nodes, elided at a max width) — this is what `998fdac` deliberately deleted, so it needs an explicit reversal of that decision, not a quiet re-add.
4. Fold into `docs-internal/tickets/ticket-folder-color-ux-design-pass.md` — that design pass assumed ungrouped nodes carry folder identity, and its premise is now stale (noted in that file).

## Acceptance Criteria

A human records the decision in this ticket. If the answer is "close the gap", a follow-up implementation ticket carries the chosen option; `docs-internal/plan/high-level-plan.md` §Sizing is the doc that must change, and the e2e guard `e2e/vicinityGraph.e2e.ts` "no node renders a folder-prefix breadcrumb" is the test that must be revisited (it is deliberately placed in the note1 section, where `solo/gamma.md` is in the vicinity, so it goes red if a prefix returns).

