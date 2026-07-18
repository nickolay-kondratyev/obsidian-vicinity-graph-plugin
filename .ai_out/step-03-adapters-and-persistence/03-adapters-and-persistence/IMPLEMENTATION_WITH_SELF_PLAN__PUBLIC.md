# IMPLEMENTATION — Step 03: Obsidian Adapters + Persistence (PUBLIC)

Status: COMPLETE. Branch `03-adapters-and-persistence`, git clean, check/test/build green.
(Second instance; predecessor delivered milestones 1–3 and untracked milestone-4 WIP,
which was reviewed, corrected and completed.)

## What was built

### src/shared/ (pure, engine-importable)
- `VaultPathFacts`, `FileKinds` — single source for path/extension knowledge
  (DRYed 3 consumers incl. two engine files).

### src/adapters/
- `obsidianPorts.ts` — structural ports (VaultPort, MetadataCachePort, DocIdPort, ...);
  real Obsidian objects satisfy them unchanged → NO obsidian vitest mock anywhere.
- `ReferenceOrder` — true reference order from getFileCache (frontmatterLinks first,
  then links+embeds by offset).
- `BacklinksAdapter` — CLARIFICATION Q1: the single-cast wrapper for
  `getBacklinksForFile` (runtime presence check, Map/Record `.data` shapes).
- `CanvasFallbackParser` + `CanvasParseCache` (mtime-keyed) + `CanvasCapability` —
  Q2: fallback parser is the ACTIVE path on the target install; malformed JSON
  never throws; text-node wikilinks skipped (V1).
- `ObsidianLinkProvider` — engine LinkProvider over live cache; async `create` does
  only what must be async (canvas parses, resolvedLinks inversion when the
  backlinks API is absent); sync queries after.
- `GraphRequestAssembler` (PURE) — docid-keyed persisted state → path-keyed
  GraphBuildRequest: unresolvable pins skipped (sweep cleans), main-as-pin skipped,
  pinned-root depths = own persisted depths overlaid PER-FIELD by MAIN's
  `centralDepths[pinDocid]`, view overrides tied to descriptors.
- `NeighborhoodGraphBuilder` — the per-rebuild orchestration (debug command now,
  step-04 view later). Read path: `getDocId` ONLY.

### src/persistence/
- `persistedShapes.ts` — versioned shapes (`version: 1` from day one) + defensive
  parsers (malformed → defaults / null, never throw). Persisted `sizing` is
  repaired per-field onto engine defaults because it replaces defaults WHOLESALE
  in the view cascade (see "Key fixes" below).
- `DocPersistEligibility` — Q3: typed `PersistableIdentity`
  (`persistable` | `not-persistable` reason `no-docid`/`unsafe-docid`) for the
  future node emblem; filename rule `/^[A-Za-z0-9_-]{1,120}$/`.
- `DocDataMutations` — pin-on-toggle made code: setting a field WRITES it even when
  equal to the global default; `undefined` reverts to inherit; per-field, never
  snapshots.
- `PluginDataStore` (data.json: globals + pins with timestamps, serialized writes),
  `DocDataStore` (one `doc-data/<docid>.json` per doc via `vault.adapter`,
  per-docid serialized RMW, empty → file deleted, unsafe docid → throws as
  programmer-error re-assertion).
- `PathDocIdMap` (bidirectional, stale-pair-safe), `ChunkedWork`
  (batch + `await sleep(0)`), `SweepPlanner` (pure orphan judgment),
  `OrphanSweeper` (warm map via READ-ONLY getDocId → drop exactly orphan doc-data
  files / stale pins / dangling centralDepths; injectable yield).
- `PersistenceServices` — the ONLY `ensureDocId` call site (explicit write intent:
  pin, per-doc/central setting); every entry returns the typed verdict; refusals
  persist nothing. `unpinDoc` leaves centralDepths traces to the sweep (step-doc lean).

### src/main.ts
Full lifecycle wiring: stores init, `vault.on('rename')` (map move) and
`vault.on('delete')` (live cleanup, sweep as backstop for unmapped paths), sweep
scheduled at `SWEEP_DELAY_MS` (15s, cleared in onunload), public fields
`graphBuilder` / `persistenceServices` / `pluginDataStore` for steps 04/06, and the
exit-criterion harness command **"Debug: log neighborhood graph for active file"**
(console summary + node/edge tables). Dev vault fixtures (note1..3, pic.png,
test.canvas) enriched — note `.dev-vault/` is gitignored, so they are local-only.

### Step doc updated
`docs-internal/plan/steps/step-03-adapters-and-persistence.md` — new
"Step-planning notes" records the Q2 devtools result (0 `.canvas` keys → fallback
parser ACTIVE on target install, zero-canvas-vault caveat) and resolutions of open
items 2–4.

## Key fixes made while adopting predecessor WIP
1. **Sizing parse bug (correctness, not just types):** WIP cast a shallow record to
   `SizingSettings`. Since a persisted `sizing` replaces the default wholesale in
   `ViewSettingsResolver`, a partially-mangled disk value would have crashed
   `NodeSizer`. Now `parseSizing` emits a COMPLETE shape (recognized fields survive,
   unusable ones repaired from defaults; non-object → inherit). Covered by 3 tests.
2. `toSorted()` → `sort()` (not in the project's tsc lib).
3. Extracted `FakePluginDataPort` and added `FakeDocIdPort` (with `ensureCalls`
   counter) — reused across sweep/services/builder tests to assert read paths
   never mint ids.

## Tests
- Root suite: **297 passing / 30 files** (step-02 exit baseline was 136/10; 287 at
  review + 10 iteration regression tests — see IMPLEMENTATION_ITERATION__PUBLIC.md
  for the F1–F8 dispositions, all incorporated in commit `1f4d6ca`).
  Sublib obsidian-id-lib: **69 passing / 6 files**.
- `npm run check` clean; `npm run build` green (bundles incl. id-lib submodule,
  artifacts copied to .dev-vault).
- Style: BDD `WHEN ... THEN ...`, ~one assert per test, structural fakes only
  (zero `obsidian` runtime imports in tested files).

## Exit-criteria mapping
| Criterion | Status |
|---|---|
| Real-vault graphs through ObsidianLinkProvider, verified via debug command | Wired: `Debug: log neighborhood graph for active file` + end-to-end builder tests over fakes. **Human run in real Obsidian pending** (no Obsidian in this env). |
| Persistence round-trips; sweep delayed + chunked | Round-trip/pin-on-toggle/version/unsafe-docid tests; sweep chunking proven with 25-file fixture + injected yield counter; 15s delay wired in main.ts. **Real-vault observation pending human run.** |
| All new logic vitest-covered; adapters thin | Yes — every branching decision lives in a pure tested class (parsers, planner, assembler, mutations, eligibility). |

## Follow-up-worthy items (no blockers, no #QUESTION_FOR_HUMAN)
- Human smoke run in the dev vault: open note1.md → run the debug command → expect
  nodes note1/note2/note3 + test.canvas, attachment pic.png as first image; observe
  sweep log-free run ~15s after load.
- `.dev-vault/` fixtures are untracked (gitignored) — recreate from this file's
  description if the machine changes (or track them in a future step if desired).

## Commits (step-03 implementation)
`c736105`, `f4d9363`, `bf05093` (predecessor, milestones 1–3), `0ca7a68`
(persistence layer), + sweep infrastructure, orchestration layer, and main.ts
wiring/step-doc commits by this instance.
