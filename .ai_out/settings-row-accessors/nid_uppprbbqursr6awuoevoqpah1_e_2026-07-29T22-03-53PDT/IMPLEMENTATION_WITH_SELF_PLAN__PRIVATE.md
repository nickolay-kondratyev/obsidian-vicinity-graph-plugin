# Settings row accessors — PRIVATE memory

Branch `nid_uppprbbqursr6awuoevoqpah1_e_2026-07-29T22-03-53PDT`. Ticket
`nid_uppprbbqursr6awuoevoqpah1_e`. **DONE and committed.** No blockers, no open questions.

## Recon notes (so a clone need not re-read)

- `src/view/settingsRows.ts` — pure data: `SETTINGS_GROUPS` (Record over
  `SettingsSection`), `SettingsRowControl` union (9 kinds), `unhandledRowControl`,
  `isSettingsRowDisabled`, `SettingsRowNames`, `EVERY_SETTINGS_ROW`, `settingsRowsFor`.
  `SettingsRowState = SettingsWriteContext` = `{globalDepths, globalView, nodeExclusion}`.
- `src/view/settingsWritePlan.ts` — `SettingsInteraction` (10 arms), `planSettingsWrite`
  → `SettingsCommand` (`global-depths` | `global-view` | `node-exclusion`). Sizing is
  clamped there via `clampSizingSettings`; force-layout and nodeCap are NOT clamped on write.
- Engine bounds: `SETTINGS_SPEC` (SettingsSpec.ts) is the single source; `constants.ts`
  projects `FORCE_LAYOUT_RANGES`, `SIZING_RANGES`, `MIN_NODE_CAP`, `MIN/MAX_OUTLINE_DEPTH`,
  `MIN/MAX_STEPPER_DEPTH`, `clampOutlineMaxDepth`, `clampSizingNumber`.
  `nodeCap` is a `MinBoundedNumberSpec` (min only, NO step, NO max) — that is why
  `SettingsRowBounds.max` is optional and `NODE_CAP_STEP` has no engine home.
- e2e: only `e2e/settingsBaseline.ts` imports `../src/view/settingsRows` (SETTINGS_GROUPS)
  and `settingsSectionFields`. Nothing imports the write plan or the engine ranges.
- `useOptimisticValue(stored, commit, settlesAt = identity)` — passing an identity
  `settlesAt` is behaviourally identical to omitting it. That is what made it safe to put
  `settlesAt` on EVERY numeric accessor.

## Plan as executed

1. New `src/view/settingsRowAccessors.ts` (sibling — see PUBLIC for the rationale).
2. Panel rewritten around a `useSettingsValue(accessor, state, settlesAt?)` hook;
   `SliderRow`/`NumberRow` take `{row, accessor, state}`.
3. Tab: `addSlider(container, row, accessor, state)` replaces three builders;
   `applyRange(SettingsRange)` → `applyBounds(SettingsRowBounds)` (skips `max` when absent,
   preserving the node cap's min-only input).
4. `DepthStepper` takes `bounds`.
5. New accessor suite + one added parity guard.
6. `npm test` + `npm run check`, then commit.

## Decisions and their reasons

- **Sibling module, not `settingsRows.ts`** — SRP + keep e2e's import graph free of the
  engine range/clamp runtime. Both stated in the module doc and in PUBLIC.
- **`interaction()` emits `settlesAt(value)`** — one clamp, applied once, both surfaces.
  Verified no user-visible change: depth was already clamped by the tab and pre-clamped by
  the stepper; outline is a range input; sizing is re-clamped identically by the pipeline;
  force-layout and nodeCap use identity.
- **`accept` only on `SettingsTypedNumberAccessor`** (sizing numbers, metric weight, node
  cap) rather than on every numeric accessor — sliders have no typed entry, and a
  present-but-unused `accept` would misdescribe them.
- **`SizingRowWrite` left alone** — it is the sizing row's write POLICY (cross-field rule,
  `capNotice` reasoning that compares typed vs clamped), not a presenter. Routing its
  interaction through the accessor would clamp before `capNotice` reasons about the clamp.
  Third home for `{kind:"global-sizing-number"}` accepted knowingly; noted in PUBLIC.
- **Parity guard extended rather than replaced** — the accessor makes the VALUE half
  structurally shared, so the source scan now also asserts the presenters name none of the
  `ACCESSOR_OWNED_SYMBOLS`. Chose symbol names over `state.` patterns because the tab
  legitimately still spreads `state` to build a hypothetical `disabledWhen` verdict in
  `addExclusionToggle`.

## Test-suite design (settingsRowAccessors.test.ts)

Type erasure trick: `roundTripOf<T>(accessor, requested, settlesAt, state)` is the only
place `T` is known; it returns a plain `RoundTrip {previous, promised, stored}` so the
suite can hold a heterogeneous `AccessorProbe[]`. `applied()` folds a `SettingsCommand`
back into `SettingsRowState`. Comparison is via `JSON.stringify` so `readonly string[]`
compares structurally in the collected-failures style the repo uses.

Probe values: in-bounds probe = `bounds.min` (or `min + step` when current === min);
out-of-bounds probe = `(max ?? min) + step * 1000` (step-scaled so a 0–0.15 knob is probed
as hard as a 1–1000 one). Booleans flip; preview picks another option; patterns use
`["^probe/"]`.

**Mutation-verified**: pointing `sizingNumber.read` at `maxPx` fails 3 of the 9 tests
(later 10 after the non-vacuity split). The backup used for that check was `.tmp/acc.bak`
(disposable).

## Verification actually run

- `npm test` → 93 files / 1227 tests passing, exit 0 (baseline was 92 / 1217).
- `npm run check` → exit 0.
- e2e NOT run (real Obsidian required). e2e surfaces that could care: `settingsBaseline.ts`
  (unchanged imports), `settingsUxVisual.e2e.ts` (a11y names unchanged),
  `settingsDependentRows.e2e.ts` (`disabledWhen` untouched).

## Not done on purpose

- Did not touch `change_log` or close the ticket (top-level agent owns both).
- Did not add a `DEPTH_RANGES` / `OUTLINE_DEPTH_RANGE` table to `src/engine/constants.ts`;
  the accessor reads the spec leaves directly. Would be the natural next step only if a
  third surface needs those bounds.
