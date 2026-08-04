---
id: nid_9hx6okamx3yt0rg9iad2f4151_e
title: "view: hover gear with per-node content override (Inherit/Outline/Image)"
status: open
deps: [nid_lwionnvohw9k58jw7a2dybht2_e, nid_jcxzhexfaksge2arjzca3w7ff_e]
links: [nid_o5hz7ilcauwe2acqdfh6pcuam_e, nid_cx5zoz7ptucg9nxalibv0mbjb_e, nid_lwionnvohw9k58jw7a2dybht2_e, nid_qjsj5mth2phdqctbm0vfx9elw_e, nid_kyowb4v8v51nslbicl4szgcd5_e, nid_jcxzhexfaksge2arjzca3w7ff_e]
created_iso: 2026-08-03T23:48:48Z
status_updated_iso: 2026-08-03T23:48:48Z
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [sizing, ui]
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
