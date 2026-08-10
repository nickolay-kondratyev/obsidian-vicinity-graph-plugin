---
id: nid_8f8ey41extajt08zphwwxhnwq_e
title: "Move pins/nodeOverrides/localPins onto VaultFileStore (per_file/<id>.json + global.json); data.json keeps truly-global dials"
status: open
deps: [nid_cdoymzgq5kjh5d10q1tkavnsy_e]
links: [nid_vb246h5pr4609hid76ts1ufe5_e, nid_cdoymzgq5kjh5d10q1tkavnsy_e, nid_rnghlzs0uejjlbd5a4bjkq7eg_e]
created_iso: 2026-08-10T03:20:59Z
status_updated_iso: 2026-08-10T03:20:59Z
type: feature
priority: 1
assignee: nickolaykondratyev
tags: [persistence, storage]
---

# Goal

Move the plugin's per-doc / per-main persisted state off the single `data.json` blob and
onto the `VaultFileStore` primitive (dependency ticket), realising the storage model the
planning ticket `nid_vb246h5pr4609hid76ts1ufe5_e` decided. After this ticket, pins, node
overrides and local pins live as vault-content JSON that syncs everywhere; only TRULY-global
config dials remain in `data.json`.

DEPENDS ON the VaultFileStore primitive ticket (versioned, conflict-resilient adapter-backed
file store). Do that first.

# Owner decisions this implements

- **Split of storage (owner, D2 + note):**
  - `data.json` (`.obsidian/plugins/vicinity-graph/`, Obsidian-managed) keeps **only
    truly-global config dials**: `globalDepths`, `globalView`, `nodeExclusion`. Accepted
    consequence: these are config, not vault content, so they do NOT travel when a user
    excludes `.obsidian` from sync.
  - `${VAULT_PATH}/.plugin_data/vicinity_graph/global.json` holds the **global pinned SET**
    (the "pinned index" from option B) — a doc-fact, hence vault content that syncs
    everywhere and stays readable in ONE cheap read (no scanning per-file files to learn
    which docs are pinned).
  - `${VAULT_PATH}/.plugin_data/vicinity_graph/per_file/<docid>.json` holds, per docid, BOTH
    roles (owner D3 — one file per docid):
    - **subject facts**: the doc's `sizePx` / `content` override (today's `nodeOverrides`
      entry).
    - **main-context facts**: the doc's `localPins` as a MAIN (target docid list), and — the
      forward-looking driver — its per-main **local control overrides** (ticket
      `nid_rnghlzs0uejjlbd5a4bjkq7eg_e`, which depends on this one; leave a clearly-named,
      empty-by-default slot for them so that ticket is purely additive).
- **Clean break (owner, D4):** pre-release, no migration. The docid-keyed keys currently in
  `data.json` (`pins`, `localPins`, `nodeOverrides`) are simply no longer read from there;
  old values fall back to defaults (a re-set, not lost work). Say so in the release note /
  PR per the CLAUDE.md clean-break-while-unpublished convention. Truly-global dials stay put,
  so those settings are NOT lost. Remove the now-dead keys from the `data.json` shape rather
  than leaving read shims.
- **Version envelope + malformed quarantine** come for free from the primitive.

# Current state being changed (verified)

- `src/persistence/PluginDataStore.ts` — owns all of `data.json` in memory; wholesale rewrite
  per mutation via `SerialPromiseChain`. Mutators today: `saveGlobalDepths`, `saveGlobalView`,
  `saveNodeExclusion`, `addPin`/`removePins`, `addLocalPin`/`removeLocalPins`,
  `saveNodeOverrideField`/`clearNodeOverrideField`, `forgetDocs`, and the read-side twin
  `docIdKeyedDocids()`.
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

- **init:** load `data.json` (truly-global dials) via existing `PluginDataPort`; load
  `global.json` (pinned set) via `VaultFileStore` in ONE read. Both feed the in-memory
  `PluginDataStore`. Per-file records are NOT all loaded at init.
- **per build (lazy):** a build needs a docid's per-file record when that doc appears (as a
  node → its size/content override; as the active MAIN → its localPins + local overrides).
  `DocIdMapWarmer.warmFor(docids)` already computes exactly those docids — extend the warm
  step to also load each needed `per_file/<docid>.json` into an in-memory cache keyed by
  docid. Cache entries are invalidated on write and on delete. Net effect preserves today's
  guarantee: pins/overrides render on the FIRST build after restart, without reading every
  file in the vault.
- The engine and adapters see the SAME merged data they see today (global pins ∪ active
  main's local pins deduped, per the high-level plan) — this is purely a change of WHERE the
  bytes come from, not of the traversal contract.

## Write path

- Route each field write to its file:
  - global pin add/remove → rewrite `global.json` (whole pinned set; it is small).
  - node override set/clear (`sizePx`/`content`) → rewrite that docid's `per_file/<id>.json`
    subject section.
  - local pin add/remove for MAIN m → rewrite `per_file/<m>.json` context section.
- Preserve the "merge ONE field over the entry read FRESH" invariant (CLAUDE.md): a writer
  names ONE field (`NodeOverrideChange` / a pin / a local pin) and the store merges it over
  the freshly-read per-file record — never composes a whole record from a rendered snapshot.
- Per-file write serialisation is the primitive's job (per-key `SerialPromiseChain`).
  `PersistenceServices` stays the sole `ensureDocId` caller and keeps the
  `DocPersistEligibility` refusal semantics (a doc with no safe id can't get a file).
- Keep the ONE failure policy: writes are `void`-ed at call sites; a rejected write is caught
  and reported once through `UserNoticePort` (the settings write pipeline's policy is
  unchanged; the primitive's quarantine notice is a SEPARATE, read-side signal).

## Delete / orphan handling across files

Deleting doc D must, atomically-enough:
1. remove `per_file/<D>.json` (its subject + its own localPins-as-main);
2. drop D from the `global.json` pinned set;
3. drop D as a TARGET from every OTHER main's `per_file/<main>.json` localPins.

Step 3 is the new cross-file cost (localPins used to be one in-memory map). Two mechanisms:
- **Reverse index (in memory):** as per-file records load, index `target docid → set of main
  docids that locally-pin it`. The live `vault.on('delete')` handler uses it to rewrite only
  the affected mains' files cheaply. The index is best-effort/among-loaded — correctness does
  not depend on it because:
- **Orphan sweep (authoritative):** `OrphanSweeper`/`warmAll()` already walks the whole vault.
  Extend it to also reconcile the `per_file/` directory listing (`VaultFileStore.listKeys`)
  against live docids: delete orphaned per-file files, prune orphaned pins from `global.json`,
  and scan loaded/needed mains' localPins for orphaned targets. Chunked, delayed — the right
  place for the exhaustive pass. This keeps `forgetDocs` as the ONE choke point conceptually,
  now spanning: the per-file file, the global pinned set, and localPins target positions.
- Update `docIdKeyedDocids()` (read-side twin) to report all positions a docid can occupy so
  the warm-up resolves them on first build (same role as today, new storage).

## Shapes

- `data.json` (`persistedShapes.ts`): drop `pins`, `localPins`, `nodeOverrides`; keep
  `globalDepths`, `globalView`, `nodeExclusion`, `version`. Bump `PERSISTED_SHAPE_VERSION`
  (a removed key ⇒ discard-to-defaults on old files is exactly the intended clean break).
- `global.json` payload (inside the `{ v1: ... }` envelope): `{ pins: PinnedDocEntry[] }`
  (reuse the existing `PinnedDocEntry { docid, pinTimestamp }`). Keep it minimal so future
  truly-global vault-content facts can be added additively.
- `per_file/<docid>.json` payload (inside `{ v1: ... }`): a record with clearly-named,
  independently-optional sections, e.g.
  `{ override?: { sizePx?, content? }, localPins?: PinnedDocEntry[], localControls?: {...} }`
  — `localControls` reserved/empty for `nid_rnghlzs0uejjlbd5a4bjkq7eg_e`. A record with every
  section empty is deleted, not written empty (mirror today's node-override rule).
- Keep the existing branded/validated parsing discipline: a per-file/global payload that
  parses as JSON but has the wrong internal shape degrades field-by-field to defaults (as
  `PersistedShapes.parsePluginData` does today) — this is SEPARATE from the primitive's
  whole-file quarantine (which only triggers when the file isn't valid JSON or has no known
  version key).

# Tests

Unit (`npm test`, Fake-driven, BDD):
- Round-trip each field through the new home (pin → global.json; size/content override →
  per_file; local pin → per_file) and back into the merged view the adapter/engine consume.
- Clean break: an OLD `data.json` still carrying `pins`/`nodeOverrides`/`localPins` loads
  with those ignored and truly-global dials preserved.
- Delete D: its per-file file is removed, it leaves global.json pins, and it is pruned as a
  target from another main's localPins (via reverse index AND, separately, via the sweep with
  a cold index).
- Orphan sweep reconciles a `per_file/<id>.json` whose doc no longer resolves.
- `docIdKeyedDocids()` reports subject, global-pin and local-pin-target positions.
- A merge-conflicted `per_file/<id>.json` (conflict markers) → that doc's overrides read as
  absent (defaults), the file is quarantined, other docs unaffected (inherited from the
  primitive; assert at the domain level too).

E2E (`npm run test:e2e`, real Obsidian — REQUIRED here because this is stored-state behaviour
across restart and touches rendered pins/sizes):
- Pin a note, resize a node, set a content override, restart → all survive, now sourced from
  `.plugin_data/`.
- Local-pin a target under a specific main, restart → survives and is scoped to that main.
- Delete a pinned/overridden note → its `.plugin_data` files are gone and it is pruned as a
  local-pin target of another main.
- Drop a hand-crafted conflict-markered `per_file/<id>.json` into the vault before boot →
  plugin boots, that doc falls back to defaults, file is quarantined, no crash.
- Settle any settings-write windows via `e2e/settingsWriteWindow.ts` (never sleep).

Run `npm run test:all` before calling this done.

# Docs to update

- `CLAUDE.md` Persistence bullet + `docs-internal/architecture-map.md` `src/persistence/`
  section + `docs-internal/plan/high-level-plan.md` Persistence section: they currently state
  "`data.json` is the ONLY store." Replace with the two-tier model (truly-global config in
  `data.json`; vault-content pins/overrides/localPins in `.plugin_data/vicinity_graph/`, one
  file per docid, versioned + conflict-quarantined). Re-read line ~107 of the high-level plan
  (the parked "re-read sync-friendliness before any per-doc store" note) — this ticket
  discharges it; update it to point here.
- Release note: the clean break (old data.json pins/overrides/localPins reset once).

# Guardrails

- Preserve `ap_XXX_E` anchors and behaviour-capturing tests; no silent removals.
- Keep the settings write pipeline's ONE failure policy intact; do not add a second notice
  path or call-site try/catch (the primitive's quarantine notice is the only new user
  message, and it is read-side).
- Then unblock `nid_rnghlzs0uejjlbd5a4bjkq7eg_e` (add its `deps` on this ticket).

