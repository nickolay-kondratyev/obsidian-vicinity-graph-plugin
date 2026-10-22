---
closed_iso: 2026-10-22T16:25:40Z
session_ids: [{"a": "claude", "type": "execution", "id": "ff4be5e0-028d-4bc7-a937-e48424f6df50"}, {"a": "claude", "type": "review", "id": "2ebbbf50-856e-4ea8-ae5a-f798e059d1ef"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_wu4gfieqps2uw9l8f4wab1abq_e
title: "Add concept of named link"
status: closed
deps: []
links: []
created_iso: 2026-10-22T16:08:49Z
status_updated_iso: 2026-10-22T16:25:40Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
---

Named link would be only with the following syntax:

```
<rel-name>::[[target-note]]
```

such as

```
uses::[[TCP]]
```

then we would show the label 'uses' in the vicinity graph.

IF there are multiple different rel labels for now KISS and choose the first one.

Just this format and space breaks it so 

```md - note1
greatly-improves::[[note2]] -> label would be note1-'greatly-improves'->note2

greatly improves::[[note2]] -> label would be note1-'improves'->note2
```


## Assumptions (agent, non-interactive run)

- **Rel-name characters**: the maximal run of Unicode letters, digits, `_`, `-` sitting
  IMMEDIATELY before `::[[`. Anything else (space, `(`, `*`, …) ends the name, so
  `greatly improves::[[n]]` → `improves`, `(uses::[[n]]` → `uses`, `**x**::[[n]]` → no label.
- **Only plain wikilinks in markdown bodies** carry a relation: not embeds (`uses::![[x]]`),
  not markdown links (`uses::[x](x.md)`), not frontmatter links, not canvas text. `[[t|alias]]`
  and `[[t#heading]]` still count (they are `[[target-note]]` links).
- **One label per directed pair**: the FIRST labelled link in document order wins; unlabelled
  links to the same target never suppress it.
- **Group-collapsed edge** (edge to/from a folder group): the label of the first contributing
  pair that has one (same "choose the first" KISS rule).
- **Rendering**: the label sits in the edge's midpoint pill, together with the existing `×N`
  count badge (one element, per the "collapse, don't multiply" principle). No setting toggle.
- **Where it is computed**: the `LinkProvider` seam is synchronous and has no file text, so the
  relation is attached AFTER the engine build, in the adapter, by reading only the visible
  edges' source files (`cachedRead`, bounded by the node cap).

## Resolution

Built as specified above (commit `6059a2c`, "Named links: …").

- **Text rule** — `src/shared/NamedLinks.ts` (`NamedLinks.relationAt(text, linkOffset)`): pure,
  regex `/([\p{L}\p{N}_-]+)::$/u` over the same-line prefix of a link that starts with `[[`.
  CRLF-safe. Tests: `NamedLinks.test.ts`.
- **Post-engine pass** — `src/adapters/EdgeRelationLabeler.ts`, called in
  `VicinityGraphBuilder.build()` right after `VicinityEngine.build`. Reads (`cachedRead`) only the
  markdown sources of kept link edges (`count >= 1`), walks `ReferenceOrder` body links
  (`kind === "link"`, offset >= 0 → embeds and frontmatter links excluded), resolves with
  `getFirstLinkpathDest`, first label per target wins. Sets `GraphEdge.relation` (optional field in
  `src/engine/types.ts`; the engine never sets it — the sync `LinkProvider` has no file text).
- **View** — `FlowEdge.relation` in `src/view/flowMapping.ts` (passthrough copies it; a
  group-collapsed edge takes the first defined contributor's label), threaded through
  `VicinityGraphFlow.tsx` into `VicinityEdgeData`. `VicinityEdge.tsx` renders ONE midpoint pill
  `.vicinity-graph-edge__midpoint-label` holding `.vicinity-graph-edge__relation` and/or the
  unchanged `.vicinity-graph-edge__count-badge` (`×N`). CSS in `graph-view.css` (relation
  ellipsized at `--vicinity-edge-relation-max-width: 16em`; no hover tooltip, because the pill is
  `pointer-events: none` so edge clicks pass through).
- **Docs** — README "Named links" section; architecture-map adapters bullet.
- **Tests run** — `npm run check` OK; `npm test` 2258 passed / 1 skipped; e2e
  `namedLink.e2e.ts` (new, real Obsidian 1.12.7) + `vicinityGraph.e2e.ts` → 29 passed.
  There's no jsdom component test for the pill: React Flow draws edges only after real
  node measurement, so the e2e covers it.
- **Known limits** — the `name::` text still shows verbatim in the note and in the link-preview
  drawer's context rows (not stripped). If a label is edited but nothing structural changes, the
  graph only updates after the next metadata-driven rebuild (same as count badges).
