---
closed_iso: 2026-08-06T20:48:52Z
id: nid_9hx6okamx3yt0rg9iad2f4151_e
title: 'view: hover gear with per-node content override (Inherit/Outline/Image)'
status: closed
deps: [nid_lwionnvohw9k58jw7a2dybht2_e, nid_jcxzhexfaksge2arjzca3w7ff_e]
links: [nid_o5hz7ilcauwe2acqdfh6pcuam_e, nid_cx5zoz7ptucg9nxalibv0mbjb_e, nid_lwionnvohw9k58jw7a2dybht2_e,
  nid_qjsj5mth2phdqctbm0vfx9elw_e, nid_kyowb4v8v51nslbicl4szgcd5_e, nid_jcxzhexfaksge2arjzca3w7ff_e,
  nid_k2pa8khm6ugozmhkd6nlbdrq6_e, nid_1mq3t7706vw2kj2kv7ljqlw6l_e]
created_iso: '2026-08-03T23:48:48Z'
status_updated_iso: 2026-08-06T20:48:52Z
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [sizing, ui]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Part of the node-sizing rethink (docs-internal/plan/node-sizing-rethink.md, origin nid_kyowb4v8v51nslbicl4szgcd5_e).

Each graph node, on hover, shows a settings (gear) icon at its bottom-right. Clicking it opens a small per-node menu:
- Content: [Inherit | Outline | Image] - a per-docid GLOBAL override over the global nodePreviewPreference. Inherit = no stored entry (fall back to global).
- Also host "Reset size" here once a size override exists (see the resize ticket).

Implementation notes:
- Override layer slots IN FRONT of the pure chooser src/view/nodePreviewChoice.ts; NoteNode keeps rendering FlowNodeData.preview and deciding nothing.
- Reuse option copy from src/view/nodePreviewPreferenceMeta.ts (labels/descriptions exist; Inherit needs new copy there).
- Persist via the docid-keyed nodeOverrides store (persistence ticket) - lazy id assignment, same refusal notice as pinning.
- Preference flips stay DATA-ONLY refreshes: sizePx must not depend on the resolved preview kind (preference-independence rule in docs-internal/plan/high-level-plan.md Rendering section).
- Follow existing menu pattern in src/view/attachmentMenu.ts. Styling via Obsidian theme CSS vars.

Tests: pure override-resolution unit tests; jsdom component test for the gear/menu; MUST run npm run test:e2e (view-layer DOM change) per CLAUDE.md.

## Acceptance Criteria

Gear appears on hover; choosing Outline/Image overrides that node everywhere; Inherit removes the stored entry; flip does not trigger relayout; e2e passes.


## Notes

**2026-08-04T00:03:14Z**

DECIDED (2026-08-03): per-node Content override menu is [Inherit | Title only | Outline | Image] - "Title only" added per owner decision (see decide ticket note). Depends additionally on the global Title-only preference ticket for the enum value + copy. Q5 decided: silent frontmatter id assignment when saving an override, no confirmation.

**2026-08-06T20:48:52Z**

RESOLVED (2026-08-06). Hover gear with per-node Content override [Inherit | Title only | Outline | Image] shipped.

UX change from spec: the gear sits at the node's TOP-RIGHT (settings convention) and the pin moved to the TOP-LEFT (owner decision this session). The two hover chips share one CSS base class `.vicinity-graph-node-chip` (chrome + the compact-node clearance ladder), so the pin and gear step down together on small nodes; guarded by nodeDensityThresholds.test.ts (renamed pin->node-chip). "Title only" is included per the 2026-08-04 owner decision.

Design:
- New override-resolution layer src/view/nodePreviewChoice.ts sits IN FRONT of the pure chooser (resolveNodePreviewPreference(global, override) = override ?? global). NoteNode still renders FlowNodeData.preview and decides nothing. "Inherit" = absence of a stored `content` field (never a stored value); currentNodeContentChoice/planNodeContentMenu drive the menu.
- NodeContentOverride widened to Exclude<NodePreviewPreference,"auto"> = ["title-only","outline","image"]; Inherit copy added to nodePreviewPreferenceMeta.ts (override labels reuse the shared per-option copy).
- flowMapping resolves preview via the override and echoes contentOverride onto FlowNodeData for the menu's checked state.
- Writes: ControlsActions.setNodeContentOverride (lazy id + pin-style refusal notice, "store-unchanged" on refusal) / clearNodeContentOverride (read-only getDocId, never mints an id). Failure policy reuses SettingsWriteFailureNotice.forNonSettingsWrite("node-content-override", label "Node content").
- Preference-independence held: the sizer reads only the GLOBAL preference, so a content flip yields the same sizePx and decideLayout returns "reuse-layout" (data-only refresh, no relayout) — locked by GraphStructureDiff.test.ts + flowMapping.test.ts geometry-independence.

Tests (all green): pure nodePreviewChoice.test.ts; jsdom NoteNode.component.test.tsx (gear opens menu, checked state, set/clear routing, Reset size only with a size override); flowMapping/ControlsActions/GraphStructureDiff units. Full gate: npm run check + npm test (122 files / 1705 tests) + npm run test:e2e — new e2e/nodeContentOverride.e2e.ts (5) plus regression run of vicinityGraph/pinnedCentralScenario/nodeResize (45) all pass.

Acceptance criteria met: gear appears on hover; Outline/Image/Title-only override that node from ANY central (global by docid); Inherit removes the stored entry; flip triggers no relayout; e2e passes.
