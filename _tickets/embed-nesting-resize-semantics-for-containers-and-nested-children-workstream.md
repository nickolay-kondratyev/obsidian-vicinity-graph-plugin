---
id: nid_1av3d7fx1072oyp5lxyhjd451_e
title: 'Embed nesting: resize semantics for containers and nested children (workstream)'
status: open
deps: [nid_qy5rc7sq261z23bp79bk8wsem_e]
links: [nid_e79vxubva52s9gq24idypb77x_e, nid_1ht2a3rm0ng8wnlis259u5egg_e]
created_iso: '2026-08-07T02:12:49Z'
status_updated_iso: '2026-08-07T02:40:52Z'
type: feature
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [embed-nesting]
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

**Design in one line:** a `sizePx` override is a node's OUTER rendered box (for a leaf =
its content; for a container = the whole box incl. the nested stack). Inside a container
the split — own-content vs children region, and the children fit `scale` — is DERIVED
each rebuild from `(outerBox, children natural sizes)`, never stored. From that: #1
(container grows its own image) and #2 (child resize auto-upsizes the chain) fall out of
V1's elk auto-grow; #3 (container downsize scales the nested stack) is a derived
`childrenScale < 1`, with child own-sizes untouched.

**DECISIONS — RESOLVED 2026-08-07 (owner):**
- **Q1 (how to scale children down): (B) container-scoped fit factor** — scale the
  rendered children region; leave each child's own `sizePx` alone. Grabbing a child's OWN
  handle records on the child; a change caused by the container does not.
- **Q2 (persist the scale?): DERIVE, do NOT persist.** The container SIZE wins; the
  persisted fact is the container's outer box; `childrenScale = f(outerBox, childrenNatural)`
  is recomputed every rebuild. Never lost, and **no new `NodeOverride` field / no schema
  or `version` bump.** (Rejected: rewriting child overrides — POLS violation.)
- **Q3 (sequencing): stagger** — this workstream `deps: [P3]`; Phase A (#1+#2) then Phase
  B (#3) as ordered sub-tickets (B deps A) since both edit the same three view modules.

**Answers to this ticket's original OPEN QUESTIONS:** override meaning nested vs
standalone = the same outer box either way (drops V1's "ignore overrides while nested");
override vs auto-grow minimum = one outer box floored at ownMin, `childrenScale` absorbs
the rest; child-scaling on downsize = derived/visual, not persisted (Q2). Full detail:
`docs-internal/plan/embed-nesting-resize-semantics.md` §3–§4.

**NEXT (blocking on V1):** once P1–P4 ship, implement Phase A then Phase B (both
no-schema-change) per the design doc §6. Split into ordered Phase-A/Phase-B tickets when
V1 is close. Do NOT close until implemented + tested per the acceptance criteria.
