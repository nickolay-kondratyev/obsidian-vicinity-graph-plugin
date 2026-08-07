---
closed_iso: 2026-08-07T02:13:30Z
id: nid_e79vxubva52s9gq24idypb77x_e
title: "Embed nesting: resolve design decisions Q1-Q9"
status: closed
deps: []
links: [nid_r3qiyd7xx3bund6f73wf5h0vd_e, nid_1moqnutin09drbiyxkd3l7r5k_e, nid_qy5rc7sq261z23bp79bk8wsem_e, nid_jbsbfqqxyy1brm26ul7873v5h_e, nid_14potmihi2tc0x421abf0awz6_e, nid_1ht2a3rm0ng8wnlis259u5egg_e, nid_1av3d7fx1072oyp5lxyhjd451_e]
created_iso: 2026-08-07T01:52:59Z
status_updated_iso: 2026-08-07T02:13:30Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [decide, embed-nesting]
---

DECISION GATE for the embed-nesting feature (parent plan ticket nid_14potmihi2tc0x421abf0awz6_e, closed).

Human must review and resolve the 9 questions in .ai_out/_current_decision/current_decision.md (Q1-Q9: central==isMain; container tie-breaks; embed-cycle handling; folder-group interplay; container-child edges; losing-embedder edges; nesting computed post-truncation; v1 sizing/resize scope; global toggle). Each question carries a recommended default; the implementation tickets are written AGAINST those defaults.

RESOLUTION: record the accepted/changed answers in this ticket body (the .ai_out file is volatile), then update the dependent implementation tickets if any recommendation was overridden, then close.

## Acceptance Criteria

All 9 questions have a recorded answer in this ticket body; dependent tickets updated if any default was overridden.

## RESOLUTION — answers recorded 2026-08-07 (human decision)

- **Q1 (central):** AGREE — "central" == `isMain` (the active note). ALSO: crisp vocabulary must be captured in a new `docs-internal/vocab.md`; a follow-up ticket (`nid_1ht2a3rm0ng8wnlis259u5egg_e`) owns searching the codebase for key vocabulary (`isMain`, `isCentral`, nesting terms, and whatever else stands out) so tickets speak one language going forward.
- **Q2 (tie-breaks):** AGREE — closer to the MAIN (active) node wins (smaller `minDepth`), then lexicographic vault path.
- **Q3 (cycles):** AGREE — cycles refuse nesting and render as a normal edge; MUST have an explicit test (P2 ticket covers it). **Made precise 2026-08-06 (owner confirmed):** cyclic embed pairs are SCC-EXCLUDED from nesting candidacy entirely — a mutual embed nests in NEITHER direction, both notes render standalone with the plain embed edge visible; a cycle member may still nest under an embedder outside its cycle. (Greedy one-direction nesting was rejected: Q5 would hide the refused edge, contradicting this decision's "render as a normal edge". Edge case anyway — healthy notes shouldn't embed circularly.)
- **Q4 (folder groups):** AGREE — nesting wins over folder grouping.
- **Q5 (edges inside the tree):** AGREE + STRONGER — V1 draws NO edges at all within a drawn nesting tree (not just ancestor/descendant: sibling/relative edges are dropped too). Future: MAY draw edges between DIRECT siblings — explicitly out of V1 scope.
- **Q6 (losing embedders):** AGREE — losing embedder gets a collapsed edge to the winner's outermost container; a pinned node embedded only by regular nodes renders standalone.
- **Q7 (post-truncation):** AGREE — nesting is pure presentation over the final rendered node set. Future (separate concern, NOT presentation): nested notes may get priority under the node cap.
- **Q8 (sizing/resize):** PARTIAL — container auto-grow accepted for V1 with resize disabled, BUT resize of both containers and children IS wanted as its own workstream (ticket `nid_1av3d7fx1072oyp5lxyhjd451_e`): container resize gives space primarily to the container's direct content (e.g. its representative image); resizing a child that pushes past the container edge auto-upsizes the container chain; scaling a container down scales its internal nodes down.
- **Q9 (toggle):** OVERRIDDEN — NO setting. Embed nesting is ALWAYS ON (no users yet; smaller testing surface). Add a toggle only if a real feature request arrives. P4 ticket rescoped to e2e + docs only.

