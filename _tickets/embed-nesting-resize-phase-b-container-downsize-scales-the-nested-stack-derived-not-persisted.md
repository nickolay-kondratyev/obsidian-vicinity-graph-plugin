---
id: nid_wi1x92hhm65wemtcrqzbc33aw_e
title: "Embed nesting resize Phase B: container downsize scales the nested stack (derived, not persisted)"
status: open
deps: [nid_rju51kn8sndg0v4dvxvwzdkap_e]
links: [nid_1av3d7fx1072oyp5lxyhjd451_e, nid_rju51kn8sndg0v4dvxvwzdkap_e, nid_0bvt1rkun36xtcmo5df9btm92_e]
created_iso: 2026-08-07T03:19:07Z
status_updated_iso: 2026-08-07T03:19:07Z
type: feature
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [embed-nesting]
---

Phase B of the embed-nesting resize workstream (parent nid_1av3d7fx1072oyp5lxyhjd451_e). Design: docs-internal/plan/embed-nesting-resize-semantics.md (§3, §4.1, §6 Phase B). Depends on Phase A.\n\nREQUIREMENTS:\n- #3: dragging a container BELOW (own-min ⊕ children-natural) scales the nested stack DOWN (childrenScale < 1) so it fits; the container\x27s own content is already at its floor.\n- The scale is DERIVED every rebuild from (container outer box, children natural sizes) — it is NOT stored. No new NodeOverride field, no schema/version bump. Child own-`sizePx` values are NEVER rewritten by a container drag.\n- "The container size wins": editing a child elsewhere (e.g. as the central node) and returning re-derives the fit against the container box. The derived scale must be stable across a repaint / refreshOpenViews fan-out.\n- Scale recovers toward 1 as the box grows back, and is CAPPED at 1 in Phase B (growing children PAST natural is Phase C).\n\nKEY APPROACH:\n- Extend the pure `deriveContainerLayout` (from Phase A, src/view/graphIdentity.ts) to yield childrenScale < 1 in the deficit case. src/view/elkMapping.ts lays out the children region at that scale; src/view/NoteNode.tsx renders it. No src/engine/types.ts or persistence change.\n\nTESTS: BDD unit — a small outer box yields childrenScale < 1; child sizePx unchanged; the SAME scale re-derives after a simulated rebuild (proving nothing needed persisting). npm run test:e2e — shrink a container past its stack and confirm nested nodes scale down and HOLD across a repaint.

## Acceptance Criteria

Dragging a container below its own-min + children natural size scales the nested stack DOWN to fit; each child\x27s stored sizePx is UNTOUCHED; the scale is DERIVED (re-computes to the same value after a rebuild — no persisted field); scale recovers toward 1 (never above) as the box grows back; gates green (check + test + test:e2e).

