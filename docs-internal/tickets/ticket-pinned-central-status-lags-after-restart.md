# Ticket: Pinned-central status lags ~15s after an Obsidian restart

**Status:** OPEN — surfaced by the step-06 restart-round-trip e2e (`e2e/controlsRestart.e2e.ts`).
**Severity:** minor UX; no data loss — the pin IS persisted and reappears.

> **2026-07-29 scope check:** the settings simplification
> (`nid_ez38gf1mrdgh5kxedzrdicwzl_e`, global-only settings) keeps pins GLOBAL and
> keeps `PathDocIdMap` + the (slimmed) sweep, so this defect likely survives it.
> Re-verify after that ticket lands and adjust the "per-doc depth settings are
> unaffected" remark below — per-doc depth settings will no longer exist.

## Observation

After an Obsidian restart, a persisted pinned central renders as a plain `regular`
node (no dashed-accent identity, absent from the toolbar's "Pinned centrals"
disclosure) until the delayed orphan sweep runs and a rebuild picks it up.

## Root cause

`PathDocIdMap` is in-memory only, so a restart starts it empty. A pin resolves to
a graph node via `resolvePinPath(docid)` → `PathDocIdMap.getPath(docid)`; a cold
map makes the assembler SKIP the pin (`GraphRequestAssembler` — "a pin whose docid
does not resolve to a path is SKIPPED"). The map is only warmed for neighbour
docids by `OrphanSweeper.run()` (`pathDocIdMap.set(...)`), scheduled at
`SWEEP_DELAY_MS = 15_000`. Between load and that sweep — and until a subsequent
rebuild — the pinned central shows as regular. (MAIN's own docid resolves
immediately, so per-doc *depth* settings are unaffected; only pinned-central
identity lags.)

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
