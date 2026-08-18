---
closed_iso: 2026-08-18T00:28:26Z
id: nid_wldz7yfjecf9fuwtlezlbde9s_e
title: "Named relationships: adapter index + LinkProvider merge"
status: closed
deps: [nid_0bhqajvtdq3joblfdzgqogw0x_e, nid_ufbtmywzbsyn2gwrx7bi0ww08_e, nid_82g9goy92k9ciyy64m1r6jofe_e]
links: []
created_iso: 2026-08-17T16:44:24Z
status_updated_iso: 2026-08-18T00:28:26Z
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [named-relationships]
---

Part of the named-relationships set. Read the PLAN first: `_tickets/add-ability-for-named-relationships.md` (closed plan ticket nid_fg66tanwkoyq3cqs1wdxagn21_e) — full syntax spec, signed-off decisions, architecture. Repo conventions: `CLAUDE.md` (layering view→adapters→engine, BDD tests, settings machinery).

Compose the pieces in the adapters layer: run the pure statement parser over the reusable vault index infrastructure to maintain the named-relationships index, implement the engine port defined in the engine ticket, and merge named relations into `ObsidianLinkProvider` (src/adapters/ObsidianLinkProvider.ts) streams — same precedent as frontmatter-id links (a distinct edge source merged in the adapter).

Covers: serving named links to plain + named channels (either-budget union), named embeds to embed + named channels, exposing statement positions/provenance for the flyout, and rel-note occurrence data for folding. Wire graph builds to await index readiness.

# RESOLUTION (2026-08-18)

Implemented while fixing bug ticket `nid_3s47jew297bthxajy1v288hiu_e` (named
links did not traverse — this unwired stage WAS the root cause):

- `src/adapters/NamedRelationshipsIndex.ts` — the composition: pure parser over
  `IncrementalVaultIndex` (markdown + `linksOrEmbedsScanGate`), query-time
  resolution against the live metadataCache. Implements the engine's
  `RelationProvider` (`relNoteFolds`, one entry per rel-note occurrence);
  `namedReferences` serves label-bearing references (kind `embed` for `![[x]]`
  targets, qualifiers carried, rel-note labels with `relNoteTarget`);
  `statementsOf` exposes raw statements (spans/qualifiers/occurrences) as the
  flyout's provenance surface for `nid_wnagjm2j144u0jsgixpcmmpar_e`.
- `ObsidianLinkProvider` merges the named references into its outgoing stream
  (`deduped` folds labels onto the plain reference — either-budget union) and
  `create()` awaits `ensureReady()`, so builds wait for the index exactly like
  they wait for canvas parses. `VicinityGraphBuilder` hands the SAME instance to
  `VicinityEngine` as its `RelationProvider`; `LiveLinkOccurrenceProvider`
  snapshots carry it too.
- `main.ts`: `startEagerly()` at onload (never blocks load), freshness via
  `metadataCache.on('changed')` (event-provided content, zero reads) +
  `vault.on('delete'/'rename')`.

Verified: `src/adapters/NamedRelationshipsIndex.test.ts` (11 tests incl. the
bug ticket's A/B/C repro through the real stack), `npm test` 2338 passed,
`npm run check` clean, `npm run test:e2e` 196 passed.

