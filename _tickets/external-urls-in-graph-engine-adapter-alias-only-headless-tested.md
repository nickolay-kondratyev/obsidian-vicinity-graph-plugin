---
id: nid_prsk9olcj9u2fpzqgv5gb6zhe_e
title: "External URLs in graph — engine + adapter (alias-only, headless, tested)"
status: open
deps: []
links: [nid_mw1az1i1aznfoxqsgcwnfus07_e, nid_hyzwoqadcfyvisveczuet3e8c_e, nid_ccsw8o1rjcs2l7o1elgmlqx5i_e, nid_uqgew1fuqgrdyvas6eum6vaf2_e]
created_iso: 2026-08-07T00:01:58Z
status_updated_iso: 2026-08-07T00:01:58Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: [engine, adapter, external-url]
---

# External URLs in the graph — engine + adapter layer (headless, tested)

Parent: `nid_mw1az1i1aznfoxqsgcwnfus07_e` (planning). This is the DATA half:
surface aliased external URLs from central/pinned notes and model them as engine
graph nodes + edges. **No rendering here** — the VIEW ticket
`nid_ccsw8o1rjcs2l7o1elgmlqx5i_e` consumes this. Fully unit-tested against
`FakeLinkProvider`, per the repo's pure-engine convention.

## Requirement (from parent)

See the vicinity of the active note (and pinned notes): show what those CENTRAL
notes **link out to on the web**, without fetching anything. Obsidian has NO API
to read a URL's title/favicon without a network call (`requestUrl` IS a flagged
network call), and network calls hurt plugin trust/adoption — so we render ONLY
external URLs that already carry an **alias** (the author's own display text).
Bare `https://…` links with no alias are NOT rendered.

Scope for THIS pass: external URLs from **central + pinned roots ONLY** (not from
ordinary traversed neighbours). A follow-up (`nid_uqgew1fuqgrdyvas6eum6vaf2_e`)
adds a Depth-controls pill to toggle URL rendering and possibly widen scope.

## Current state (why this is net-new plumbing)

External URLs are actively discarded at three layers today:
- `src/adapters/ObsidianLinkProvider.ts:250` — `getFirstLinkpathDest(link)` returns
  undefined for non-vault targets, so the reference is dropped before it reaches
  the engine.
- `src/shared/MarkdownInlineLinks.ts:84` — `EXTERNAL_DESTINATION` regex filters
  external destinations out of markdown inline-link parsing.
- `src/adapters/CanvasFallbackParser.ts:18-19` — canvas `link`-type nodes skipped.

Alias/display text exists in Obsidian's raw `LinkCache`/`EmbedCache`
(`link`/`original`/`displayText`) but the repo's `ReferencePort`
(`src/adapters/obsidianPorts.ts:35`) models only `link` + `position`, and
`OrderedReference` (`src/adapters/ReferenceOrder.ts:10`) keeps only
`link`/`offset`/`kind`. So `displayText` is never propagated past the parser.

Node identity is `VaultPath`-keyed EVERYWHERE (`src/engine/types.ts`, GraphNode /
GraphEdge / TraversedNode). External URLs have no `VaultPath`, so they need their
own id space and — recommended — their own collection, so URL-ness never has to be
threaded through note-only machinery (sizing, folder-grouping, truncation chain).

## Design (proposed — confirm the `decide` items below)

### Adapter
1. Extend `ReferencePort` (`src/adapters/obsidianPorts.ts`) with optional
   `original?: string` and `displayText?: string` (present on Obsidian's real
   `LinkCache`/`EmbedCache`; the `Fake*` port supplies them in fixtures).
2. New `LinkProvider` method (OCP — add, don't edit existing seams):
   `getOutgoingExternalUrls(path: VaultPath): readonly ExternalUrlRef[]` where
   `ExternalUrlRef = { url: string; alias: string }`. Returns, in reference order,
   deduped by normalized URL, ONLY entries whose destination is an external URL
   (reuse `MarkdownInlineLinks.EXTERNAL_DESTINATION`) AND whose `displayText` is
   present and is NOT equal to the raw URL (that is the "has an alias" gate).
   Implement in `ObsidianLinkProvider` by scanning `cache.links` (and
   `cache.frontmatterLinks`; see D4) for external destinations; add the field to
   `OrderedReference` so the display text survives.
3. `FakeLinkProvider` (`src/engine/FakeLinkProvider.ts`) + its `FakeFileSpec` gain
   a way to declare a file's aliased external URLs, for pure engine tests.

### Engine
4. New model: an `ExternalUrlNode` (id = `url:<normalizedUrl>`, plus `url`,
   `alias`) and an edge type source-central → url-node. Put them in SEPARATE
   collections on `VicinityGraph` (e.g. `externalUrlNodes`, `externalUrlEdges`)
   rather than mixing into `GraphNode`/`GraphEdge`, so note-only stages
   (`NodeSizer`, `GraphTruncator`, folder grouping) are untouched.
5. Collection is a POST-traversal pass over the CENTRAL roots only
   (`TraversalRoot`s / `TraversedNode.isCentral`), NOT part of the multi-hop BFS.
   For each central root, call `getOutgoingExternalUrls(root)`; for each result,
   ensure one url-node (deduped by normalized url) and add one edge root→url.
6. **Dedup + alias conflict**: one node per normalized URL even if multiple
   centrals link it (one edge per source). If two sources give different aliases
   for the same URL, FIRST-seen (deterministic root+reference order) alias wins.
   [D2 — confirm.]
7. **URL normalization**: define a small, dependency-free normalizer for identity
   (lowercase scheme+host, strip trailing slash on empty path, keep query/hash).
   Keep it minimal — identity only, not canonicalization.

## Decisions to confirm (tagged `decide`)

- **D1 — node cap / truncation.** URL nodes come only from centrals, so their
  count is bounded by central out-degree. PROPOSED: **exempt from the node cap**
  and from the truncation priority chain entirely (like central attachments),
  since they are already bounded and are the whole point of the feature. Alt: count
  them toward the cap with lowest priority. Confirm which.
- **D2 — dedup / alias-conflict:** one node per URL, first-seen alias wins (above).
- **D4 — which reference arrays count.** PROPOSED: body plain links (`cache.links`)
  AND frontmatter property links (`cache.frontmatterLinks`) that are external +
  aliased. Embedded external URLs (`![text](http…)`) are unusual and out of scope
  unless trivially free. Confirm.

## Testing (required)

Pure engine + adapter unit tests via `FakeLinkProvider` fixtures. One behavior per
BDD `WHEN…THEN…` test, e.g.:
- WHEN a central note links `[alias](https://x)` THEN one url-node + one edge appear.
- WHEN the link is bare `https://x` (no alias) THEN NO url-node.
- WHEN a NON-central neighbour links an aliased URL THEN NO url-node (scope gate).
- WHEN two centrals link the same URL THEN ONE node, TWO edges, first alias wins.
- WHEN a frontmatter external property link is aliased THEN it appears (per D4).
- `ObsidianLinkProvider` adapter test for the alias-gate + external-detection.

## Acceptance

- New engine collections populated correctly and fully unit-tested (`npm test`,
  `npm run check` green). No `obsidian`/`react` imports in engine
  (`src/engine/importGuard.test.ts` stays green).
- Nothing rendered yet; the VIEW ticket picks these up.

