---
id: nid_gk9h4jpa7di1al7och0rehd3h_e
title: "Relationships 1/4: names declared in notes (key:: [[x]]) + folder parent default shown on edges and in the drawer"
status: open
deps: []
links: []
created_iso: 2026-10-06T23:04:39Z
status_updated_iso: 2026-10-06T23:04:39Z
type: task
priority: 2
assignee: nickolaykondratyev
parent: nid_fc47gtxej6z7fqc53bflme8p5_e
tags: [relationships]
---

Part 1/4 of the named-relationships epic. Read the parent ticket first for the data model and the
DIRECTED rule.

## Goal
Show names the NOTES declare, plus the code default `parent` on folder-hierarchy edges, on the edge
and in the edge drawer. No storage, no AI. This lays down the label pipeline later tasks plug into.

## Sources
- Inline field (Dataview style) in the SOURCE note: `some-rel:: [[target]]`, also in list items and the
  bracketed forms `[some-rel:: [[target]]]` / `(some-rel:: [[target]])`. Several links after one key
  (`some-rel:: [[a]], [[b]]`) all take that key, up to the next `key::` on the line.
  The key is letters, digits, `-` and `_`, held in a named regex constant with a WHAT comment.
  It names the source→target edge ONLY (directed).
- Code default: a pure folder-hierarchy edge (`GraphEdge.hierarchy === true`, drawn parent → child,
  `src/engine/types.ts`) is named `parent` (named constant). Never stored.
  - It is HIDDEN when the two notes have a syntax name in EITHER direction (e.g. the child says
    `rel:: [[parent-note]]`). Manual/AI names on the hierarchy edge itself replace it (tasks 2-3).
- Frontmatter keys (`key: "[[x]]"`) do NOT name relationships (human decision: usually weak names like
  `related`). Their edges stay unnamed and are open to manual/AI naming.
- Canvas: no syntax names in V1.

## Approach
- Pure matcher (no obsidian imports): given a line's text and the column where a link starts,
  return the inline key or none. Use the link POSITIONS from Obsidian's link cache, not our own
  `[[...]]` parsing, so link resolution stays Obsidian's. Exhaustive BDD fixtures.
- Adapter (`src/adapters/`): for each visible SOURCE node, `cachedRead` + `getFileCache`, producing
  `directedLinkKey(source, target) → name`. Bounded by the visible node cap.
- Pure `resolveEdgeRelationship(edge, sources)` with precedence syntax > manual > ai > code default.
  Tasks 2 and 3 add their sources to it.
- `GraphViewController` resolves names AFTER each build into a label overlay external store keyed by
  `directedLinkKey`. `VicinityEdge.tsx` renders the name next to the count badge via
  `EdgeLabelRenderer`, the same way as the badge. Labels never trigger relayout.
- Collapsed folder-group edges (one edge standing for many pairs) get no label; the drawer lists the names.
- Edge drawer (`src/view/LinkPreviewDrawer.tsx`, model `src/view/linkPreviewModel.ts`): a header
  `A —name→ B` with its origin ("from note" / "folder hierarchy").
- CSS uses theme variables, in `src/view/*.css`.

## Acceptance
- Unit tests for the matcher, directedness (a `B → A` name never labels `A → B`), the `parent`
  default and precedence.
- Component test for the label in `VicinityEdge` (jsdom pattern: `src/view/*.component.test.tsx`).
- e2e (`npm run test:e2e -- <spec>`): a fixture note with `improves:: [[X]]` shows "improves" on that
  edge and in the drawer, a folder-note edge shows "parent",
  and a child with `rel:: [[folder-note]]` hides that `parent` label. The e2e lives in the `e2e/`
  submodule; commit there first.
- `docs-internal/architecture-map.md` and the README "Relationships" section updated.
