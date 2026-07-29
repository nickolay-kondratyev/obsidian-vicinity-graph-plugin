# PHASE 1 — per-doc removal (global-only settings) — RESULT

Ticket `nid_ez38gf1mrdgh5kxedzrdicwzl_e`, code-only phase. **`npm test` (1085 passed / 82 files) and
`npm run check` are green; `npm run build` succeeds.** 4 focused commits on
`CC_nid_ez38gf1mrdgh5kxedzrdicwzl_e__settings-simplification-remove-per-doc-saved-state_opus`:

| commit | scope |
|---|---|
| `2ee62a0` | engine: drop the per-doc settings layer |
| `347dc77` | persistence: delete the doc-data store |
| `af8cc11` | view/adapters: global-only settings surfaces |
| `2a49713` | comment-only scrub of residual per-doc language |

## What changed (file level)

### Deleted
- `src/persistence/DocDataStore.ts` (+test), `DocDataMutations.ts` (+test), `FakeFileStorage.ts`,
  `docDataDirName.ts`
- `src/engine/TraversalSettingsResolver.ts`, `src/engine/ViewSettingsResolver.ts`,
  `src/engine/settingsResolvers.test.ts`
- `src/adapters/resolvePinnedDescriptors.ts`, `src/adapters/CentralDepthRoundTrip.test.ts`
- `src/view/settingsWriteScope.ts` (+test), `src/view/CentralDepthControls.tsx`

### Added
- `src/view/GlobalDepthControls.tsx` — the panel's Depth section, two `DepthStepper`s bound to
  `globalDepths`, writing the existing `global-depth` interaction (same seam as the settings tab's
  depth sliders).

### Changed
- **engine** — `GraphBuildRequest` lost `depthOverridesByRoot` / `mainViewOverride` /
  `pinnedViewOverrides`; every root traverses with the one `globalDepths`, `viewSettings` is
  `request.globalView` verbatim. `DepthOverride` / `ViewSettingsOverride` aliases and
  `PinnedViewOverride` removed from `types.ts` / `index.ts`; `DIRECTION_DEPTH_FIELD` is now keyed by
  `keyof DepthSettings`.
- **persistence** — `persistedShapes.ts`: `DocData`, `parseDocData`, `emptyDocData`,
  `parseCentralDepths` gone; `parseDepthOverride`/`parseViewOverride` renamed to
  `parseDepthFields`/`parseViewFields` (they parse partials merged over the spec defaults — no
  override layer to name). `storagePorts.ts` lost `FileStoragePort`. `PersistenceServices` is
  pin/unpin only (constructor lost the `DocDataStore`). `SweepPlanner`/`SweepSummary` prune ONLY
  stale global pins (`{ pinsRemoved }`).
- **adapters** — `GraphRequestInputs` lost `mainPersistable` / `mainDocData` / `docDataByDocid`;
  pin→descriptor resolution inlined into `GraphRequestAssembler`. `VicinityGraphBuilder` lost the
  doc-data loaders and its `DocDataStore` dependency.
- **view** — `ControlsModel` is now `{mainPinned, globalDepths, globalView, nodeExclusion,
  excludedNodeCount}` (`CentralControl` / `DirectionDepth` / `centrals` gone). `settingsWritePlan`
  lost the `main-depth`/`central-depth` interactions and the `doc-depth-field`/`central-depth-field`
  commands. `ControlsActions` lost the per-doc arms, `mainFile()`, `NOT_PERSISTABLE_NOTICE` and the
  `OwningViewPort` dependency. `viewPorts.ts` lost `OwningViewPort`. `DepthStepper` lost
  `pinned`/`disabled`/reset. `GraphToolbar` lost the "Pinned centrals (n)" disclosure and now always
  renders (the `status === "empty"` short-circuit in `VicinityGraphFlow` already covered the old
  null-return case). `VicinityGraphSettingTab.persist()` lost its two ignore-arms.
- **main.ts** — no `DocDataStore`, no `docDataDirPath()`, sweep log is `pinsRemoved=[…]`,
  `handleVaultDelete` only removes a pin.
- **CSS** — `graph-view.css`: `.vicinity-graph-central*` rules replaced by
  `.vicinity-graph-depth-controls`; `data-pinned` / `__reset` / `data-disabled` stepper rules gone.

## Decisions + rationale (beyond the ticket's literal list)

1. **`TraversalSettingsResolver` and `ViewSettingsResolver` deleted, not "collapsed".** With the
   override arguments gone both are identity functions (`return global`) — dead weight that reads
   like a cascade. `VicinityEngine` uses `request.globalDepths` / `request.globalView` directly.
2. **`resolvePinnedDescriptors.ts` inlined into `GraphRequestAssembler`.** Once the depth merge died
   its only remaining consumer was the assembler (the toolbar model no longer lists centrals), so a
   separate module was pure indirection.
3. **`settingsWriteScope.ts` deleted rather than reduced to `const "global"`.** Every command is
   global, so `ControlsActions` unconditionally fans out to every open view. That also retired
   `OwningViewPort` (`currentMainPath` had no other caller); `GraphViewController.handleSettingsChanged`
   stays — `VicinityGraphView.refresh()` still uses it for the fan-out.
4. **`DepthOverride` / `ViewSettingsOverride` type aliases deleted** in favour of literal
   `Partial<…>` at the two parse sites: keeping a type named "Override" with no override layer would
   be a POLS violation.
5. **`DocPersistEligibility` behavior deliberately UNCHANGED.** Its filename-safety rule outlived its
   original reason (naming a `doc-data/<docid>.json`); the pin refusal for id-less/unsafe docs is
   kept as-is with a WHY-NOT comment saying loosening it is a separate product decision.
6. **Stored-data break**: existing `doc-data/` dirs are simply IGNORED (orchestrator's choice). No
   migration, no delete-on-load, no back-compat branch.
7. **Reset copy** stopped promising surviving per-note overrides: the tab-wide description now says
   "Pinned notes are kept." and the depth card says "Resets the outgoing and incoming depth used for
   every central note." The behaviour-capturing test was PORTED, not dropped.

### Tests: removed vs ported
- Removed (deleted behavior, per the owner's alignment): `settingsResolvers.test.ts`,
  `CentralDepthRoundTrip.test.ts`, `DocDataStore.test.ts`, `DocDataMutations.test.ts`,
  `settingsWriteScope.test.ts`, `PersistenceServices` per-doc-settings describe, `ControlsActions`
  per-doc-scope tests, `ControlsModel` inherited-vs-pinned + central-list + persistability describes,
  `settingsWritePlan` main/central-depth describes, `OrphanSweeper`/`SweepPlanner` doc-data +
  centralDepths cases.
- Ported into the global form: "one global depth drives MAIN **and** every pinned central" and
  "globalView passes through" (`VicinityEngine.test.ts`); the whole sizing / force-layout /
  presence-semantics parse suite moved from `parseDocData(...).view` onto `globalView`
  (`persistedShapes.test.ts`), plus a NEW compile-forced test: a `globalView` with every field at a
  non-default value round-trips (typed as the complete `ViewSettings`, so a new field is a compile
  error until it gets a fixture value) with a companion guard that every fixture field really
  differs from its default. Assembler now pins global settings pass-through; sweep keeps its
  stale-pin, warm-up, mid-sweep-race and chunk-yield tests.

## Deliberately left for PHASE 2

**Docs (untouched by design).** Exact pointers observed:
- `README.md:22` ("per-direction, per-note depth control"), `:70` ("two layers of settings … per-note
  overrides"), `:135` (centralDepths rule), `:151`, `:311` (`data.json` and `doc-data/*.json`),
  `:314` ("per-doc pins")
- `docs-internal/plan/high-level-plan.md:9`, `:44` ("not per-doc" — still true, reword),
  `:72` (centralDepths), `:73` (pin-on-toggle), `:74` (reset-to-global affordances), `:80`
  (doc-data storage choice), `:82` (sweep validates doc-data + centralDepths), `:128` (Phase 3)
- `docs-internal/architecture-map.md:25-26` (per-doc settings / `DocDataStore`)
- `docs-internal/RELEASE_CHECKLIST.md` — needs the discard note ("per-doc depth/view overrides
  removed; stored per-doc overrides are discarded"); nothing in it mentions doc-data today.
- `docs-internal/notes/settings.md`, `docs-internal/plan/steps/step-03-*.md` + `step-06-*.md`
  (superseded banners), and the three tickets to close/annotate.

**e2e — minimal edits only** (the `selectorGuard`/`vaultTarget` guards run under `npm test`, so these
could not be deferred):
- `e2e/obsidianHarness.ts` — doc-data wipe + `DOC_DATA_DIR_NAME` import removed; `saveGlobalView`
  now takes `Partial<ViewSettings>`.
- `e2e/controlsRestart.e2e.ts` — depth locators/helpers retargeted at
  `.vicinity-graph-depth-controls`; the trailing "Pinned centrals disclosure" assertion dropped.
- `e2e/pinnedCentralScenario.e2e.ts` — the `"pinned-central depth is per-MAIN-doc"` test deleted
  (behavior gone); the pin/unpin-lifecycle test kept and made self-sufficient (it now pins `sc_x`
  itself, which the deleted test used to do). A `TODO(PHASE 2 …)` in the file header asks for a new
  spec covering the global depth stepper driving MAIN + pinned centrals.
- `e2e/settingsBaseline.ts:140-154` still exports `PINNED_CENTRALS_SUMMARY` /
  `PINNED_CENTRALS_SUMMARY_PATTERN`, and `e2e/settingsUxVisual.e2e.ts:94,134-142` still filters
  on/asserts the absence of that disclosure. Harmless (the disclosure is now unconditionally absent,
  so the absence test passes) but PHASE 2 should delete the constants and that filter.
- `e2e/vaultCopyReseed.test.ts` (named removable in the ticket) does not exist in this tree.

## Callouts
- **Behaviour change beyond persistence**: the panel's Depth steppers now write the GLOBAL depth, so
  a bump there changes every note's graph and fans out to every open view. That is the owner's
  decision, but it is a real UX shift from "this note's depth" — worth one sentence in the release
  note.
- `e2e/pinnedCentralScenario.e2e.ts` and `controlsRestart.e2e.ts` were adjusted but NOT run (real
  Obsidian required; `npm run test:e2e` is the release gate and was out of scope for this phase).
- `main.js` / `styles.css` are build artifacts and remain untracked/uncommitted.
