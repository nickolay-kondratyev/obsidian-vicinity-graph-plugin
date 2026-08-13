---
session_ids: [{"a": "claude", "type": "execution", "id": "f9ac855a-dcef-4b66-bd4e-81df22c23473"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_f5bfjoymr2pt7odxieunkxasd_e
title: "Hierarchy 4: view - hierarchy edge rendering + flyout folder-relation section"
status: in_progress
deps: [nid_dit8h888p2ml3092b2zn4zy3u_e, nid_bw8hltfj3nsyas03mpfmqn7mg_e]
links: [nid_ri1d36t7hmhu0kr652wny1dmz_e, nid_dit8h888p2ml3092b2zn4zy3u_e, nid_bw8hltfj3nsyas03mpfmqn7mg_e, nid_i3cznjkcnelqzvhp0gqlis499_e, nid_eymj85m7qccbpkoo4qj6b1q6t_e, nid_uxugk82jeu4cfj5ujyk4l79e7_e]
created_iso: 2026-08-13T15:35:42Z
status_updated_iso: 2026-08-13T17:04:13Z
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
