---
closed_iso: 2026-08-04T04:27:01Z
id: nid_qjsj5mth2phdqctbm0vfx9elw_e
title: 'view: drag-to-resize graph nodes via React Flow NodeResizer'
status: closed
deps: [nid_lwionnvohw9k58jw7a2dybht2_e]
links: [nid_o5hz7ilcauwe2acqdfh6pcuam_e, nid_cx5zoz7ptucg9nxalibv0mbjb_e, nid_lwionnvohw9k58jw7a2dybht2_e,
  nid_9hx6okamx3yt0rg9iad2f4151_e, nid_kyowb4v8v51nslbicl4szgcd5_e, nid_gbyqsuplz8b7pv0u5k34sdz1q_e]
created_iso: '2026-08-03T23:48:48Z'
status_updated_iso: 2026-08-04T04:27:01Z
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [sizing, ui]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
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


## Notes

**2026-08-04T00:33:05Z**

API NOTE (2026-08-04): the persistence seam this ticket consumes is FIELD-SCOPED. Commit the resize with `PersistenceServices.saveNodeOverrideField(file, { field: "sizePx", value: { widthPx, heightPx } })` and reset with `clearNodeOverrideField(file, "sizePx")` — do NOT compose a whole `NodeOverride` from `GraphNode.override` (the rendered snapshot): `PluginDataStore` merges the doc's other field from state read fresh inside the write, exactly like the settings pipeline. Wrapping the call in `runGuarded` (src/view/settingsWritePipeline.ts) is still this ticket's job.

**2026-08-04T04:27:00Z**

RESOLVED (2026-08-03). Implemented drag-to-resize end to end; all gates green (npm test 1561 passed, npm run check, e2e: nodeResize 4/4, vicinityGraph 25/25, pinnedCentralScenario 3/3).

What shipped:
- src/view/NoteNode.tsx: three NodeResizeControls (right line, bottom line, bottom-right corner handle) with NODE_RESIZE_BOUNDS (hard sanity bounds 24..1200 px, per Q3 overrides may exceed global min/max dials). onResizeEnd -> ControlsActionsPort.resizeNode(path, resizeEndToOverride(w,h)). No top/left controls: those move node origin, which controller-owned positions would snap back.
- src/view/nodeResize.ts (NEW, pure): bounds, rounding, reset-menu-entry plan.
- src/view/ControlsActions.ts: resizeNode/resetNodeSize via runGuarded('node-size-override') + field-scoped saveNodeOverrideField/clearNodeOverrideField; id-refusal notice for id-less notes.
- src/view/graphIdentity.ts: nodeDimensionsPx returns override verbatim; GraphStructureDiff.anyNodeGrewBeyond compares effective (override-aware) boxes, so ONE rebuild on release relayouts only past SIZE_RELAYOUT_THRESHOLD growth.
- src/view/VicinityGraphFlow.tsx: local nodes state + onNodesChange/applyNodeChanges — REQUIRED: controlled React Flow applies NO resize dimension changes without it.
- Context menu (viewPorts NodeMenuRequest.entries[]): 'Reset size' offered only when an override exists.
- CSS reveal is opacity-only and keyed on the RF wrapper's :hover. WHY-NOT pointer-events gating: bistable — corner handle overhangs the node box, hover loss there makes it permanently inert.

Tests: nodeResize.test.ts (pure), NoteNode.component.test.tsx (jsdom, real ReactFlow), ControlsActions.test.ts (+6), GraphStructureDiff/flowMapping suites extended, e2e/nodeResize.e2e.ts (real drag gesture; persist, remount, central switch, reset). e2e gotcha recorded there: start the drag with handle.hover(), not raw page.mouse.move to boundingBox centre — CDP hit-test misses the overhanging handle otherwise.

Commit: 'feat(view): drag-to-resize graph nodes via React Flow NodeResizeControl'.
