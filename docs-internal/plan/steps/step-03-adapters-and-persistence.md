# Step 03: Obsidian Adapters + Persistence

**Covers:** Phases 2 and 3 of [[../high-level-plan]] (combined: both are the thin Obsidian boundary, and both consume `submodules/obsidian-id-lib`)
**Depends on:** [[step-02-core-engine]]

## Objective

Everything between the pure engine and Obsidian: real link providers, canvas capability detection, and docid-keyed persistence. After this step the plugin has all its data plumbing; only UI remains.

## Scope

### Link providers (Phase 2)

- **`ObsidianLinkProvider`**: outgoing via `metadataCache.resolvedLinks`, incoming via `getBacklinksForFile` per visited node (bounded by the cap, not vault size).
- **Canvas capability detection** at graph build time: does this install's `resolvedLinks` contain `.canvas` keys?
    - Yes → canvas edges flow through the same code path; our parser never runs.
    - No → **fallback canvas provider** parses `.canvas` JSON: file-type nodes only; text-node wikilinks skipped in V1.
- **Devtools verification task**: check what the user's actual install indexes (core vs. plugin-provided canvas backlinks). Record the finding in this doc's step-planning notes; the adaptive design is correct either way.
- Fixtures: canvas JSON files for the fallback parser AND provider variants with canvas entries deliberately absent, to exercise detection. The fallback path is a known stale-data risk — it gets the dedicated coverage.

### Doc identity (submodule integration)

Source of truth: `submodules/obsidian-id-lib/README.md`. Integration rules that step-level planning MUST honor:

- Wire via `DocIdServices.createDefault(app.vault)` (one-line adoption; the cross-plugin lock is included and REQUIRED).
- **`getDocId` (read-only, lock-free) on all bulk/read paths** — graph builds and sweeps must never trigger writes.
- **`ensureDocId` (lock-guarded) only on explicit write intent**: the user pins a node or changes a per-doc setting → the target doc needs an id now. Never ensure ids vault-wide.
- `ensureDocId` can return `null` (unsupported format, unreadable content, occupied-but-unusable id slot). A doc without an id **cannot be pinned or carry per-doc settings** — surface this gracefully, don't throw.
- **Filename safety**: doc-data files are named `<docid>.json`, and the README explicitly warns that existing ids of ANY foreign format are honored as-is. Validate docids for filename safety before using as filenames; define behavior for unsafe ids (e.g. hash-encode or refuse per-doc persistence with a notice).
- Canvas docs carry ids at `metadata.frontmatter.id` — handled by the lib; we never parse for ids ourselves.

### Persistence (Phase 3)

- All storage JSON; **every persisted shape carries a `version` field from day one**.
- `data.json` via `saveData`/`loadData`: global settings + the pinned set (pinned docids with pin timestamps for the recency tiebreaker).
- Per-doc settings: **one file per doc** at `.obsidian/plugins/<id>/doc-data/<docid>.json` via `vault.adapter.write` (sync-friendly; doc A's change never rewrites doc B).
- Per-doc shape: own depth settings + `centralDepths` map keyed by docid (depth of pinned centrals as adjusted while this doc was MAIN).
- **Pin-on-toggle** semantics enforced at this layer: any explicit view change writes the per-doc field even when it equals the global default; absence = inherit. Per-field, never per-document snapshots.
- Delete handling: `vault.on('delete')` + in-memory path→docid map for live cleanup.
- **Orphan sweep**: validates doc-data files, pinned docids, `centralDepths` entries; drops anything whose doc no longer resolves. Constraints: **delayed start ~15s after plugin load**, **chunked with yields** (batch, `await sleep(0)`, continue) — async alone does not protect the main thread.

## Out of scope

- Rebuild pipeline / event debouncing (step 04, where the view exists to rebuild).
- Any UI for settings (step 06); this step exposes typed load/save APIs only.

## Testing

- Providers: unit tests over mocked `resolvedLinks`/backlink shapes; fallback parser against canvas fixtures (incl. malformed JSON → no throw, matching the lib's philosophy).
- Persistence: round-trip tests, pin-on-toggle field-level semantics, versioned-shape parsing, unsafe-docid filename handling.
- Sweep: fixture with orphaned doc-data + stale pins + dangling `centralDepths`; assert exactly the orphans are dropped and chunking yields.
- Adapters stay thin — anything with branching logic gets extracted to a pure, tested function.

## Open items for step-level planning

1. Result of the devtools canvas-indexing verification on the target install.
2. Path→docid map lifecycle: built lazily as docs are visited vs. warmed by the sweep.
3. Rename handling: docids make renames a non-event for persistence, but the in-memory path map needs `vault.on('rename')`.
4. Whether `centralDepths` cleanup on unpin is immediate or left to the sweep (lean: leave to sweep — simpler, self-healing).

## Exit criteria

- Engine renders correct graphs from a real vault through `ObsidianLinkProvider` (verified via a debug command or console harness — UI comes in step 04).
- Persistence round-trips through a real dev vault; sweep observed running delayed + chunked.
- All new logic covered by vitest; adapter files remain thin.
