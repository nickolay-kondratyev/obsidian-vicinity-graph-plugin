---
id: nid_s773ums7z92dkgzcqmpksdnt4_e
title: "Node vertical real-estate: reduce/make height content-aware"
status: open
deps: []
links: []
created_iso: 2026-07-23T22:16:50Z
status_updated_iso: 2026-07-23T22:16:50Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [ui, node-sizing]
---

Follow-up from the node width real-estate work (branch node-real-estate-sizing).

Height was intentionally left OUT of scope in that iteration per human decision. Node height is currently driven purely by the engine importance metric score -> 40-160px (src/engine/NodeSizer.ts, src/engine/constants.ts DEFAULT_MIN/MAX_NODE_PX), so nodes with no thumbnail/attachments render mostly empty vertical space (the active/central node always maxes at 160px). CSS content (thumbnail/attachments) is gated by container queries at 72px/104px in src/view/graph-view.css.

WHEN nodes start rendering richer content (thumbnails, attachment strips, snippets) that can actually fill vertical space, revisit height: either make height content-aware (shrink to fit when empty) or lower the range, without losing the importance signal. Coordinate with the height design in docs-internal/plan/high-level-plan.md Sizing section.

Context dir: .ai_out/node-real-estate/node-real-estate-sizing/ (EXPLORATION_PUBLIC.md has the file:line map).

