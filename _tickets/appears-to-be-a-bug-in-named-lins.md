---
closed_iso: 2026-08-18T00:28:26Z
id: nid_3s47jew297bthxajy1v288hiu_e
title: Appears to be a bug in named lins
status: closed
deps: []
links: []
created_iso: '2026-08-18T00:00:29Z'
status_updated_iso: 2026-08-18T00:28:26Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
There are appears to be a bug in how we reach named links 


--------------------------------------------------------------------------------
USE CASE:
note: A.md
```
supports::[[B]]
```

note: B.md
```
supports::[[C]]
```

C exists.

Went to A as the main note. Put links out at 2. 
EXPECTED: C is visible.
ACTUAL: C is not visible.
--------------------------------------------------------------------------------

ROOT CAUSE and FIX.

--------------------------------------------------------------------------------

# RESOLUTION (2026-08-18)

## Root cause

The named-relationships feature set (plan `nid_fg66tanwkoyq3cqs1wdxagn21_e`) had
shipped its ENGINE half — the `named-outgoing`/`named-incoming` traversal
channels, the rel-note folding choke point, and the settings dials (named links
out DEFAULTS to 2) — but the ADAPTER stage (ticket
`nid_wldz7yfjecf9fuwtlezlbde9s_e`) was still open. Production wired
`new VicinityEngine(provider)` with NO `RelationProvider`, and no adapter parsed
`::` statements out of raw markdown, so no `OutgoingReference` ever carried a
relation label. The named channels therefore found nothing: with the plain
"links out" dial at its shallower default, `A --supports--> B --supports--> C`
showed B but never C, even though the "named links out" dial read 2.

## Fix (commit "Wire named relationships into production")

Implemented the missing adapter stage:

- `src/adapters/NamedRelationshipsIndex.ts` — `RelationshipStatements.parse`
  over the reusable `IncrementalVaultIndex` (markdown + links/embeds scan gate);
  entries are raw statements (content-derived, rename-rekeyable), resolution to
  vault paths happens per query via `getFirstLinkpathDest`. Serves
  `namedReferences` (label-bearing references), `relNoteFolds` (the engine's
  `RelationProvider` port) and `statementsOf` (provenance for the flyout ticket).
- `src/adapters/ObsidianLinkProvider.ts` — merges the named references into the
  outgoing stream; `OutgoingReferences.deduped` folds each label onto the very
  reference the plain cache link produces (either-budget union). `create()`
  awaits index readiness (sync-query contract preserved).
- `src/adapters/VicinityGraphBuilder.ts` — passes the index as the engine's
  `RelationProvider` (activates the named channels + rel-note folding).
- `src/main.ts` — eager scan at load (never blocks onload), freshness on
  `metadataCache 'changed'` (content handed by the event, zero extra reads),
  vault delete/rename.

## Verification

- `src/adapters/NamedRelationshipsIndex.test.ts` includes THIS ticket's exact
  A/B/C repro through the real adapter stack: named depth 2 reaches C, and the
  A→B edge carries the `supports` label. 11 new tests.
- `npm test` 2338 passed; `npm run check` clean; `npm run test:e2e` 196 passed.

Adapter ticket `nid_wldz7yfjecf9fuwtlezlbde9s_e` is closed by this work; the
view-layer label rendering remains with `nid_wnagjm2j144u0jsgixpcmmpar_e`
(now unblocked).
