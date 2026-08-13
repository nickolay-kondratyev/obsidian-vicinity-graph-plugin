---
closed_iso: 2026-08-13T17:35:06Z
session_ids: [{"a": "claude", "type": "execution", "id": "0f5a4792-957f-49ef-b393-1328d7a2f599"}, {"a": "claude", "type": "review", "id": "04dba395-b474-4ea3-89c8-b2bd4cdf61a4"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_k4q36qb0nvmusoygl56trgtz2_e
title: "Hierarchy 1b: truncation tie-break by relation kind (embeds > links > hierarchy)"
status: closed
deps: [nid_dit8h888p2ml3092b2zn4zy3u_e]
links: [nid_ri1d36t7hmhu0kr652wny1dmz_e]
created_iso: 2026-08-13T16:11:45Z
status_updated_iso: 2026-08-13T17:35:06Z
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

## Resolution (2026-08-13)

Done. New tie-break level slotted into the deterministic priority chain AFTER
graph distance to MAIN, BEFORE pin recency, exactly as specified.

**What was built**

- `src/engine/types.ts` — new domain vocabulary next to `CHANNEL_RELATION`:
  - `DiscoveryKind = "embed" | "link" | "hierarchy"` (distinct from
    `ChannelRelation`, which is only the link-vs-hierarchy *styling* split; this
    splits the link side into embed vs plain link).
  - `CHANNEL_DISCOVERY_KIND: Record<Channel, DiscoveryKind>` — the mapping the
    ticket gave: `outgoing-embed → embed`, `outgoing-link` + `incoming → link`,
    `descendants` + `ancestors → hierarchy`. A `Record<Channel, …>`, so a future
    channel is a compile error until it declares its kind (OCP, matches the
    existing channel tables).
  - `DISCOVERY_KIND_RANK: Record<DiscoveryKind, number>` — `embed 0 < link 1 <
    hierarchy 2` (lower survives).
  - `DiscoveryKindFacts.bestRankOf(depthTags)` — the node's BEST (lowest) rank
    across all its depth tags (embed-found beats hierarchy-found for a node seen
    by both). Returns `undefined` for a tag-less node.
- `src/engine/NodePriorityChain.ts` — added optional `discoveryKindRank?: number`
  to `PriorityRankable` and one `presentFirst(..., ascending)` line between the
  distance-to-MAIN and pin-recency levels. Settings-cascade pins pass it
  `undefined`, so the level collapses for them (same pattern as the other
  present-first levels).
- `src/engine/GraphTruncator.ts` — `toRankable` now fills `discoveryKindRank`
  via `DiscoveryKindFacts.bestRankOf(node.depthTags)`.
- `docs-internal/plan/high-level-plan.md` — truncation-chain bullet updated here
  (NOT deferred to Hierarchy 5).

**Tests** (all green; full suite 1968 passed)

- `src/engine/GraphTruncator.test.ts` — new fixture-driven describe block:
  embed-found survives over link-found; link-found survives over hierarchy-only;
  a node found by BOTH hierarchy and link ranks as link. Uses a sibling folder
  note (`topic.md` owning folder `topic/`) so all three neighbors tie on
  minDepth 1 / distance 1 and are separable ONLY by discovery kind; hierarchy
  channel enabled via `{ descendantDepth: 1 }`.
- `src/engine/NodePriorityChain.test.ts` — new "level 3" unit tests (rank order +
  present-beats-absent); levels 4/5/6 renumbered; existing pin-recency / docid /
  path levels unchanged.

**Gate**: pure-engine change → `npm test` is the correct gate (no view/settings/
DOM surface touched); e2e not required per CLAUDE.md.
