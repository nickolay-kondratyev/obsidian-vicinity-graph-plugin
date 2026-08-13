---
closed_iso: 2026-08-13T17:16:21Z
session_ids: [{"a": "claude", "type": "execution", "id": "f9ac855a-dcef-4b66-bd4e-81df22c23473"}, {"a": "claude", "type": "review", "id": "254d26b6-1c02-49ce-b0b8-86135f46284a"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_f5bfjoymr2pt7odxieunkxasd_e
title: "Hierarchy 4: view - hierarchy edge rendering + flyout folder-relation section"
status: closed
deps: [nid_dit8h888p2ml3092b2zn4zy3u_e, nid_bw8hltfj3nsyas03mpfmqn7mg_e]
links: [nid_ri1d36t7hmhu0kr652wny1dmz_e, nid_dit8h888p2ml3092b2zn4zy3u_e, nid_bw8hltfj3nsyas03mpfmqn7mg_e, nid_i3cznjkcnelqzvhp0gqlis499_e, nid_eymj85m7qccbpkoo4qj6b1q6t_e, nid_uxugk82jeu4cfj5ujyk4l79e7_e]
created_iso: 2026-08-13T15:35:42Z
status_updated_iso: 2026-08-13T17:16:21Z
type: feature
priority: 3
assignee: nickolaykondratyev
tags: [ui, view]
---

Edge rendering + flyout for hierarchy relation. Full spec in body.


Design record: ticket `nid_ri1d36t7hmhu0kr652wny1dmz_e` (closed PLAN). Depends on
Hierarchy 1 (`nid_dit8h888p2ml3092b2zn4zy3u_e`) for the edge relation set and
Hierarchy 2 (`nid_bw8hltfj3nsyas03mpfmqn7mg_e`) to see real data.

## Scope (src/view/)

1. **Edge rendering** ("collapse, don't multiply" — CLAUDE.md principle):
   - PURE hierarchy edge: DASHED (CSS, theme variables), NO count badge,
     parent -> child arrowhead.
   - MERGED edge (link + folder relation, same ordered pair): ONE edge, solid +
     count badge, visually identical to a plain link edge (owner pick D1-a).
   - Opposite-direction pair (child links parent): unchanged two-arrow rendering.
   - Hierarchy relations never inflate the count badge.
2. **Flyout** (existing link-context flyout, `linkPreviewModel.ts` +
   `LinkPreviewDrawer` path via `GraphViewController.openEdgePreview`): when the
   clicked edge carries the folder relation, show a short folder-behavior section
   naming the folder note and the child (alongside link occurrences when merged).
   A PURE hierarchy edge must open the flyout too (there are no link occurrences —
   the explanation IS the content).

## Tests

- Pure model tests for the flyout content (linkPreviewModel) + component tests
  (jsdom `*.component.test.tsx`) for the section.
- Edge styling/badge behavior at whatever seam the edge props are built.
- Rendered proof is e2e — Hierarchy 5; but run the touched e2e specs here per
  CLAUDE.md (view-layer DOM/CSS changes gate on `npm run test:e2e`).

## Resolution (2026-08-13)

RESOLVED — implemented & green. `npm run check` clean; `npm test` 1963 passed;
`npm run test:e2e -- linkPreview.e2e.ts` 7/7 and `-- vicinityGraph.e2e.ts` 27/27
(pinned build). The dashed-hierarchy + folder-section RENDERED proof is Hierarchy
5's job; these existing specs prove the link-only path is unregressed.

### Edge rendering (styling seam = the `FlowEdge`)

- `src/view/flowMapping.ts`: `FlowEdge` and `EdgeNotePair` each gained a
  `hierarchy: boolean` (engine `GraphEdge.hierarchy`, threaded per-pair so a
  collapsed group edge can union hierarchy + link pairs). `buildFlowEdges` /
  `accumulateCollapsedEdge` propagate it (collapsed edge = OR of contributors).
- New exported `edgeClassName(edge)` composes the per-kind class with
  `PURE_HIERARCHY_EDGE_CLASS` (`vicinity-graph-edge--hierarchy`) **only when
  `hierarchy && count === 0`** (a PURE hierarchy edge). A MERGED edge keeps
  `count >= 1`, so it never gets the dash class → renders solid + badge,
  identical to a plain link edge (owner pick D1-a). `toReactFlowEdge`
  (`VicinityGraphFlow.tsx`) now calls `edgeClassName(edge)`.
- `src/view/graph-view.css`: `.vicinity-graph-edge--hierarchy .react-flow__edge-path
  { stroke-dasharray: 4 3; }` — dash only; stroke colour/width stay theme
  defaults. No count badge for pure hierarchy comes for free: `count === 0` →
  `linkCountBadgeText` returns null. Arrowhead is unchanged (engine emits parent →
  child, so the target-end head already points at the child).

### Flyout (folder-relation section)

- `src/view/linkPreviewModel.ts`: new `FolderRelationModel`
  `{folderNoteName, folderName, childName}` + `EdgePreviewModel.folderRelations`.
  `EdgePairOccurrences` gained `hierarchy`. The builder derives one relation per
  hierarchy-carrying pair, **purely from the pair's paths** (source = folder note,
  target's own folder = the owned folder), in the same sorted order as `pairs`.
  Names carry the extension (`Jon.md`, `child-of-jon.md`) + `Jon/` to read like
  the vault. No async / no `FolderNoteIndex` needed in the controller.
- `src/view/GraphViewController.ts` `openEdgePreview`: passes `hierarchy: pair.hierarchy`
  through. A PURE hierarchy edge still opens — `occurrencesBetween` returns `[]`,
  the "Link occurrences" section shows its designed empty state, and the new
  "Folder relation" section IS the content.
- `src/view/LinkPreviewContent.tsx`: a second `<Section>` (title exported as
  `FOLDER_RELATION_SECTION_TITLE`), rendered only when `folderRelations.length > 0`,
  wrapping a `FolderRelationList` of one sentence per relation:
  "`Jon.md` is the folder note of `Jon/`; `child-of-jon.md` is inside that folder."
  `src/view/link-preview.css` adds the prose list styling (reuses the section
  chrome).

### Deliberate decisions

- The "Link occurrences" section is ALWAYS rendered (its existing designed empty
  state), so a pure hierarchy edge shows "Link occurrences (0) / No link
  occurrences." above the folder section. Kept for consistency + zero
  special-casing; it also truthfully signals the edge is purely structural.
- Folder = `folderOf(childPath)`: a folder note's children live directly in its
  owned folder, so the child's own folder IS that folder for both sibling-style
  (`Jon.md` + `Jon/child.md`) and inside-style (`Jon/Jon.md` + `Jon/child.md`).

### Tests

- `src/view/flowMapping.test.ts`: hierarchy propagation (pass-through + collapsed
  union) + `edgeClassName` for pure/merged/link. Existing `notePairs`/whole-edge
  `toEqual`s updated for the new field.
- `src/view/linkPreviewModel.test.ts`: `folderRelations` derivation (pure, inside-
  style, merged appears in both, link-only contributes none). `edgeInputs` helper
  defaults `hierarchy` off.
- `src/view/LinkPreviewContent.component.test.tsx`: folder section appears only
  when a relation is present; sentence text asserted. Same helper default.
- `src/view/GraphViewController.test.ts`: a PURE hierarchy edge opens the preview
  with the folder relation and no rows.
