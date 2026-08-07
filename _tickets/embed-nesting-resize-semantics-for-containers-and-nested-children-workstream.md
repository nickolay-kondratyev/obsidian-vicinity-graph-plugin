---
id: nid_1av3d7fx1072oyp5lxyhjd451_e
title: 'Embed nesting: resize semantics for containers and nested children (workstream)'
status: open
deps: [nid_qy5rc7sq261z23bp79bk8wsem_e]
links: [nid_e79vxubva52s9gq24idypb77x_e, nid_1ht2a3rm0ng8wnlis259u5egg_e]
created_iso: '2026-08-07T02:12:49Z'
status_updated_iso: '2026-08-07T03:08:44Z'
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

**Plan produced and APPROVED (owner decisions Q1–Q6 recorded below); implementation
BLOCKED on V1.** The V1 embed-nesting
feature (P1–P4: nid_r3qiyd7xx3bund6f73wf5h0vd_e, nid_1moqnutin09drbiyxkd3l7r5k_e,
nid_qy5rc7sq261z23bp79bk8wsem_e, nid_jbsbfqqxyy1brm26ul7873v5h_e) is all still **open** —
containers/nesting don't exist in `src/` yet, so there is nothing to attach resize
semantics to. Added `deps: [nid_qy5rc7sq261z23bp79bk8wsem_e]` (V1 rendering) accordingly.

**Deliverable of this pass:** design & phased plan —
`docs-internal/plan/embed-nesting-resize-semantics.md` (self-contained; all owner
decisions folded in there and summarized below).

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
- **Q3 (sequencing): stagger** — this workstream `deps: [P3]`; ordered sub-tickets Phase
  A (#1+#2) → B (#3) → C (children grow), each deps the last (same view modules).

**Round 2 — children may GROW past natural (owner, design doc §9):**
- **Q4 (own-content cap): GLOBAL px setting, every nesting level.** One new SETTINGS_SPEC
  leaf through the one settings pipeline — NOT a per-node field, so still schema-clean.
- **Q5 (appetite): content KIND, both axes.** Image/representative-image grows (W and H)
  up to the cap; title-only and fully-shown outline are saturated (max = natural). ("at
  least width-wise" dropped — width is not special.)
- **Q6 (distribution): EVEN across ALL unsaturated descendants** of the subtree (one flat
  pool, not per-level, not proportional, not priority-ordered). Greedy ordering later.

**Answers to this ticket's original OPEN QUESTIONS:** override meaning nested vs
standalone = the same outer box either way (drops V1's "ignore overrides while nested");
override vs auto-grow minimum = one outer box floored at ownMin; child-scaling on downsize
= derived, not persisted (Q2). Full detail in the design doc §3–§4, §9.

**NEXT (blocking on V1):** once P1–P4 ship, implement Phase A → B → C per the design doc
§6/§9. None add a per-node persisted field; Phase C adds one global settings dial (the
cap). Split into ordered A/B/C tickets when V1 is close. Do NOT close until implemented +
tested per the acceptance criteria.
