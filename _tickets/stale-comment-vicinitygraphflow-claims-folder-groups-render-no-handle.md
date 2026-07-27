---
id: nid_ub30ndqyp6ikq76hv4ba6yqss_e
title: "Stale comment: VicinityGraphFlow claims folder groups render no Handle"
status: open
deps: []
links: [nid_var2o7krxq7ribq3iofni3aw1_e]
created_iso: 2026-07-27T21:23:08Z
status_updated_iso: 2026-07-27T21:23:08Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [view, docs]
---

`src/view/VicinityGraphFlow.tsx:96-99` justifies `onlyRenderVisibleElements` with "group parents render no <Handle>, so React Flow's `forceInitialRender` (keyed on missing handleBounds) keeps them always mounted".

That is no longer true: `src/view/FolderGroupNode.tsx:26-31` and `:45-50` DO render hidden, non-connectable target/source `<Handle>`s (added so collapsed group edges can anchor to the box). If RF now measures handleBounds for group parents, `forceInitialRender` no longer applies and a scrolled-away group container could be culled out from under its children.

Spotted while implementing side-aware straight-edge anchoring (ticket nid_var2o7krxq7ribq3iofni3aw1_e); left untouched there because the culling rationale needs verifying, not just the comment rewriting.

## Acceptance Criteria

Either the comment is corrected to describe the REAL reason group parents stay mounted, or (if the rationale no longer holds) the culling behaviour is fixed and covered by a test/e2e check.

