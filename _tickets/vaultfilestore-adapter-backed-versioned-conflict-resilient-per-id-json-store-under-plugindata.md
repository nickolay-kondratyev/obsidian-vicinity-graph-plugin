---
id: nid_cdoymzgq5kjh5d10q1tkavnsy_e
title: 'VaultFileStore: adapter-backed, versioned, conflict-resilient per-id JSON
  store under .plugin_data/'
status: in_progress
deps: []
links: [nid_vb246h5pr4609hid76ts1ufe5_e, nid_8f8ey41extajt08zphwwxhnwq_e]
created_iso: '2026-08-10T03:20:52Z'
status_updated_iso: '2026-08-10T17:35:35Z'
type: feature
priority: 1
assignee: nickolaykondratyev
tags: [persistence, storage]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
# Goal

Build the reusable, domain-agnostic file-store primitive that ticket
`nid_vb246h5pr4609hid76ts1ufe5_e` (planning) decided on: a vault-adapter-backed store of
versioned JSON files living OUTSIDE `.obsidian/`, resilient to the merge conflicts that
per-file vault content will inevitably hit. This ticket delivers ONLY the primitive + its
tests. The domain rewiring (moving pins / nodeOverrides / localPins onto it) is the
dependent ticket. Nothing user-visible changes when this ticket lands alone.

# Owner decisions this implements (from the planning ticket)

- Location: **vault root** `${VAULT_PATH}/.plugin_data/vicinity_graph/` (NOT under
  `.obsidian/`), so it syncs as vault content even for users who exclude `.obsidian` from
  sync. This means raw `vault.adapter` I/O — Obsidian's `Plugin.saveData/loadData` only
  reach the single `data.json` in the plugin folder and CANNOT reach this tree.
- Version envelope: every file's payload is wrapped under a single version key, e.g.
  `{ "v1": { ... } }`. The reader dispatches on which `vN` key is present, so a future
  NON-additive shape change (v2) can be told apart from v1 rather than guessed. (This is a
  stronger contract than the existing numeric `version` field in `data.json`.)
- Merge-conflict / malformed resilience: if a file cannot be parsed as JSON (git/Syncthing
  conflict markers, truncation, unknown version key), it is NOT read as data — it is
  QUARANTINED by renaming to `<basename>_malformed_<timestamp>.<ext>` and the logical entry
  is treated as ABSENT (caller falls back to defaults). Timestamp is human-readable and
  filename-safe (no colons), e.g. `2026-08-09T14-32-05`.

# Where it lives

New module under `src/persistence/` (the JSON-storage layer per
`docs-internal/architecture-map.md`). Suggested: `src/persistence/VaultFileStore.ts` plus a
port for the raw filesystem seam and a `Fake*` for tests. Must stay consistent with the
existing persistence layering — it is a low-level seam that the domain store (ticket B) sits
on top of, the same way `PluginDataStore` sits on `PluginDataPort` today.

Docs: add the primitive (module, port, quarantine behaviour) to the `src/persistence/`
section of `docs-internal/architecture-map.md` in THIS ticket — the domain-level doc
rewrites (CLAUDE.md, high-level-plan) stay in ticket B, which is what changes the story.

# Design

## 1. Filesystem port (new seam, with a Fake)

Obsidian's `DataAdapter` (`this.app.vault.adapter`) is the real backend. Define a narrow
structural port so tests never touch a real FS — mirror the existing pattern of
`src/persistence/storagePorts.ts` (`PluginDataPort`) + `src/persistence/FakePluginDataPort.ts`.

Port methods needed (name to match the subset of `DataAdapter` we use):

```ts
export interface VaultFsPort {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;          // rejects if absent
  write(path: string, contents: string): Promise<void>;
  remove(path: string): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  mkdir(path: string): Promise<void>;            // idempotent; ignore "already exists"
  list(dirPath: string): Promise<{ files: string[]; folders: string[] }>;
}
```

- The real impl is a thin wrapper over `vault.adapter` (`adapter.exists/read/write/remove/
  rename/mkdir/list`). Wire it in `src/main.ts` next to where `PluginDataStore` is
  constructed (`main.ts:76`). Only `main.ts`/adapters may import `obsidian`; the store
  module stays obsidian-free and takes the port by injection.
- `FakeVaultFsPort` — an in-memory map of path→string with the same semantics (list returns
  immediate children; read rejects on absent; rename moves the key). This is the workhorse
  for unit tests, including simulating a merge-conflicted file (write raw text containing
  `<<<<<<<` conflict markers) and asserting quarantine.

## 2. Clock seam (reuse existing)

Quarantine filenames need a timestamp. `PersistenceServices` already takes a `clock`
(`src/persistence/PersistenceServices.ts`) — reuse the SAME clock abstraction (inject it)
so tests get deterministic quarantine names. Add a small formatter that renders the clock's
instant as `YYYY-MM-DDTHH-mm-ss` (filename-safe, no colons). Keep the formatter pure and
unit-tested. Do NOT call `Date.now()`/`new Date()` directly in the store — go through the
injected clock.

## 3. The store API (domain-agnostic)

`VaultFileStore` owns ONE directory subtree and reads/writes versioned JSON files in it. It
knows NOTHING about pins/overrides — it is `<key> ↔ <parsed payload>`.

```ts
// Envelope: on disk every file is exactly `{ "v1": <payload> }` (current version key).
// The store is generic over the payload; the domain layer supplies parse/serialize.
class VaultFileStore {
  constructor(rootDir: string, fs: VaultFsPort, clock: Clock, notice?: UserNoticePort);

  // Read one file by relative key (e.g. "per_file/<id>.json").
  // Returns the unwrapped v1 payload as unknown, or null if absent OR quarantined.
  read(relPath: string): Promise<unknown | null>;

  // Write wraps payload as { v1: payload }, ensures parent dir, writes ATOMICALLY.
  write(relPath: string, payload: unknown): Promise<void>;

  remove(relPath: string): Promise<void>;
  exists(relPath: string): Promise<boolean>;

  // List immediate child file keys of a subdir (e.g. "per_file") — used by the sweep in
  // ticket B to reconcile stored ids against live docids.
  listKeys(subDir: string): Promise<string[]>;
}
```

Behaviours:

- **Envelope read/dispatch.** Parse the file text as JSON. If parse throws OR the object has
  no recognised version key (only `v1` today) → QUARANTINE (see below) and return null.
  Otherwise return `obj.v1`. Keep a `SUPPORTED_VERSION_KEYS`/current-key constant so adding
  `v2` later is one edit + a dispatch branch.
- **Envelope write.** Always write `{ [CURRENT_VERSION_KEY]: payload }`. Pretty-print
  (`JSON.stringify(x, null, 2)`) so a human diff / merge of these vault-content files is
  legible — merge-friendliness is the point, and stable key ordering keeps diffs minimal
  (have the domain layer hand payloads with deterministic key order; the store can also sort
  object keys on serialize — decide in impl, but DO make the output diff-stable).
- **Atomic write.** Write to `<relPath>.tmp` then `rename` over the target, so a crash /
  concurrent read never sees a half-written file. `mkdir -p` the parent first (idempotent).
  If the platform adapter rename can't overwrite, `remove` then `rename` — but keep the
  window minimal; document the WHY.
- **Quarantine.** On an unreadable file at `relPath`: rename it to
  `<dir>/<base>_malformed_<clock-timestamp><ext>` (collision-safe: if that name exists,
  append `_2`, `_3`, …). Log via console AND emit ONE `UserNoticePort` message naming the
  file and that it was likely a sync conflict set aside (do NOT spam — one notice per
  detection). Then behave as if the file were absent. NEVER delete the user's bytes — a
  quarantine is recoverable, a delete is not.
- **Per-key write serialisation.** Two writes to the SAME file must not interleave
  (last-write-wins, in order). Reuse `src/shared/SerialPromiseChain.ts` but keyed PER
  relPath (a `Map<string, SerialPromiseChain>`), so different files write in parallel and a
  slow write to file X never blocks file Y. This is the multi-file analogue of the single
  global chain `PluginDataStore` uses today.

## 4. Directory layout owned here

```
${VAULT_PATH}/.plugin_data/vicinity_graph/
  per_file/<docid>.json       # (populated by ticket B: per-doc + per-main facts)
  per_file/*_malformed_<ts>.json  # quarantined files (never read, never cleaned by us)
```

(Note: the global pinned SET is NOT stored here — owner decision 2026-08-10 keeps it in
`data.json` under Obsidian's management. The `global.json` mentioned in earlier drafts is
gone. This primitive is domain-agnostic regardless; it just owns whatever keys ticket B
writes, which today is only the `per_file/` subtree.)

This ticket only creates the primitive and can create the root dir lazily on first write; it
does not put domain data in it. A tiny smoke wiring in `main.ts` (construct the store) is
fine but it should be otherwise inert until ticket B uses it.

# Tests (BDD, colocated `*.test.ts`, one behaviour per test, Fake-driven)

Cover on `FakeVaultFsPort` + a fake `Clock`:

- WHEN writing a payload THEN the on-disk text is `{ "v1": <payload> }` and re-reading
  returns the payload.
- WHEN the parent dir is absent THEN write creates it (mkdir idempotent, no throw on repeat).
- WHEN a file contains git conflict markers / invalid JSON THEN read returns null AND the
  file is renamed to `*_malformed_<ts>.json` AND the original path no longer exists AND a
  UserNotice fired once.
- WHEN a file's object has no `v1` (unknown/missing version key) THEN it is quarantined, same
  as malformed.
- WHEN a quarantine target name already exists THEN a `_2` suffix is used (no overwrite of a
  prior quarantine).
- WHEN two writes to the SAME key race THEN the last-requested payload is the final on-disk
  content, and neither write interleaves (assert via a chain-order probe).
- WHEN writes target DIFFERENT keys THEN they are not serialised behind each other.
- WHEN a crash leaves a `.tmp` file (simulate) THEN a subsequent read of the real key is
  unaffected (tmp is never read as the key).
- `listKeys("per_file")` returns only immediate children, not the malformed siblings at root.
- Timestamp formatter renders a known instant to the exact `YYYY-MM-DDTHH-mm-ss` string
  (deterministic via fake clock).

`npm test` (vitest) covers all of the above — this primitive has no view/DOM surface, so no
e2e is required for THIS ticket (the end-to-end restart/sync behaviour is exercised in
ticket B). Run `npm run check` (strict tsc) too.

# Guardrails / conventions

- Engine purity is not at risk (this is persistence), but keep the store obsidian-free and
  inject the port, so `src/engine/importGuard.test.ts`-style discipline is preserved and the
  Fake path works.
- `UserNoticePort` is defined once and only `main.ts` constructs the real `Notice`
  (`docs-internal/architecture-map.md`) — reuse that port; do not construct `Notice` here.
- Temp files for your own debugging → `$PWD/.tmp/`. Do not source-control anything under
  `.plugin_data/` (add to `.gitignore` for the dev-vault if needed).

# Out of scope (belongs to the dependent ticket)

- Moving any real data (pins/overrides/localPins) onto the store.
- The lazy per-file read path, the per-file record shape, the delete/orphan-sweep
  cross-file pruning, and the localPins reverse-index. All of that is ticket B.
