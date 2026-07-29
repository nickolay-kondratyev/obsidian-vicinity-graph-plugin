# PHASE 1 — per-doc removal (global-only settings) — PRIVATE state

## Goal
Delete ALL per-doc saved graph state. Settings global-only. Pins stay global. ONE global depth
drives MAIN + every pinned central.

## Plan (commit-sized steps)
1. **engine**: drop `DepthOverride`/`ViewSettingsOverride` aliases, delete `TraversalSettingsResolver`
   (becomes identity) + `ViewSettingsResolver` (collapses to `return global`), drop
   `depthOverridesByRoot` / `mainViewOverride` / `pinnedViewOverrides` from `GraphBuildRequest`,
   update `index.ts`, delete `settingsResolvers.test.ts`, port "globals drive every root / view
   output" into `VicinityEngine.test.ts`.
2. **persistence**: delete `DocDataStore`(+test), `DocDataMutations`(+test), `FakeFileStorage`,
   `docDataDirName`, `FileStoragePort`; drop `DocData`/`parseDocData`/`emptyDocData`; strip
   `PersistenceServices` to pin/unpin; `SweepPlanner`/`OrphanSweeper` keep ONLY stale-pin pruning.
3. **adapters**: `GraphRequestInputs` loses `mainPersistable`/`mainDocData`/`docDataByDocid`;
   inline pin resolution into `GraphRequestAssembler` and delete `resolvePinnedDescriptors.ts`
   + `CentralDepthRoundTrip.test.ts`; `VicinityGraphBuilder` loses docDataStore.
4. **view**: `settingsWriteScope` → constant `"global"`; drop `main-depth`/`central-depth`
   interactions + `doc-depth-field`/`central-depth-field` commands; `ControlsActions` loses
   per-doc arms/`mainFile()`/NOT_PERSISTABLE_NOTICE; `ControlsModel` loses `centrals`; new
   `GlobalDepthControls.tsx` replaces `CentralDepthControls.tsx` (panel Depth section now writes
   `global-depth`); `DepthStepper` loses `pinned`/reset/`disabled`; settings tab `persist()`
   loses ignore-arms; reset copy stops promising per-note overrides survive.
5. **main.ts** wiring + CSS cleanup + e2e `obsidianHarness` doc-data wipe removal.

## Notes / decisions
- Stale `doc-data/` dirs are IGNORED (orchestrator decision) — no delete-on-load code.
- Deleting `TraversalSettingsResolver`/`ViewSettingsResolver` goes one step past the ticket's
  literal wording (which said "collapse"); both would be identity functions, i.e. dead weight.
- `resolvePinnedDescriptors.ts` had exactly one remaining consumer after the merge logic dies
  → inlined into `GraphRequestAssembler`.
- `OwningViewPort.currentMainPath()` becomes unused once depth writes are global → check.

## Status
See PUBLIC.md (authoritative for outcome).
