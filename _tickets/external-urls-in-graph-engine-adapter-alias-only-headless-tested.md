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

## Decisions (owner-confirmed 2026-08-06)

- **D1 — node cap / truncation: COUNT toward the cap, LOWEST priority.** URL nodes
  eat screen space, so they count toward the node cap — but they sit BELOW every
  note node in the truncation priority chain (`src/engine/GraphTruncator.ts` /
  `NodePriorityChain.ts`): note nodes are kept first, URL nodes fill remaining cap
  budget, dropped first when over cap. (This means URL nodes DO participate in
  truncation, unlike the earlier "exempt" proposal.)
- **D2 — dedup + occurrence COUNT.** One node per normalized URL; first-seen alias
  wins (deterministic root+reference order). Each central→url edge carries an
  **occurrence count** = how many times that central references that URL (our own
  count from the parse below — external URLs have no `resolvedLinks` entry, so
  `getLinkCount` does not apply). This drives an `×N` edge badge in the VIEW ticket
  and the link fly-out preview. So the adapter/engine must RETAIN the per-source
  occurrence count, not just presence.
- **D4 — OPEN, needs owner sign-off before this ticket starts.** Owner wants
  `![x](http…)` EMBEDS included (the main use case), which changes the shape — see
  the D4 section below. Do not implement the collection rule until D4 is locked.

## D4 — external reference forms (deeper alignment, IN PROGRESS)

Owner input: embeds (`![x](http…)`) are the MAIN use case, so we include BOTH
links and embeds — not links-only. Two things this forces:

1. **We tag each URL ref with its `LinkKind` (`link` vs `embed`)** so the design can
   differentiate hyperlink vs embedded-resource. Feed this to the showcase ticket.
2. **The alias gate collides with embeds** (external image embeds are frequently
   `![](https://…/pic.png)` with EMPTY alt). Since we NEVER fetch or render the
   remote resource — only a node — we can always derive a label from the URL string
   alone: **alias/alt → URL last path segment ("filename") → host.** Gate options:
   - G1 strict: only refs with an explicit alias/alt (owner's original) — hides
     no-alt embeds, i.e. most image embeds.
   - G2 label-precedence: render every external ref, label falls back as above.
   - G3 hybrid (RECOMMENDED): plain links require an alias; embeds always shown
     (alias→filename→host), because embedding IS the intent to surface it.
   Never a network call in any option — labels come from the URL string only.

3. **Source of truth: PARSE the note body ourselves** via
   `src/shared/MarkdownInlineLinks.ts` (`EXTERNAL_DESTINATION`) rather than trusting
   Obsidian's `metadataCache` to index external links (version-dependent, unverified).
   Consistent with the repo's "we own parsing" precedent for canvas. Frontmatter
   external property links may still come from `cache.frontmatterLinks` — confirm as
   part of D4.

Once D4 is locked, fold the final rule into the collection pass + tests below.

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

