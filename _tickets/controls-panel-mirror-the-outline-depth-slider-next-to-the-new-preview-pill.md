---
closed_iso: 2026-07-30T02:28:50Z
id: nid_klkdpmx6axf90y4xj8khwrlf2_e
title: "Controls panel: mirror the Outline depth slider next to the new Preview pill"
status: closed
deps: [nid_armoson86j0ii8c33r1odo1rc_e]
links: [nid_1rslube8at5xj60ji4jeve0b0_e, nid_qp56jugz8en8wkgjirwcb269p_e, nid_armoson86j0ii8c33r1odo1rc_e, nid_que9qloigra7ku2boh83qizz0_e]
created_iso: 2026-07-25T03:52:21Z
status_updated_iso: 2026-07-30T02:28:50Z
type: feature
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [ui, settings, settings-cleanup]
---

Overarching context and chain ordering for the settings cleanup: docs-internal/notes/settings.md (grouping tag: settings-cleanup).
`node-content-preference` added a "Node contents" disclosure to the in-graph controls panel (`src/view/NodeContentsSection.tsx`) carrying ONLY the Preview pill. The settings tab's Node contents card has TWO fields: Preview and **Outline depth** (1-6). The panel still has no Outline-depth control at all, so the panel and the tab disagree about what "Node contents" contains.

That gap is deliberate and pre-existing (it was explicitly out of scope for the pill), but the new disclosure is now the obvious home for it.

## Acceptance Criteria

An Outline depth control in `NodeContentsSection.tsx` below the Preview row, writing the same global via a `planSettingsWrite` interaction (mirror how the tab writes `outlineMaxDepth`; do NOT add a per-doc override). Panel row idiom should match `ForceLayoutSlider`. Then update the disclosure docblock, which currently states the omission.


## Notes

**2026-07-30T02:28:50Z**

DONE by nid_armoson86j0ii8c33r1odo1rc_e. src/view/NodeContentsSection.tsx no longer
exists - Outline depth is a declared row in src/view/settingsRows.ts ("node-contents")
and the panel renders it as a SliderRow in src/view/SettingsRowView.tsx, below the
Preview pill. The docblock that stated the omission died with the component.
