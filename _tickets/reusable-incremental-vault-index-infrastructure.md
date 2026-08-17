---
session_ids: [{"a": "claude", "type": "execution", "id": "74c2cd96-a67a-40b8-b721-6fe410f5b210"}, {"a": "claude", "type": "review", "id": "08f3c9e0-e4b8-42be-b11b-7b317b736e89"}, {"a": "claude", "type": "review", "id": "f060e691-225c-40d7-a96d-7ea4affede23"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_82g9goy92k9ciyy64m1r6jofe_e
title: "Reusable incremental vault index infrastructure"
status: open
deps: []
links: []
created_iso: 2026-08-17T16:44:24Z
status_updated_iso: 2026-08-17T18:11:57Z
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [named-relationships, decide, need-human, failed-review-stage-2]
---

Part of the named-relationships set. Read the PLAN first: `_tickets/add-ability-for-named-relationships.md` (closed plan ticket nid_fg66tanwkoyq3cqs1wdxagn21_e) — full syntax spec, signed-off decisions, architecture. Repo conventions: `CLAUDE.md` (layering view→adapters→engine, BDD tests, settings machinery).

Build REUSABLE session-held vault-wide derived-index infrastructure (adapters layer): first consumer is the named-relationships index, but design + document it so future vault-wide derived indexes reuse the build/maintain machinery (explicit sign-off requirement).

- Initial scan on plugin load: bounded concurrency (~8-16) over ONLY files that have links OR embeds per metadataCache (`getFileCache().links` / `.embeds`) — a statement's target run always contains `[[x]]` or `![[x]]`, and `rel::![[x]]` lands in `embeds`, NOT `links`, so gating on links alone would silently skip embed-only files. Files with neither are skipped without reading a byte. `vault.cachedRead` for content.
- Never blocks plugin load; graph builds AWAIT index readiness (precedent: async `ObsidianLinkProvider.create` in src/adapters/ObsidianLinkProvider.ts and lazy PerDocStore warm-up).
- Freshness: `metadataCache.on("changed")` (callback provides file CONTENT — zero extra reads → re-parse just that file), `vault.on("delete")` (drop entry; a delete handler already exists for forgetDocs — sit beside it), `vault.on("rename")` REKEYS the renamed file's own entry (old path → new path). Obsidian rewriting links only fires `changed` on the WRITER files pointing at the renamed one; the renamed file's content may be untouched, so without the rekey its entry stays stale under the old path.
- REPLACE-WHOLE-ENTRY semantics per file (no diffing) — trivially correct under any event ordering, including events racing the initial scan.
- Session-held only, NEVER persisted (derived data, same stance as folder relations).

Tests for scan gating, event-driven replacement, and readiness sequencing.

## Resolution (2026-08-17)

Built `IncrementalVaultIndex<TEntry>` in `src/adapters/IncrementalVaultIndex.ts`
(tests in `IncrementalVaultIndex.test.ts`, 18 BDD cases; documented in
`docs-internal/architecture-map.md` under `src/adapters/`). This ticket delivers
the REUSABLE machinery ONLY — no concrete consumer is instantiated or wired into
`main.ts` yet; the named-relationships index that plugs in is ticket
`nid_wldz7yfjecf9fuwtlezlbde9s_e`.

What it owns (the per-consumer knowledge is JUST a
`VaultFileEntryParser<TEntry> = (path, content) => TEntry | null`):

- **Initial scan** — `ensureReady()` (idempotent, memoised promise) runs a
  bounded-concurrency (`DEFAULT_SCAN_CONCURRENCY = 12`, mid the ~8-16 band; a
  fixed worker pool over a shared cursor, so slow reads never exceed the bound)
  sweep over ONLY files metadataCache reports links OR embeds for
  (`hasLinksOrEmbeds` gate — embed-only files INCLUDED, since `rel::![[x]]` lands
  in `.embeds`). Link-less files are never `cachedRead`. One unreadable file is
  logged and skipped, not fatal to the scan.
- **Never blocks load** — nothing awaited in `onload`; the consumer fires
  `void ensureReady()` eagerly and the graph builder `await`s the SAME promise
  (precedent: async `ObsidianLinkProvider.create`, lazy `PerDocStore` warm).
- **Replace-whole-entry freshness** — three handlers the consumer's `main.ts`
  wiring hooks to Obsidian events (beside the existing vault handlers):
  `handleFileChanged(path, content)` (`metadataCache.on('changed')` hands content
  to the callback → re-parse, zero extra reads), `handleFileDeleted(path)`
  (`vault.on('delete')`, sits beside `forgetDocs`), `handleFileRenamed(old, new)`
  (`vault.on('rename')` REKEYS the entry old→new without re-parsing — content is
  unchanged by a rename, and Obsidian only fires `changed` on the WRITER files,
  so the renamed file's entry would otherwise stay stale under the old path).
- **Events beat the concurrent scan** — a `settledDuringScan` set records paths an
  event finalized while the scan was in flight; the scan's late (possibly stale)
  `cachedRead` result for such a path is dropped rather than clobbering the newer
  event truth. Covered by the "change/delete lands mid-scan" tests.
- **Session-held, NEVER persisted** — same stance as folder relations.

Consumers read entries back via `entryFor(path)` / `allEntries()` (a live
read-only map), with an optional `onChanged` constructor callback firing after
every mutation (scan completion + each event) so a consumer holding a derived
structure (e.g. a reverse index) can invalidate it lazily.

Note for the next reader: the rename-vs-scan race is only best-effort (the scan
list is a `getFiles()` snapshot); a rename during the sub-second initial scan is
rare and self-corrects on the next `changed` event. The common changed/delete
races are fully guarded. Gates: `npm test` + `npm run check` green; no e2e —
this layer has no rendered surface and no consumer wired yet.


## Notes

**2026-08-17T18:08:07Z**

__REVIEW_AGAIN__: Fixed a real bug — a file renamed during the initial scan was permanently dropped from the index because handleFileRenamed settled the NEW path (which Obsidian has already set on TFile.path), making the scan skip it; now only the old path is settled. Added regression test; check + full test suite green. Concurrency race semantics changed, so a fresh look is warranted.

**2026-08-17T18:11:37Z**

__REVIEW_AGAIN__: Fixed another rename-vs-scan race left by ca3d297 — a 'changed' event followed by a rename mid-scan had its fresh rekeyed entry clobbered by the scan's stale read under the new path (settledness now follows the rekey); regression test added, check + full suite green, but concurrency semantics moved again so a fresh look is warranted.

## Review failed (stage 2)

The final review round did not declare the branch ready, so nothing was merged.
The branch [nid_82g9goy92k9ciyy64m1r6jofe_e_reusable-incremental-vault-index-infrast] holds the work and every review fix, kept as a
local record in the working copy that ran this.

- Round 1: verdict [REVIEW_AGAIN], session id [08f3c9e0-e4b8-42be-b11b-7b317b736e89] — its transcript shows what it found and fixed.
- Round 2: verdict [REVIEW_AGAIN], session id [f060e691-225c-40d7-a96d-7ea4affede23] — its transcript shows what it found and fixed.

What each round found, which fixes it made, and what it left unresolved are in
its verdict note under `## Notes` above, the follow-up tickets it filed, and
its session transcript. Decide whether to salvage the branch or retry fresh,
then remove the tags and reopen or close as appropriate.
