---
id: nid_jcxzhexfaksge2arjzca3w7ff_e
title: "settings: add Title only node preview preference (global)"
status: open
deps: [nid_k2pa8khm6ugozmhkd6nlbdrq6_e]
links: [nid_o5hz7ilcauwe2acqdfh6pcuam_e, nid_cx5zoz7ptucg9nxalibv0mbjb_e, nid_9hx6okamx3yt0rg9iad2f4151_e]
created_iso: 2026-08-04T00:03:13Z
status_updated_iso: 2026-08-04T00:03:13Z
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [sizing, ui, settings]
---

From the node-sizing rethink decisions (decide ticket nid_o5hz7ilcauwe2acqdfh6pcuam_e, docs-internal/plan/node-sizing-rethink.md).

Add a fourth NodePreviewPreference value, e.g. "title-only" (TitleOnly): the node renders ONLY its title — no outline, no image. Available as a GLOBAL setting; the per-node override ticket (nid_9hx6okamx3yt0rg9iad2f4151_e) adds it to the per-node menu.

Touch points (compile errors + tripwires will walk you through the rest):
- src/engine: NodePreviewPreference union + NODE_PREVIEW_PREFERENCES order.
- src/view/nodePreviewPreferenceMeta.ts: label "Title only" + one-sentence description (Record over the union is compile-time exhaustive).
- src/view/nodePreviewChoice.ts: pure chooser returns a title-only kind; NoteNode renders nothing in the content slot for it.
- Preference-independence rule holds: sizePx must not depend on the resolved preview kind... BUT NOTE the sizing rework (nid_cx5zoz7ptucg9nxalibv0mbjb_e) moves default size to size-to-fit-content, which DOES depend on what is shown - coordinate with that ticket on how the rule is restated (likely: relayout on preference change becomes expected).
- Settings spec/defaults: default stays "auto"; settingsProductDefaults.test.ts untouched unless default changes.

Tests: chooser unit tests, jsdom component test for the pill option, and npm run test:e2e (settings + rendered node surface) per CLAUDE.md.

## Acceptance Criteria

Global preference offers Auto/Title only/Outline/Image; choosing Title only renders bare-title nodes; both settings surfaces show the new option; e2e passes.

