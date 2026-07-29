---
id: nid_rdx8ea6w1km9eywyvhpx1v7rt_e
title: "ungrouped non-root notes show no folder identity since the breadcrumb removal"
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


## Notes

**2026-07-29T17:28:25Z**

DECISION (owner, 2026-07-29): TOOLTIP ONLY. Do not re-add a breadcrumb line.

Set the node title attribute to convey folder identity for ungrouped non-root notes.
src/view/NoteNode.tsx:92 currently does title={data.title}; FlowNodeData already carries path
(src/view/flowMapping.ts:41,309), so the data is already threaded and this is a ~1-line change.

WHY: costs ZERO layout, so it preserves commit 998fdac's sizing model, and it keeps the
.vicinity-graph-node__breadcrumb e2e guard green -- that guard asserts the ELEMENT count is 0, not
tooltip text, so only the re-add-breadcrumb option would turn e2e/vicinityGraph.e2e.ts:182 red.

ACCEPTED TRADEOFF (call this out, do not paper over it): identity becomes DISCOVERABLE but not
SCANNABLE -- you must hover. If scannability turns out to matter on a real vault, the proper fix is
the folder-color pass (docs-internal/tickets/ticket-folder-color-ux-design-pass.md), which conveys
folder identity at zero pixel cost, NOT a second text line.

Decide the exact tooltip text as part of the change; "<title> — <folder path>" is the obvious shape,
and root notes should keep the bare title (no trailing separator).
