---
closed_iso: 2026-08-04T04:27:01Z
id: nid_qjsj5mth2phdqctbm0vfx9elw_e
title: 'view: drag-to-resize graph nodes via React Flow NodeResizer'
status: closed
deps: [nid_lwionnvohw9k58jw7a2dybht2_e]
links: [nid_o5hz7ilcauwe2acqdfh6pcuam_e, nid_cx5zoz7ptucg9nxalibv0mbjb_e, nid_lwionnvohw9k58jw7a2dybht2_e,
  nid_sj9qg27cmear9lgdlz5umwra5_e, nid_y8axtvcum3wvljzv3d3p8cwd1_e, nid_9hx6okamx3yt0rg9iad2f4151_e,
  nid_kyowb4v8v51nslbicl4szgcd5_e, nid_gbyqsuplz8b7pv0u5k34sdz1q_e]
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

**2026-08-04T16:20:00Z**

REVIEW CORRECTION (adversarial review of 868a5b9..HEAD). Two statements in the resolution note above were WRONG about what shipped:

1. The grips were mounted INSIDE `.vicinity-graph-node`, which is `overflow: hidden` — so the "corner handle overhangs the node box" premise behind the CSS WHY-NOT was false: the overhang was CLIPPED. Probed live with `document.elementFromPoint`, a point in the grip's outer half returned `react-flow__pane`, not the grip. The 1px edge lines fared worse (a half-pixel sliver). FIXED: `NoteNode` now renders the three `NodeResizeControl`s as SIBLINGS of `.vicinity-graph-node` (children of the React Flow node wrapper, which clips nothing), and the CSS is rescoped to `.vicinity-graph-flow`. The opacity-only reveal and its bistability WHY-NOT stand — they were always correct, just not reachable.

2. "CDP hit-test misses the overhanging handle otherwise" was the clipping, not a Playwright quirk.

ALSO fixed: a press on a grip that never MOVED reached `onNodeClick` and focused/opened the note (d3-drag suppresses the click only once the pointer has moved) — `startedOnResizeGrip` now guards it. Regression tests: `e2e/nodeResize.e2e.ts` gained the hit-test probe and the zero-move press (both verified failing before the fix), `NoteNode.component.test.tsx` asserts no grip sits inside the clipping box, `nodeResize.test.ts` covers the predicate.

Filed nid_sj9qg27cmear9lgdlz5umwra5_e: a resize UNDER `SIZE_RELAYOUT_THRESHOLD` reuses the layout AND the cached group-box dimensions, so the grown node can overlap its neighbours — a product call, left unpatched here.

**2026-08-04T16:33:18Z**

REVIEW CORRECTION 2 (adversarial review of 868a5b9..HEAD, third round). The resolution note above lists 'three NodeResizeControls (right line, bottom line, bottom-right corner handle)' as shipped. Only the CORNER one was reachable.

React Flow's Line variant is a 1px-wide box centred on the node's edge (`.line.right { width: 1px }`), measured in FLOW units, and RF `autoScale`s only the HANDLE variant against zoom. A real pointer therefore hit-tests THROUGH the hairline to the node body — `grip.hover()` reports '.vicinity-graph-node intercepts pointer events' — so the right/bottom edge drag README documents could not be started at all. Compounding it, the grips are EARLIER siblings of `.vicinity-graph-node` (the round-2 fix), and two positioned siblings at `z-index: auto` paint in DOM order, so the node body also sat above every half of a grip that overlapped it.

FIXED in graph-view.css only: an 8px grab BAND straddling the edge with the accent line drawn by a pseudo-element (widening the box alone would push RF's border half a band off the edge), plus `z-index: 1` on every grip. Regression test: the right-line drag in e2e/nodeResize.e2e.ts (verified failing before the fix).

ALSO fixed: wiring `onNodesChange` for the resize handed React Flow its SELECTION bookkeeping too — a plain node click wrote `selected: true` into the controller-owned node state and painted the focus ring, sticking until the next publish (and a click on the CURRENT main publishes nothing). The callback now applies `dimensions` changes only. Regression test in the same spec, also verified failing first.

Filed nothing new; nid_sj9qg27cmear9lgdlz5umwra5_e gained the `decide` tag and the refit tradeoff its options list omitted.
