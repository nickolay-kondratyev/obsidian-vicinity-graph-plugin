---
id: nid_rju51kn8sndg0v4dvxvwzdkap_e
title: "Embed nesting resize Phase A: container + child drag-resize (grow own content, auto-upsize chain)"
status: open
deps: [nid_qy5rc7sq261z23bp79bk8wsem_e]
links: [nid_1av3d7fx1072oyp5lxyhjd451_e, nid_wi1x92hhm65wemtcrqzbc33aw_e, nid_0bvt1rkun36xtcmo5df9btm92_e]
created_iso: 2026-08-07T03:18:37Z
status_updated_iso: 2026-08-07T03:18:37Z
type: feature
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [embed-nesting]
---

Phase A of the embed-nesting resize workstream (parent ticket nid_1av3d7fx1072oyp5lxyhjd451_e). Design source of truth: docs-internal/plan/embed-nesting-resize-semantics.md (§3 core model, §4.1, §6 Phase A). Blocked on V1 rendering (ticket nid_qy5rc7sq261z23bp79bk8wsem_e) — containers must render first.\n\nREQUIREMENTS (what must be true):\n- Re-enable drag-resize (NodeResizeControl in src/view/NoteNode.tsx) on CONTAINERS and NESTED CHILDREN. V1 disabled both.\n- A `sizePx` override on any node MEANS its OUTER rendered box: for a leaf that is its content; for a CONTAINER it is the whole box INCLUDING the nested stack. Same meaning nested or standalone — DROP V1\x27s "ignore overrides while nested".\n- #1: resizing a container UP puts the surplus into the container\x27s OWN direct content (image/title/outline), NOT the nested children.\n- #2: resizing a nested child grows the child and auto-upsizes the container chain. An UN-sized ancestor auto-grows (V1 elk auto-grow); an explicitly-sized ancestor has its outer box BUMPED outward just enough to keep the child at its own size.\n- Reset size clears the node\x27s `sizePx` (a container drops back to auto = own ⊕ children).\n- NO schema change: reuse NodeSizeOverridePx + NodeOverrideChange + the existing resize-commit plumbing (screen-ahead reseed, GuardedWriteOutcome).\n- ONE guarded write per gesture: a child-handle commit that bumps sized ancestors writes MULTIPLE docids (child sizePx + each bumped ancestor's sizePx), but it is ONE user gesture — run all of them inside ONE runGuarded task (each write still a per-field NodeOverrideChange merged over a fresh read), so failure reports ONCE and the rebuild fires ONCE. Never one runGuarded per ancestor.\n\nKEY APPROACH (not exhaustive — see design doc):\n- Split src/view/graphIdentity.ts `nodeDimensionsPx` → `nodeOwnContentDimensionsPx` (own box) + a pure `deriveContainerLayout(outerBox, ownNatural, childrenNatural)` → {ownBox, childrenScale}. Phase A only needs the grow / exact-fit case (childrenScale stays 1); the deficit case is Phase B.\n- Compose the compound container total in src/view/elkMapping.ts (total = outerBox); src/view/NoteNode.tsx styles the own-content region to ownBox.\n- Commit mappings in src/view/nodeResize.ts (container drag → persist outerBox; child-handle drag → persist child sizePx + bump sized ancestors). Relayout classification in src/view/GraphStructureDiff.ts + src/view/layoutFit.ts (fit must see the composed container total).\n\nTESTS: BDD unit for the geometry + commit mappings (pure modules); jsdom component test for the resize handles; npm run test:e2e for the view-layer DOM/CSS behavior (required per CLAUDE.md before calling done).

## Acceptance Criteria

Resizing a container grows its OWN content (image), not the nested stack; resizing a nested child grows the container up the chain; reset returns to auto size; no per-node schema change; npm run check + npm test + npm run test:e2e (view-layer) green.

