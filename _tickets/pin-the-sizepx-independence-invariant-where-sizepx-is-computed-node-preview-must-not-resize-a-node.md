---
id: nid_f8csd65emmy6p62ad9x5w1psz_e
title: "Pin the sizePx-independence invariant where sizePx is computed (node preview must not resize a node)"
status: open
deps: []
links: []
created_iso: 2026-07-25T03:51:51Z
status_updated_iso: 2026-07-25T03:51:51Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [settings, tests]
---

CLARIFICATION requirement 3 of the `node-content-preference` feature is binding: `sizePx` MUST NOT depend on `ViewSettings.nodePreviewPreference`, or every pill flip crosses `SIZE_RELAYOUT_THRESHOLD` and forces a full relayout instead of a data-only refresh.

Today NOTHING asserts it. `src/view/GraphStructureDiff.test.ts` (see the reworded comment at ~:47-56) only pins that nobody adds a `nodePreviewPreference` trigger to `decideLayout`; a `sizePx` <-> preview coupling introduced inside the sizer would slip straight past that fixture, because the fixture hands `decideLayout` its sizes.

The guard belongs where `sizePx` is produced: `src/engine/NodeSizer.ts` (and/or `src/view/flowMapping.ts`'s `nodeDimensionsPx`).

## Acceptance Criteria

A test in the NodeSizer suite that composes the same node under all three `nodePreviewPreference` values and asserts an identical `sizePx`. It must fail if someone feeds the preference into sizing. Do NOT put it in GraphStructureDiff.test.ts — that is the wrong altitude.

