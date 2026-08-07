---
id: nid_1av3d7fx1072oyp5lxyhjd451_e
title: 'Embed nesting: resize semantics for containers and nested children (workstream)'
status: open
deps: [nid_qy5rc7sq261z23bp79bk8wsem_e]
links: [nid_e79vxubva52s9gq24idypb77x_e, nid_1ht2a3rm0ng8wnlis259u5egg_e]
created_iso: '2026-08-07T02:12:49Z'
status_updated_iso: '2026-08-07T02:29:02Z'
type: feature
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [embed-nesting, decide]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Follow-up workstream from embed-nesting decision Q8 (ticket nid_e79vxubva52s9gq24idypb77x_e). V1 (ticket nid_qy5rc7sq261z23bp79bk8wsem_e) ships containers that auto-grow to fit children, with drag-resize DISABLED on containers and nested children and size overrides ignored while nested. This ticket designs+implements real resize semantics. Owner flagged this will likely be its own workstream — start with a PLAN pass.

DESIRED BEHAVIOR (owner vision, 2026-08-07):
- Resizing a CONTAINER gives the extra space primarily to the container's DIRECT content (its own title/outline/representative image), not to the nested children. Example: n1 embeds n2, n2 embeds n3 and n4; n1 renders its image plus the nested [n2[n3 n4]] stack — scaling n1 up grows the image region.
- Resizing a CHILD that gets pushed past the container's edge auto-UPSIZES the container (and the container chain above it).
- Scaling a container DOWN so it pushes on internal nodes scales the internal nodes down too.

TOUCHPOINTS (as of planning): src/view/nodeResize.ts (NODE_RESIZE_BOUNDS, resizeEndToOverride), src/view/NoteNode.tsx (NodeResizeControl wiring), src/view/graphIdentity.ts nodeDimensionsPx (override wins verbatim — will need container-aware sizing), per-node overrides in data.json via NodeOverrideChange + PluginDataStore, layout fit checks in src/view/layoutFit.ts + GraphStructureDiff.

OPEN QUESTIONS for the plan: what does a persisted size override MEAN for a node that is sometimes nested and sometimes standalone; how override interacts with auto-grow minimums; whether child scaling on container-downsize is persisted or purely visual.

## Acceptance Criteria

Plan produced and approved; then containers and nested children are resizable per the owner vision with persisted-override semantics defined and tested.

## PLAN PASS — recorded 2026-08-07 (status: OPEN, not implemented)

**Plan produced; NOT yet approved; implementation BLOCKED on V1.** The V1 embed-nesting
feature (P1–P4: nid_r3qiyd7xx3bund6f73wf5h0vd_e, nid_1moqnutin09drbiyxkd3l7r5k_e,
nid_qy5rc7sq261z23bp79bk8wsem_e, nid_jbsbfqqxyy1brm26ul7873v5h_e) is all still **open** —
containers/nesting don't exist in `src/` yet, so there is nothing to attach resize
semantics to. Added `deps: [nid_qy5rc7sq261z23bp79bk8wsem_e]` (V1 rendering) accordingly.

**Deliverables of this pass:**
- Design & phased plan: `docs-internal/plan/embed-nesting-resize-semantics.md`.
- Human decisions surfaced: `.ai_out/_current_decision/current_decision.md` (Q1–Q3).

**Design in one line:** a persisted `sizePx` override ALWAYS sizes a node's OWN direct
content (image/title/outline), never the aggregate box including nested children. From
that single rule: owner behavior #1 (container grows its own image) and #2 (child resize
auto-upsizes the container chain) fall out of V1's existing elk auto-grow with minimal
new code; #3 (container downsize scales the nested stack down) is the only new mechanism
and is gated on the decision below.

**Answers to this ticket's OPEN QUESTIONS (from the plan):**
- *What a persisted override means when a node is sometimes nested / sometimes standalone:*
  the SAME thing — it sizes the node's own content region in both states; layout composes
  the children region around it. (Drops V1's "ignore overrides while nested.")
- *Override vs auto-grow minimums:* independent floors on independent regions — override
  sets the own region (clamped ≥ ownMin); auto-grow sets the children region (from child
  boxes); container total = sum.
- *Child-scaling on container-downsize persisted or visual:* recommended a container-scoped
  `childrenScale` (child own-sizes untouched), **persisted** so it survives repaints —
  but this is the human decision Q1/Q2 in the decision file.

**NEXT (blocking):** human answers Q1–Q3 → fold answers into the design doc → implement
Phase A (#1+#2) then Phase B (#3) once V1 ships. Do NOT close until implemented + tested
per the acceptance criteria.
