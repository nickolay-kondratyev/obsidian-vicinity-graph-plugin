---
closed_iso: 2026-07-29T17:15:03Z
id: nid_s773ums7z92dkgzcqmpksdnt4_e
title: "Node vertical real-estate: reduce/make height content-aware"
status: closed
deps: []
links: []
created_iso: 2026-07-23T22:16:50Z
status_updated_iso: 2026-07-29T17:15:03Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [ui, node-sizing]
---

Follow-up from the node width real-estate work (branch node-real-estate-sizing).

Height was intentionally left OUT of scope in that iteration per human decision. Node height is currently driven purely by the engine importance metric score -> 40-160px (src/engine/NodeSizer.ts, src/engine/constants.ts DEFAULT_MIN/MAX_NODE_PX), so nodes with no thumbnail/attachments render mostly empty vertical space (the active/central node always maxes at 160px). CSS content (thumbnail/attachments) is gated by container queries at 72px/104px in src/view/graph-view.css.

WHEN nodes start rendering richer content (thumbnails, attachment strips, snippets) that can actually fill vertical space, revisit height: either make height content-aware (shrink to fit when empty) or lower the range, without losing the importance signal. Coordinate with the height design in docs-internal/plan/high-level-plan.md Sizing section.

Context dir: .ai_out/node-real-estate/node-real-estate-sizing/ (EXPLORATION_PUBLIC.md has the file:line map).


## Notes

**2026-07-26T15:30:39Z**

[decide] Needs a human call: the ticket is conditional ('WHEN nodes render richer content') and names two competing designs — content-aware shrink-to-fit vs. simply lowering the height range in the sizing spec. The second weakens the size-as-importance signal. Verified still open: height is engine-driven via nodeDimensionsPx (src/view/flowMapping.ts:188), content gated by container queries in src/view/graph-view.css:232,237.

**2026-07-29T17:15:03Z**

DECISION (owner, 2026-07-29): DEFER/CLOSE for now.

The ticket's own precondition -- "WHEN nodes render richer content" -- is unmet. Height is
deliberately exactly sizePx (score-driven) while width is content-aware; that asymmetry is a
choice, not an oversight. minPx/maxPx are already user-editable, so compression is already
available to users without new code.

WHEN richer node content ships, reopen and mirror nodeDimensionsPx (src/view/graphIdentity.ts:45):
snug estimate floored at sizePx, capped -- keeping importance as a floor. Any such estimator MUST
stay in sync with the 72px/104px container-query gates in src/view/graph-view.css.
