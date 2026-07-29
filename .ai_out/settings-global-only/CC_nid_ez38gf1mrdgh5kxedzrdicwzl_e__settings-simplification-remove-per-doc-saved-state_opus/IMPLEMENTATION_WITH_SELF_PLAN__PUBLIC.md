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
| `6c6c7f9` | ITERATION_PHASE_1: review findings (B1 + S1/S2/S4) |

## ITERATION_PHASE_1 — review disposition (commit `6c6c7f9`)

Gates re-run after the edits: **`npm test` exit 0 — 82 files / 1083 tests passed**
(`.tmp/iter1-test.log`; 1083 not 1085 because S1 deleted two `currentMainPath` tests) and
**`npm run check` exit 0** (`.tmp/iter1-check.log`, both `src/` and `e2e/` projects).

| finding | disposition |
|---|---|
| **B1** stale reset copy in `e2e/settingsResetVerify.e2e.ts:128` | **FIXED at the root.** The code string is the CORRECT one for the global-only model (there are no per-note overrides left to keep), so the e2e expectation was the wrong side. Rather than re-typing the new sentence, `e2e/settingsBaseline.ts` now exports `ALL_SETTINGS_RESET_DESCRIPTION` = `SETTINGS_RESET_SCOPES.all.description`, and the spec asserts the WHOLE derived description is on screen — strictly stronger than the old hand-copied fragment, and drift-proof. Not vacuous: it fails if the row renders different or truncated copy. WHAT the copy must say stays pinned literally by `src/view/settingsResetPlan.test.ts:283` ("states that pinned notes are kept"), which is the intended division of labour (`settingsBaseline.ts` header: names derived, literal second opinion lives in the unit tests). |
| **S1** dead `GraphViewController.currentMainPath()` | **FIXED — deleted**, along with its two self-serving tests (`GraphViewController.test.ts`). Private `this.mainPath` still drives `handleActiveFileChanged` / `runRebuild`. No other reference in `src/` or `e2e/` (the `currentMainPath` hits that remain are `RebuildDecision.ts`'s parameter name). |
| **S2** vacuous ported engine assertion | **FIXED.** `VicinityEngine.test.ts` "WHEN MAIN changes …" now asserts the concrete `[{ rootPath: "x.md", direction: "outgoing", depth: 3 }]` for the `z.md` build, with a WHY comment naming the silent-fallback it replaces. The `y.md` side is already pinned by the test above it, so the pair still says "MAIN changed, reach identical". |
| **S3** missing PHASE 2 handoff items | **FIXED** — see the extended list below (items 3–5 are new). |
| **S4** `unpinDoc` lost its WHY | **FIXED.** New doc comment states the surviving fact: unpin lands unconditionally and returns no verdict (unlike `pinDoc`, which must classify first), which is why `ControlsActions.unpinNode` has no refusal to gate on. |
| **Suggestion 1** make the panel's Depth disclosure summary honest ("Depth (all notes)" / hint) | **REJECTED for PHASE 1 — handed to PHASE 2** (handoff item 6). Rationale: it is a user-facing COPY decision (the owner may want different wording, and the release note has to match), and it is not the one-liner it looks like — the summary text is pinned by an anchored-regex identity+order assertion via `e2e/settingsBaseline.ts:118` plus locators in `controlsRestart.e2e.ts`, so it drags e2e edits I cannot run into a phase whose brief is "no scope expansion". The honesty gap is real; it belongs with the release-note sentence, in the same phase, judged by the owner. |
| **Suggestion 2** `.vicinity-graph-depth-controls` card chrome may be redundant nesting | **REJECTED for PHASE 1 — handed to PHASE 2** (handoff item 7). The reviewer himself scopes it "visual call, defer to PHASE 2 QA": nothing verifiable under `npm test`, and changing padding/background without eyes on a real Obsidian panel is guesswork. |

No finding was silently dropped.

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

### Extended handoff list (ITERATION_PHASE_1 additions, from review S3 + the two suggestions)

1. ~~`e2e/settingsResetVerify.e2e.ts:128`~~ — **done in PHASE 1** (B1 above), no longer PHASE 2 work.
2. Docs list above (README / high-level-plan / architecture-map / RELEASE_CHECKLIST / step docs / tickets) — unchanged.
3. **`docs-internal/notes/settings.md:34-36, 68, 76`** — these name `ViewSettingsResolver.resolve()` as the
   ViewSettings completeness guard AND as the chain's RATIFIED standing constraint ("do not weaken
   `ViewSettingsResolver.resolve()`'s return-type completeness", `:73-78`). That class no longer exists.
   PHASE 2 must restate the constraint over what carries it now: `ParsedViewFields`
   (`src/persistence/persistedShapes.ts:135`) plus the `NON_DEFAULT_VIEW` round-trip +
   fixture-differs-from-default pair (`persistedShapes.test.ts:257-277`). Also `settings.md:151-154`
   ("absent override means inherit") should be scoped to PARSE semantics.
   **BLOCKED ON THE HUMAN**: the reviewer's `#QUESTION_FOR_HUMAN` asking whether that restatement is
   accepted is open, so PHASE 1 deliberately left every standing-decision string in that file untouched.
   Tickets 4/5/6 inherit the wording — do not rewrite it before the answer lands.
4. **Stale `doc-data/` comments in the e2e harness plumbing**: `e2e/vaultTarget.ts:90, 120, 129` and
   `e2e/obsidianHarness.ts:495, 665` (comment-only; the code paths are already global-only).
5. `e2e/settingsBaseline.ts:140-154` (`PINNED_CENTRALS_SUMMARY*`) + `e2e/settingsUxVisual.e2e.ts:94, 134-142`
   — already listed above; repeated here as the same sweep as item 4.
6. **UX honesty of the panel's Depth disclosure** (review Suggestion 1, rejected for PHASE 1): the summary
   still reads "Depth" while a bump there changes EVERY note's graph and fans out to every open view.
   Consider "Depth (all notes)" or a one-line hint, decided together with the release-note sentence.
   Touches `src/view/GraphToolbar.tsx:37`, `e2e/settingsBaseline.ts:118` (anchored identity+order
   assertion) and the depth locators in `e2e/controlsRestart.e2e.ts`.
7. **`src/view/graph-view.css:499`** (review Suggestion 2): `.vicinity-graph-depth-controls` inherited the
   old per-central row's card background + padding + `flex-direction: column`; with exactly one such block
   inside a disclosure the card chrome may be redundant nesting. Visual call — needs real-Obsidian QA.

## Callouts
- **Behaviour change beyond persistence**: the panel's Depth steppers now write the GLOBAL depth, so
  a bump there changes every note's graph and fans out to every open view. That is the owner's
  decision, but it is a real UX shift from "this note's depth" — worth one sentence in the release
  note.
- `e2e/pinnedCentralScenario.e2e.ts` and `controlsRestart.e2e.ts` were adjusted but NOT run (real
  Obsidian required; `npm run test:e2e` is the release gate and was out of scope for this phase).
- `main.js` / `styles.css` are build artifacts and remain untracked/uncommitted.
