---
closed_iso: 2026-07-30T00:02:20Z
id: nid_ez38gf1mrdgh5kxedzrdicwzl_e
title: "Settings simplification \u2014 remove per-doc saved state: global-only settings,\
  \ global pins (delete doc-data subsystem)"
status: closed
deps: [nid_wimjq4ewgbg21n4zx9d4qq3a0_e]
links: [nid_m5hxe4eo9jgt7cfic7s2o3uvi_e, nid_7fq9y51mbucmduzf9z31hmwmq_e]
created_iso: '2026-07-29T22:10:23Z'
status_updated_iso: 2026-07-30T00:02:20Z
type: task
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [settings, settings-cleanup, persistence, architecture]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Overarching context: docs-internal/notes/settings.md (grouping tag: settings-cleanup, step 2.5 of the chain — between the descriptor model and the write pipeline).

OWNER DECISION (2026-07-29): drop ALL per-doc saved graph state for now. Settings are GLOBAL-only. Pinned nodes stay, and they are GLOBAL pins (they already live in data.json `pins` — that part does not change). Per-pinned-central depth dials go away too: ONE global depth setting drives MAIN and every pinned central (owner picked "all-global" over "per-pin stored globally").

WHY: the per-doc subsystem (~900 prod lines exclusively per-doc, ~1300 more with per-doc branches, ~1700 test lines) exists to remember per-doc depth/view overrides and per-viewing-doc centralDepths. That complexity is not paying for itself pre-release, and the settings-cleanup chain (write pipeline, dual presenters, spec tests, embed-depth field) gets dramatically simpler if it is built against a global-only model instead of carrying per-doc arms that would then be deleted.

# WHAT GOES AWAY

- The whole per-doc file store `.obsidian/plugins/<id>/doc-data/<docid>.json`:
  - src/persistence/DocDataStore.ts (+test), src/persistence/DocDataMutations.ts (+test), src/persistence/FakeFileStorage.ts
  - DocData shape in src/persistence/persistedShapes.ts:61-69 (`depths`, dead `view` — no production writer, `centralDepths`), parseDocData
  - PersistenceServices.setDocDepthField / setDocViewField / setCentralDepthField (src/persistence/PersistenceServices.ts:38-65)
- Per-central depth merge + steppers:
  - src/adapters/resolvePinnedDescriptors.ts merge logic (mergedDepthOverride / mainAdjustedDepthOverride, :44-64)
  - src/view/CentralDepthControls.tsx per-central steppers; `main-depth`/`central-depth` interactions and `doc-depth-field`/`central-depth-field` commands in src/view/settingsWritePlan.ts:26-67
  - src/adapters/CentralDepthRoundTrip.test.ts
- The `"per-doc"` write scope entirely: src/view/settingsWriteScope.ts becomes constant "global"; ControlsActions per-doc arms, mainFile(), NOT_PERSISTABLE_NOTICE (src/view/ControlsActions.ts:52-61, 90-133); VicinityGraphSettingTab.persist() ignore-arms (src/view/VicinityGraphSettingTab.ts:889-899)
- Engine plumbing that only served per-doc: `depthOverridesByRoot` on GraphBuildRequest (src/engine/VicinityEngine.ts:35), TraversalSettingsResolver override arg, ViewSettingsResolver cascade collapses to "return global" (src/engine/ViewSettingsResolver.ts:12-53), mainDocData/docDataByDocid in src/adapters/VicinityGraphBuilder.ts:50-89 and GraphRequestAssembler
- ControlsModel per-doc fields: `persistable` mirror, owned-layer `pinned` presence on directionDepth (src/view/ControlsModel.ts:30-38, :128-139)

# WHAT STAYS

- Global pins in data.json (`PluginData.pins`), pin/unpin via PersistenceServices.pinDoc/unpinDoc, hover-pin UI, PathDocIdMap (docid→path for pins), DocPersistEligibility.classify (pin refusal for id-less docs)
- OrphanSweeper SLIMS rather than disappears: it still prunes stale global pins; drop docDataFilesRemoved/centralEntriesRemoved/ownersRewritten from SweepSummary and collectCentralDocidsByOwner
- Global persistence unchanged: data.json globalDepths/globalView/pins/nodeExclusion via PluginDataStore

# STORED-DATA BREAK (clean break, per standing convention — plugin unpublished)

Existing doc-data/ dirs become dead files. Delete the dir on load or just ignore it (prefer the simplest); either way add a release-note line in docs-internal/RELEASE_CHECKLIST.md ("per-doc depth/view overrides removed; stored per-doc overrides are discarded"). Never break silently.

# SPECS / DOCS TO ADJUST (required, part of acceptance)

- docs-internal/plan/high-level-plan.md — per-node depth "remembered per document" (:9), view cascade / centralDepths rule / pin-on-toggle / reset-to-global (:41, :68, :71-74), storage choice + orphan sweep (:79-82), Phase 3 summary (:128)
- README.md — Depth tail (:117-124), Pinning (:126-143, esp. the centralDepths rule :134-137 and restart-lag caveat :139-143), :162, :311, :314
- docs-internal/architecture-map.md:24-27 persistence-layer description
- docs-internal/notes/settings.md — chain table/diagram already updated to include this step; keep the "absent override means inherit" standing decision but scope it to descriptor semantics (per-doc override layer no longer exists)
- docs-internal/plan/steps/step-03-adapters-and-persistence.md and step-06-controls.md — mark per-doc sections superseded by this ticket (do not rewrite history; add a superseded banner)

# E2E IMPACT

- e2e/pinnedCentralScenario.e2e.ts:120 ("pinned-central depth is per-MAIN-doc") — behavior deleted; rewrite the spec around global depth + global pins
- e2e/controlsRestart.e2e.ts:126 — depth/pin/cap/sizing still survive restart, now via globals only
- e2e/obsidianHarness.ts doc-data wipe (:501-538) and e2e/vaultCopyReseed.test.ts become removable

# TICKETS THIS SUBSUMES / OBSOLETES (close them when this lands, with a pointer here)

- docs-internal/tickets/ticket-per-doc-write-leaves-sibling-views-stale.md — per-doc writes no longer exist
- nid_7fq9y51mbucmduzf9z31hmwmq_e (doc-data dir-name constant) — the dir itself is deleted
- Re-verify docs-internal/tickets/ticket-pinned-central-status-lags-after-restart.md — pins stay global, so the lag may remain; adjust rather than close if still reproducible

Respect BDD conventions; behavior-capturing tests for the deleted subsystem are removed WITH this ticket (explicitly aligned by the owner decision above) — do not remove any test that pins surviving behavior (global pins, global settings round-trip, sweep pruning stale pins).

## Acceptance Criteria

GIVEN the plugin after this ticket
WHEN any setting (depth, sizing, view, exclusion) is changed from either surface
THEN it persists globally in data.json only, applies to MAIN and all pinned centrals, no doc-data/ file is ever written, npm test and npm run check are green, and the listed specs/docs and e2e specs describe the global-only model.

## Notes

**2026-07-30T00:02:20Z**

RESOLVED 2026-07-29 — global-only settings landed (branch CC_nid_ez38gf1mrdgh5kxedzrdicwzl_e__settings-simplification-remove-per-doc-saved-state_opus).

WHAT LANDED
- All per-doc saved graph state deleted: doc-data store (DocDataStore/DocDataMutations/FakeFileStorage), DocData shape + parseDocData, PersistenceServices.setDoc*/setCentralDepthField, per-central depth merge and steppers, CentralDepthRoundTrip test.
- The 'per-doc' write scope is gone entirely; ControlsActions.applySettings unconditionally fans out via refreshAllViews(). NOT_PERSISTABLE notice and mainFile() removed.
- Engine plumbing that only served per-doc removed: depthOverridesByRoot, TraversalSettingsResolver override arg. Three deviations beyond the ticket's literal wording, each reviewed and accepted as justified: TraversalSettingsResolver, ViewSettingsResolver, resolvePinnedDescriptors.ts and settingsWriteScope.ts (+ OwningViewPort) were DELETED rather than reduced to identity/constant.
- Panel depth now edits the ONE global depth (src/view/GlobalDepthControls.tsx replaces CentralDepthControls.tsx); 'Pinned centrals (n)' disclosure removed.
- Pins unchanged and global (data.json pins, pinDoc/unpinDoc, hover-pin UI, PathDocIdMap, DocPersistEligibility). OrphanSweeper slimmed: still prunes stale pins; docDataFilesRemoved/centralEntriesRemoved/ownersRewritten and collectCentralDocidsByOwner dropped.
- Stored-data break handled per standing convention: stale doc-data/ dirs are simply IGNORED (no delete-on-load code); RELEASE_CHECKLIST section 7 records the discard plus the GLOBAL-depth UX shift. Never silent.
- Docs updated to the global-only model: high-level-plan, README (Settings model rewritten, per-note section deleted, Pinning + restart caveat corrected), architecture-map, CLAUDE.md persistence bullet, notes/settings.md, superseded banners on step-03/step-06.
- e2e: pinnedCentralScenario rewritten around global depth + global pins (two non-vacuous BDD specs); controlsRestart verified already global-only; PINNED_CENTRALS_SUMMARY* and doc-data harness residue removed; the reset-copy expectation is now DERIVED from src/view/settingsResetPlan.ts instead of re-typed.

OWNER DECISIONS TAKEN DURING THE WORK
1. The chain's ratified completeness bar (formerly phrased around the now-deleted ViewSettingsResolver.resolve()) is RESTATED in docs-internal/notes/settings.md as compile-forced by the descriptor model (ParsedViewFields + Exclude<keyof ViewSettings, ...> in SettingsSpec/settingsSectionFields). Chain steps 4/5/6 inherit the reworded bar.
2. Depth copy: both surfaces are headed 'Depth (all notes)' (panel disclosure + settings-tab card), so the global scope is visible where the dial is. Restore-row copy 'Restore depth defaults' deliberately unchanged.

GATES: npm test 82 files / 1083 tests pass, npm run check exit 0 — both independently re-verified by the reviewer. npm run test:e2e NOT run (needs real Obsidian); the e2e string/locator edits are source-verified only and remain a release gate.

BOOKKEEPING: closed docs-internal/tickets/ticket-per-doc-write-leaves-sibling-views-stale.md and nid_7fq9y51mbucmduzf9z31hmwmq_e. ticket-pinned-central-status-lags-after-restart.md stays OPEN — re-verified still reproducible (PathDocIdMap warms only via the 15s sweep). ticket-controls-optimistic-input-latency.md and ticket-step-06-controls-human-smoke-run.md were repointed/re-scoped in place and stay OPEN.
