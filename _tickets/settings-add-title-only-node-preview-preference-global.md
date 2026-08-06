---
closed_iso: 2026-08-06T17:00:07Z
id: nid_jcxzhexfaksge2arjzca3w7ff_e
title: 'settings: add Title only node preview preference (global)'
status: closed
deps: [nid_k2pa8khm6ugozmhkd6nlbdrq6_e]
links: [nid_o5hz7ilcauwe2acqdfh6pcuam_e, nid_cx5zoz7ptucg9nxalibv0mbjb_e, nid_9hx6okamx3yt0rg9iad2f4151_e]
created_iso: '2026-08-04T00:03:13Z'
status_updated_iso: 2026-08-06T17:00:07Z
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [sizing, ui, settings]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2
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

## Notes

**2026-08-06T17:00:02Z**

RESOLVED.

Added the fourth NodePreviewPreference value "title-only" as a GLOBAL preference (order: Auto / Title only / Outline / Image). A title-only node renders only its title — no outline, no image.

Design decision: title-only maps to the EXISTING NodePreviewKind "none" (the renderer + content-fit sizer already handle "none"), rather than introducing a new kind. It is the ONE preference that deliberately empties the content slot regardless of what the note has — every other preference only ever withholds a region the note has an alternative of. So nodePreviewKind() early-returns "none" for it before the never-empty-a-node rule.

Changes:
- src/engine/types.ts: added "title-only" to NodePreviewPreference union + NODE_PREVIEW_PREFERENCES (single source; persistence validation + both UI surfaces derive from it). NodeContentOverride now excludes "auto" | "title-only" — title-only ships global-first; the per-node menu is its own ticket nid_9hx6okamx3yt0rg9iad2f4151_e (documented at the exclusion).
- src/engine/nodePreviewKind.ts: early return "none" for preference "title-only".
- src/view/nodePreviewPreferenceMeta.ts: label "Title only" + one-sentence description (exhaustive Record, so it cannot ship label-less; both pill surfaces read it).

Preference-independence rule: the old VicinityEngine test "sizing ignores the node preview preference" was a stale leftover — content-fit sizing (NodeSizer, docstring lines 45-49) already superseded that rule; auto/outline/image only coincidentally produced equal sizes. title-only correctly shrinks a content-bearing node (90 vs 122). Replaced it with "sizing follows the node preview preference" (Title only shrinks below an image preview). Relayout on preference change is now the EXPECTED behavior, coordinated with sizing-rework ticket nid_cx5zoz7ptucg9nxalibv0mbjb_e.

Tests (all green — npm run check, npm test 1678, and e2e):
- src/engine/nodePreviewKind.test.ts: Title only truth-table (every fact combo -> "none").
- src/view/NodePreviewRow.component.test.tsx: NEW jsdom component test — Title only renders as a radio and clicking it emits exactly one {kind:"global-node-preview", value:"title-only"}.
- e2e/nodeOutline.e2e.ts: NEW spec — Title only makes a content-bearing note render data-preview="none" with no outline element.
- e2e/settingsUxVisual.e2e.ts: preview pill option count 3 -> 4.

Docs: README.md preview pill updated three-way -> four-way, with the Title only bullet and the "except Title only" caveat on the never-empty-a-node statement.

Default unchanged (auto); settingsProductDefaults.test.ts untouched.
