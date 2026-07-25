---
id: nid_klkdpmx6axf90y4xj8khwrlf2_e
title: "Controls panel: mirror the Outline depth slider next to the new Preview pill"
status: open
deps: []
links: []
created_iso: 2026-07-25T03:52:21Z
status_updated_iso: 2026-07-25T03:52:21Z
type: feature
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [ui]
---

`node-content-preference` added a "Node contents" disclosure to the in-graph controls panel (`src/view/NodeContentsSection.tsx`) carrying ONLY the Preview pill. The settings tab's Node contents card has TWO fields: Preview and **Outline depth** (1-6). The panel still has no Outline-depth control at all, so the panel and the tab disagree about what "Node contents" contains.

That gap is deliberate and pre-existing (it was explicitly out of scope for the pill), but the new disclosure is now the obvious home for it.

## Acceptance Criteria

An Outline depth control in `NodeContentsSection.tsx` below the Preview row, writing the same global via a `planSettingsWrite` interaction (mirror how the tab writes `outlineMaxDepth`; do NOT add a per-doc override). Panel row idiom should match `ForceLayoutSlider`. Then update the disclosure docblock, which currently states the omission.

