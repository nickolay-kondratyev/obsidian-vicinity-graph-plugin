# Ticket: Pinned-central status lags ~15s after an Obsidian restart

**Status:** RESOLVED 2026-08-04 via `nid_gbyqsuplz8b7pv0u5k34sdz1q_e` — the
read path now warms the cold map on demand (`src/persistence/DocIdMapWarmer.ts`,
called from `VicinityGraphBuilder.build`): before assembling a request, the
builder resolves exactly the docids present in the pinned set and
`nodeOverrides` by scanning eligible files with `getDocId` (read-only,
chunked, early-exit), caching unresolvable docids as per-session misses so an
orphan never forces a rescan per rebuild. First build after restart renders
pins AND overrides correctly; the delayed sweep remains the orphan-deletion
backstop. This was option "D" (on-demand read-path resolution), chosen over
A/B/C below — kept for the record.
**Severity:** minor UX; no data loss — the pin IS persisted and reappears.
**Tracked as `nid_gbyqsuplz8b7pv0u5k34sdz1q_e`** (2026-08-04): per-node
overrides (`nodeOverrides`) hit the SAME cold map and raise the severity to a
visible layout jump, so that ticket owns the fix and this file stays as the
root-cause + options write-up it links to. Fix one, fix both.

> **2026-07-29 RE-VERIFIED after `nid_ez38gf1mrdgh5kxedzrdicwzl_e` (global-only
> settings) landed: STILL REPRODUCIBLE — this ticket stays OPEN.** Nothing in the
> root cause was touched: `PathDocIdMap` is still in-memory only and is still
> warmed for neighbour docids by `OrphanSweeper.run()` alone (plus MAIN's own id in
> `VicinityGraphBuilder` and the pinned doc on `pinDoc`), the sweep still starts at
> `SWEEP_DELAY_MS = 15_000`, and the assembler still SKIPS a pin whose docid does
> not resolve. Options A/B/C below are unaffected. Two details are now stale and
> corrected in place: per-doc depth settings no longer exist at all, and the
> toolbar's "Pinned centrals" disclosure was deleted — the lag is visible purely as
> node styling.

## Observation

After an Obsidian restart, a persisted pinned central renders as a plain `regular`
node (no dashed-accent identity) until the delayed orphan sweep runs and a rebuild
picks it up.

## Root cause

`PathDocIdMap` is in-memory only, so a restart starts it empty. A pin resolves to
a graph node via `resolveDocPath(docid)` → `PathDocIdMap.getPath(docid)`; a cold
map makes the assembler SKIP the pin (`GraphRequestAssembler` — "a pin whose docid
does not resolve to a path is SKIPPED"). The map is only warmed for neighbour
docids by `OrphanSweeper.run()` (`pathDocIdMap.set(...)`), scheduled at
`SWEEP_DELAY_MS = 15_000`. Between load and that sweep — and until a subsequent
rebuild — the pinned central shows as regular. Only pinned-central IDENTITY lags:
depth and every other setting is global and loads with `data.json`, and MAIN's own
docid resolves immediately.

## Options (Pareto)

- **A (cheap, likely enough):** after the sweep warms the map, refresh open views
  (`refreshOpenViews`) so the pinned identity appears without a manual rebuild.
- **B:** warm `PathDocIdMap` for the pinned set eagerly on load (resolve just the
  pinned docids up front) instead of waiting for the full sweep.
- **C:** persist a docid→path hint alongside the pin so first render resolves it
  (self-healing on rename via the existing map).

## Coverage

The e2e asserts the pin *does* survive restart by polling with remounts across the
sweep window, so this ticket is about *latency of the visual identity*, not
persistence. Revisit visibility here if A/B/C lands.
