---
closed_iso: 2026-08-10T18:47:17Z
id: nid_8f8ey41extajt08zphwwxhnwq_e
title: Move nodeOverrides + localPins onto VaultFileStore (per_file/<id>.json); data.json
  keeps global dials AND the global pinned set
status: closed
deps: [nid_cdoymzgq5kjh5d10q1tkavnsy_e]
links: [nid_vb246h5pr4609hid76ts1ufe5_e, nid_cdoymzgq5kjh5d10q1tkavnsy_e, nid_rnghlzs0uejjlbd5a4bjkq7eg_e]
created_iso: '2026-08-10T03:20:59Z'
status_updated_iso: 2026-08-10T18:47:17Z
type: feature
priority: 1
assignee: nickolaykondratyev
tags: [persistence, storage]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
# Goal

Move the plugin's per-doc / per-main persisted state (`nodeOverrides`, `localPins`, and the
forthcoming per-main local control overrides) off the single `data.json` blob and onto the
`VaultFileStore` primitive (dependency ticket), realising the storage model the planning
ticket `nid_vb246h5pr4609hid76ts1ufe5_e` decided. `data.json` stays the home for BOTH the
truly-global config dials AND the global pinned set (owner decision 2026-08-10 — let Obsidian
manage what is globally pinned; see below). There is NO `global.json`.

DEPENDS ON the VaultFileStore primitive ticket (versioned, conflict-resilient adapter-backed
file store). Do that first.

# Owner decisions this implements

- **Split of storage (owner, D2 + 2026-08-10 refinement):**
  - `data.json` (`.obsidian/plugins/vicinity-graph/`, Obsidian-managed) keeps:
    - the **truly-global config dials**: `globalDepths`, `globalView`, `nodeExclusion`;
    - the **global pinned SET** (`pins`) — UNCHANGED from today. The owner chose to keep this
      in `data.json` so Obsidian manages it and it stays a single cheap in-memory read (no
      `global.json`, no per-file scanning to learn what is pinned). Accepted consequence: like
      the config dials, the global pinned set does NOT travel when a user excludes `.obsidian`
      from sync. (A pin is treated as global CONFIG here, not as vault content — the opposite
      of `localPins`, which is per-main context and DOES move; see next bullet.)
  - `${VAULT_PATH}/.plugin_data/vicinity_graph/per_file/<docid>.json` holds, per docid, BOTH
    roles (owner D3 — one file per docid), as vault content that syncs everywhere:
    - **subject facts**: the doc's `sizePx` / `content` override (today's `nodeOverrides`
      entry).
    - **main-context facts**: the doc's `localPins` as a MAIN (target docid list), and — the
      forward-looking driver — its per-main **local control overrides** (ticket
      `nid_rnghlzs0uejjlbd5a4bjkq7eg_e`, which depends on this one; leave a clearly-named,
      empty-by-default slot for them so that ticket is purely additive).
  - So exactly TWO of today's three docid-keyed maps move out of `data.json`:
    `nodeOverrides` and `localPins`. `pins` stays.
- **Clean break (owner, D4):** pre-release, no migration. The two moved keys currently in
  `data.json` (`localPins`, `nodeOverrides`) are simply no longer read from there; old values
  fall back to defaults (a re-set, not lost work). `pins` is NOT moved, so existing global
  pins keep working with no reset. Say so in the release note / PR per the CLAUDE.md
  clean-break-while-unpublished convention. Remove the two now-dead keys from the `data.json`
  shape rather than leaving read shims.
- **Version envelope + malformed quarantine** come for free from the primitive (they apply to
  the `.plugin_data/` per-file files; `data.json` keeps its existing numeric `version`).

# Current state being changed (verified)

- `src/persistence/PluginDataStore.ts` — owns all of `data.json` in memory; wholesale rewrite
  per mutation via `SerialPromiseChain`. Mutators today: `saveGlobalDepths`, `saveGlobalView`,
  `saveNodeExclusion`, `addPin`/`removePins`, `addLocalPin`/`removeLocalPins`,
  `saveNodeOverrideField`/`clearNodeOverrideField`, `forgetDocs`, and the read-side twin
  `docIdKeyedDocids()`. After this ticket: `addPin`/`removePins` still write `data.json`; the
  localPins + nodeOverride mutators write per-file files instead.
- `src/persistence/persistedShapes.ts` — `PluginData` shape + defensive parser +
  `PERSISTED_SHAPE_VERSION`.
- `src/persistence/PersistenceServices.ts` — doc-scoped write-intent facade; ONLY caller of
  `ensureDocId`; `DocPersistEligibility` gates filename-safety.
- `src/persistence/DocIdMapWarmer.ts` — the one vault scanner; `warmFor(docids)` warms exactly
  the docids a build needs (read path), `warmAll()` for the sweep.
- `src/persistence/OrphanSweeper.ts` + `SweepPlanner.ts` — delayed (15s) chunked prune of
  stale docid-keyed entries via `PluginDataStore.forgetDocs`.
- `src/main.ts` — wires the object graph; `vault.on('delete')` → `forgetDocs([docid])`;
  `vault.on('rename')` is a non-event for storage (docid-keyed).
- Docids are filename-safe already (`^[A-Za-z0-9_-]{1,120}$`, `DocPersistEligibility`), so
  `per_file/<docid>.json` needs no escaping.

# Design

## Read path (init + per build)

- **init:** load `data.json` (truly-global dials + the global pinned set) via the existing
  `PluginDataPort`, exactly as today. Per-file records are NOT all loaded at init.
- **per build (lazy):** a build needs a docid's per-file record when that doc appears (as a
  node → its size/content override; as the active MAIN → its localPins + local overrides).
  `DocIdMapWarmer.warmFor(docids)` already computes exactly those docids — extend the warm
  step to also load each needed `per_file/<docid>.json` into an in-memory cache keyed by
  docid. Cache entries are invalidated on write and on delete. Net effect preserves today's
  guarantee: pins/overrides render on the FIRST build after restart, without reading every
  file in the vault. (Global pins are already in memory from `data.json`, so they render on
  the first build with no per-file read at all.)
- The engine and adapters see the SAME merged data they see today (global pins ∪ active
  main's local pins deduped, per the high-level plan) — this is purely a change of WHERE the
  localPins/override bytes come from, not of the traversal contract.

## Write path

- Route each field write to its home:
  - global pin add/remove → rewrite `data.json` (UNCHANGED from today).
  - node override set/clear (`sizePx`/`content`) → rewrite that docid's `per_file/<id>.json`
    subject section.
  - local pin add/remove for MAIN m → rewrite `per_file/<m>.json` context section.
- Preserve the "merge ONE field over the entry read FRESH" invariant (CLAUDE.md): a writer
  names ONE field (`NodeOverrideChange` / a pin / a local pin) and the store merges it over
  the freshly-read per-file record — never composes a whole record from a rendered snapshot.
- Per-file write serialisation is the primitive's job (per-key `SerialPromiseChain`);
  `data.json` writes keep their existing single chain in `PluginDataStore`.
  `PersistenceServices` stays the sole `ensureDocId` caller and keeps the
  `DocPersistEligibility` refusal semantics (a doc with no safe id can't get a file).
- Keep the ONE failure policy: writes are `void`-ed at call sites; a rejected write is caught
  and reported once through `UserNoticePort` (the settings write pipeline's policy is
  unchanged; the primitive's quarantine notice is a SEPARATE, read-side signal).

## Delete / orphan handling across files

Deleting doc D must, atomically-enough:
1. drop D from the `data.json` pinned set (UNCHANGED path);
2. remove `per_file/<D>.json` (its subject + its own localPins-as-main);
3. drop D as a TARGET from every OTHER main's `per_file/<main>.json` localPins.

Step 3 is the new cross-file cost (localPins used to be one in-memory map). Two mechanisms:
- **Reverse index (in memory):** as per-file records load, index `target docid → set of main
  docids that locally-pin it`. The live `vault.on('delete')` handler uses it to rewrite only
  the affected mains' files cheaply. The index is best-effort/among-loaded — correctness does
  not depend on it because:
- **Orphan sweep (authoritative):** `OrphanSweeper`/`warmAll()` already walks the whole vault.
  Extend it to also reconcile the `per_file/` directory listing (`VaultFileStore.listKeys`)
  against live docids: delete orphaned per-file files and scan loaded/needed mains' localPins
  for orphaned targets. Global-pin pruning stays the existing `data.json` path. Chunked,
  delayed — the right place for the exhaustive pass. `forgetDocs` remains the ONE conceptual
  choke point, now spanning: the `data.json` pinned set (as today), the per-file file, and
  localPins target positions.
- Update `docIdKeyedDocids()` (read-side twin) to report all positions a docid can occupy so
  the warm-up resolves them on first build (same role as today, new storage).

## Shapes

- `data.json` (`persistedShapes.ts`): drop `localPins` and `nodeOverrides`; KEEP
  `globalDepths`, `globalView`, `nodeExclusion`, `pins`, `version`. Bump
  `PERSISTED_SHAPE_VERSION` (a removed key ⇒ discard-to-defaults on old files; note that
  discarding also resets `pins` on the version bump — acceptable pre-release, call it out in
  the release note, or preserve `pins` across the bump if trivial since its shape is
  unchanged — implementer's call, but do not silently lose pins without noting it).
- `per_file/<docid>.json` payload (inside the primitive's `{ v1: ... }` envelope): a record
  with clearly-named, independently-optional sections, e.g.
  `{ override?: { sizePx?, content? }, localPins?: PinnedDocEntry[], localControls?: {...} }`
  — `localControls` reserved/empty for `nid_rnghlzs0uejjlbd5a4bjkq7eg_e`. Reuse the existing
  `PinnedDocEntry { docid, pinTimestamp }` for `localPins`. A record with every section empty
  is deleted, not written empty (mirror today's node-override rule).
- Keep the existing branded/validated parsing discipline: a per-file payload that parses as
  JSON but has the wrong internal shape degrades field-by-field to defaults (as
  `PersistedShapes.parsePluginData` does today) — this is SEPARATE from the primitive's
  whole-file quarantine (which only triggers when the file isn't valid JSON or has no known
  version key).

# Tests

Unit (`npm test`, Fake-driven, BDD):
- Round-trip each field through the new home (size/content override → per_file; local pin →
  per_file) and back into the merged view the adapter/engine consume. Global pins keep their
  existing `data.json` round-trip test.
- Clean break: an OLD `data.json` still carrying `nodeOverrides`/`localPins` loads with those
  ignored, while `globalDepths`/`globalView`/`nodeExclusion` are preserved (and `pins` per the
  chosen version-bump behaviour above).
- Delete D: it leaves the `data.json` pinned set (existing path), its per-file file is
  removed, and it is pruned as a target from another main's localPins (via reverse index AND,
  separately, via the sweep with a cold index).
- Orphan sweep reconciles a `per_file/<id>.json` whose doc no longer resolves.
- `docIdKeyedDocids()` reports subject, global-pin and local-pin-target positions.
- A merge-conflicted `per_file/<id>.json` (conflict markers) → that doc's overrides read as
  absent (defaults), the file is quarantined, other docs unaffected (inherited from the
  primitive; assert at the domain level too).

E2E (`npm run test:e2e`, real Obsidian — REQUIRED here because this is stored-state behaviour
across restart and touches rendered overrides/pins):
- Resize a node, set a content override, restart → both survive, now sourced from
  `.plugin_data/`. Global-pin a note, restart → survives (still `data.json`).
- Local-pin a target under a specific main, restart → survives and is scoped to that main.
- Delete an overridden / locally-pinned note → its `.plugin_data` file is gone and it is
  pruned as a local-pin target of another main.
- Drop a hand-crafted conflict-markered `per_file/<id>.json` into the vault before boot →
  plugin boots, that doc falls back to defaults, file is quarantined, no crash.
- Settle any settings-write windows via `e2e/settingsWriteWindow.ts` (never sleep).

Run `npm run test:all` before calling this done.

# Docs to update

- `CLAUDE.md` Persistence bullet + `docs-internal/architecture-map.md` `src/persistence/`
  section + `docs-internal/plan/high-level-plan.md` Persistence section: they currently state
  "`data.json` is the ONLY store." Replace with the two-tier model: `data.json` keeps
  truly-global config dials AND the global pinned set; the per-doc/per-main facts
  (`nodeOverrides`, `localPins`, future `localControls`) live as vault content under
  `.plugin_data/vicinity_graph/per_file/<docid>.json`, versioned + conflict-quarantined.
  Re-read line ~107 of the high-level plan (the parked "re-read sync-friendliness before any
  per-doc store" note) — this ticket discharges it; update it to point here, and note the
  explicit choice to keep `pins` in `data.json` (Obsidian-managed) rather than as vault
  content.
- Release note: the clean break (old data.json `nodeOverrides`/`localPins` reset once; pins
  behaviour per the version-bump decision).

# Guardrails

- Preserve `ap_XXX_E` anchors and behaviour-capturing tests; no silent removals.
- Keep the settings write pipeline's ONE failure policy intact; do not add a second notice
  path or call-site try/catch (the primitive's quarantine notice is the only new user
  message, and it is read-side).
- Then unblock `nid_rnghlzs0uejjlbd5a4bjkq7eg_e` (already deps this ticket).

## Notes

**2026-08-10T15:57:36Z**

Owner rationale for keeping `pins` in data.json (WHY, 2026-08-10): global pins are plugin
CONFIG. Users already expect that to make plugin settings travel they grab data.json along
with the vault, so a git sync that excludes .obsidian leaving global pins behind is the
familiar/acceptable behaviour. Per-note graph state (overrides, localPins) is vault content
and rides along with .plugin_data automatically. Do not re-open this split without owner sign-off.

**2026-08-10T18:47:00Z**

RESOLVED (2026-08-10). Two-tier storage implemented; all gates green (npm run test:all: check + 1823 unit + 163 e2e).

WHAT SHIPPED
- New src/persistence/perDocRecord.ts: PerDocRecord { override?, localPins?, localControls? } + defensive parser (reuses persistedShapes parsePins/parseNodeOverride) + isEmptyPerDocRecord.
- New src/persistence/PerDocStore.ts: in-memory-authoritative, warm-once mirror of .plugin_data/vicinity_graph/per_file/<docid>.json over VaultFileStore. Owns nodeOverrides + localPins; target->mains reverse index for cheap delete prune; keyedDocids() read twin; forgetDocs() per-file half; merge-ONE-field-over-fresh preserved. localControls reserved (empty) for nid_rnghlzs0uejjlbd5a4bjkq7eg_e (additive there).
- New src/persistence/RejectingVaultFsPort.ts: test double for the per-file write-failure policy (twin of RejectingPluginDataPort).
- persistedShapes.ts: dropped localPins/nodeOverrides from PluginData (KEEP globalDepths/globalView/pins/nodeExclusion); exported parsePins/parseNodeOverride for reuse.
- PluginDataStore.ts: pins-only forgetDocs; localPins/nodeOverride logic removed.
- PersistenceServices/VicinityGraphBuilder/OrphanSweeper/main.ts: wired PerDocStore; builder warms it and unions keyedDocids with pin docids; delete handler + sweep call BOTH forgetDocs.
- Tests: PerDocStore.test.ts, perDocRecord.test.ts (new); persistedShapes/PluginDataStore/PersistenceServices/OrphanSweeper/VicinityGraphBuilder/ControlsActions suites updated.
- E2E: controlsRestart now round-trips a size+content override through a real restart; localPinScenario + pinnedCentralScenario cover local/global pin restart (now via per-file store). New e2e/perFileStorePersistence.e2e.ts: (1) delete prunes a doc's own record AND its local-pin-target slot under another main via the LIVE vault.on('delete') handler; (2) a conflict-markered per_file/<id>.json is quarantined on boot (doc reads defaults, bad bytes renamed to _malformed_, no crash).
- Docs: CLAUDE.md Persistence bullet, architecture-map.md, high-level-plan.md (parked sync-friendliness note DISCHARGED), RELEASE_CHECKLIST.md clean-break note.

DEVIATION (transparent, sanctioned by this ticket's Shapes section "implementer's call"): NO PERSISTED_SHAPE_VERSION bump. The two dropped data.json keys simply stop being read (field-allowlisting), so old data falls back to defaults for the moved facts while global dials AND global pins carry over UNCHANGED. This is strictly better than a bump (a bump would reset pins too). Called out in the release note. If the owner wants an explicit bump for hygiene, that is a one-line change.

CLEAN BREAK: old data.json nodeOverrides/localPins are ignored (re-set once). pins NOT moved -> global pins keep working. Documented in RELEASE_CHECKLIST section 7.
