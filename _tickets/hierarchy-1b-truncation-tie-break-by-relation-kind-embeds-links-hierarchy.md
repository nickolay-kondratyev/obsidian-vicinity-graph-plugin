---
session_ids: [{"a": "claude", "type": "execution", "id": "0f5a4792-957f-49ef-b393-1328d7a2f599"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_k4q36qb0nvmusoygl56trgtz2_e
title: "Hierarchy 1b: truncation tie-break by relation kind (embeds > links > hierarchy)"
status: in_progress
deps: [nid_dit8h888p2ml3092b2zn4zy3u_e]
links: [nid_ri1d36t7hmhu0kr652wny1dmz_e]
created_iso: 2026-08-13T16:11:45Z
status_updated_iso: 2026-08-13T17:30:25Z
type: feature
priority: 3
assignee: nickolaykondratyev
tags: [engine]
---

Truncation ranking extension, split out of Hierarchy 1. Full spec in body.


Design record: ticket `nid_ri1d36t7hmhu0kr652wny1dmz_e` (closed PLAN). Split out of
Hierarchy 1 (`nid_dit8h888p2ml3092b2zn4zy3u_e`) to keep that ticket lean; depends on
it for the new channels and their depth tags.

## Scope (pure engine)

Extend the deterministic truncation priority chain (see "Truncation" in
`docs-internal/plan/high-level-plan.md`; current chain: lower minDepth -> graph
distance to MAIN -> pin recency -> docid) with ONE new level: discovering relation
kind, **Embeds > Links > hierarchy** (owner decision 2026-08-13). A node's rank on
this level is its BEST kind across all its depth tags (a node found by both the
embed channel and the descendants channel ranks as embed-found). Slot: AFTER graph
distance to MAIN, BEFORE pin recency.

Mapping channels -> kind rank: `outgoing-embed` = embeds; `outgoing-link` +
`incoming` = links; `descendants` + `ancestors` = hierarchy.

## Tests (BDD, fixture-driven in the truncator suite)

- WHEN two nodes tie on minDepth and distance THEN the embed-found node survives
  over the link-found one, and the link-found over the hierarchy-only one.
- WHEN a node is found by BOTH hierarchy and link channels THEN it ranks as link.
- Existing chain levels unchanged (pin recency / docid still break remaining ties).

Also update the truncation chain description in
`docs-internal/plan/high-level-plan.md` (or leave it to Hierarchy 5's docs pass —
say which in the close note).
