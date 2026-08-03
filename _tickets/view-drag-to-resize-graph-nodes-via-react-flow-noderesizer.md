---
id: nid_qjsj5mth2phdqctbm0vfx9elw_e
title: "view: drag-to-resize graph nodes via React Flow NodeResizer"
status: open
deps: [nid_lwionnvohw9k58jw7a2dybht2_e]
links: [nid_o5hz7ilcauwe2acqdfh6pcuam_e, nid_cx5zoz7ptucg9nxalibv0mbjb_e, nid_lwionnvohw9k58jw7a2dybht2_e, nid_9hx6okamx3yt0rg9iad2f4151_e, nid_kyowb4v8v51nslbicl4szgcd5_e]
created_iso: 2026-08-03T23:48:48Z
status_updated_iso: 2026-08-03T23:48:48Z
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [sizing, ui]
---

Part of the node-sizing rethink (docs-internal/plan/node-sizing-rethink.md, origin nid_kyowb4v8v51nslbicl4szgcd5_e).

Let the user drag node edges to set a custom size (larger OR smaller than computed). Use the NodeResizer additional component already shipped in @xyflow/react 12 (no new dependency) inside src/view/NoteNode.tsx:
- Handles appear on hover/selection; during the drag only the node box changes (no graph rebuild).
- Commit on release (onResizeEnd): persist {widthPx, heightPx} as the docid-keyed override (see the persistence ticket), then ONE rebuild/relayout - reuse SIZE_RELAYOUT_THRESHOLD machinery in src/view/RebuildDecision.ts / GraphStructureDiff.ts.
- Provide a reset affordance (likely in the hover-gear menu ticket) to clear the override.
- Respect decided Q3 (whether override may exceed global maxPx / undercut minPx) with hard sanity bounds.

Tests: pure commit logic unit-tested; component test under jsdom via the existing @vitest-environment jsdom pattern; MUST run npm run test:e2e for the touched graph surface (view-layer DOM change) per CLAUDE.md.

## Acceptance Criteria

Node edges draggable; resize persists globally by docid and survives reopen + central switch; relayout happens once on release; e2e covering resize passes.

