# Settings row accessors — PRIVATE memory

Branch `nid_uppprbbqursr6awuoevoqpah1_e_2026-07-29T22-03-53PDT`. Ticket
`nid_uppprbbqursr6awuoevoqpah1_e`. **DONE and committed, through review iteration 1.** No blockers, no open questions.

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
- **`SizingRowWrite` left alone** — REVERSED in iteration 1: `capNotice` takes the typed
  value as its own parameter, so clamping the RETURN could not disturb it. It now calls
  `SettingsRowAccessors.sizingNumber(field).interaction(value)` directly (not constructor
  injection: a static factory over declared data is not a seam needing inversion, and DI
  would have churned every test's construction for nothing testable).
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

---

# Iteration 1 (review response) — detailed memory

Review read: `IMPLEMENTATION_REVIEW__PUBLIC.md` (verdict READY, 3 IMPORTANT + 4
suggestions, no CRITICAL). Reviewer independently re-verified behavior preservation and
the guards. **All six technical findings ACCEPTED**; #7 (ticket/change_log) is the
coordinator's. Full ACCEPTED/REJECTED reasoning is in PUBLIC.md's "Iteration 1 response".

## The one real defect (#1) and how the fix is shaped

`depth(field).bounds` came from `SETTINGS_SPEC.globalDepths[field]` while `settlesAt` was
`clampStepperDepth`, hard-wired to `linkDepthOut`. `planSettingsWrite` stores `global-depth`
VERBATIM ⇒ that clamp is the only one ⇒ divergent bounds would silently take back a value
the control offered.

Shape of the fix (remember this if it is ever revisited):
- `clampDepthInto(bounds, value)` is PRIVATE to `settingsRowAccessors.ts`. Not exported,
  not generic: rounding is depth-specific (whole hops), and sizing/outline already have
  their own engine clamps. Do NOT generalise it into a shared `clampIntoBounds` — the
  engine's `clampIntoRange` already exists and resolves NaN to a default, which the depth
  leaves deliberately do NOT do (they are in `BOUNDS_ENFORCED_OUTSIDE_THE_ENGINE`).
- `clampStepperDepth` DELETED from `src/view/constants.ts`; the view re-export of
  `MIN/MAX_STEPPER_DEPTH` went with it (zero remaining view users). Both still live in
  `src/engine/constants.ts` and are still pinned to the spec by `SettingsSpec.test.ts`.
- `clampStepperDepth.test.ts` → `settingsRowDepthClamp.test.ts` via `git mv`, six
  assertions preserved verbatim. This is a RENAME + RETARGET, never a removal — say so if
  anyone asks whether a behavior-capturing test was dropped.
- Prose-only edits: `optimisticValue.test.ts` stepper simulation, and the
  `BOUNDS_ENFORCED_OUTSIDE_THE_ENGINE` reason strings in `engine/settingsSpecBounds.test.ts`
  (checked first: those strings are values in an allowlist, not scanned by any assertion).

## Why "track" and not "slider" (#3)

`SettingsTrackAccessor` (bounds `max` required) covers sliders AND the panel's depth
stepper — both must place a value on a bounded track. `SettingsRowClosedBounds` is the
bounds shape. Reachability judged honestly: the divergent fallback was LATENT (no max-less
field is slider-backed today), but requiring `max` is strictly simpler than two silent
fallbacks, so it was still taken.

## Mutation checks actually run this iteration

| mutation | expected | observed |
|---|---|---|
| `clampDepthInto` uses `bounds.max - 1` | depth-clamp guard fails | 3 failures, one per depth field ("offers 5, clamp moves it to 4") |
| `forceLayout.settlesAt` returns `max + 1` | "inside bounds or verbatim" fails | 6 failures |
| `addSlider(… nodeCap())` | compile error | `TS2345: 'SettingsTypedNumberAccessor' is not assignable to 'SettingsTrackAccessor'` |

(Backups used: `.tmp/acc.bak`, `.tmp/tab.bak` — disposable, restored each time.)

## Test-suite additions

- `settingsRowAccessors.test.ts`: `NumberProbeFacts` + `EVERY_NUMBER_PROBE` + shared
  `beyondBounds(bounds)`. New assertion "settles inside its bounds, or verbatim — no third
  answer" plus a non-vacuity test requiring BOTH lawful arms to be exercised by shipped
  accessors (so the pair cannot degenerate to all-identity). Docblock now states which
  accessors the older assertion is tautological for — that honesty was finding #2.
- `settingsRowDepthClamp.test.ts` second describe: every declared depth row's track
  endpoints must survive its own clamp.
- `settingsRowParity.test.ts`: `ROW_CONTROL_COMPONENTS = {"depth stepper": "DepthStepper.tsx"}`
  folded into `EVERY_ROW_RENDERING_MODULE`; the `ACCESSOR_OWNED_SYMBOLS` scan now iterates
  that set instead of `PRESENTERS` (only possible once #1 removed DepthStepper's legitimate
  clamp use). Existing assertion `EVERY_ROW_RENDERING_MODULE.length > PRESENTERS.length`
  still holds (4 > 2).

## Rejected sub-suggestions (with reasons)

- Reviewer's #2 option (b), round-tripping a planned command through the persistence
  parser: pulls persistence into a view suite to assert a LOAD-path property that
  `settingsSpecBounds.test.ts` already owns per bounded leaf.
- Reviewer's #4 constructor-injection form: static factory over declared data is not a
  seam; DI adds a constructor param and churns every `new SizingRowWrite(...)` in its tests
  to buy nothing testable. Direct call chosen.

## Verification (iteration 1, real numbers)

- `npm test` → 93 files / **1230** tests, exit 0 (was 1227). The three settings suites
  touched here total 25 tests (measured): `settingsRowAccessors` 10,
  `settingsRowDepthClamp` 8 (6 preserved verbatim + 2 new), `settingsRowParity` 7.
- `npm run check` → exit 0.
- e2e still NOT run (real Obsidian required).

## Docs done this iteration

- `CLAUDE.md`: new "Settings values" bullet after "Settings rows".
- `docs-internal/architecture-map.md`: `view/settingsRowAccessors.ts` entry under
  `view/settingsRows.ts`, with its three guards named.

## Still not mine

`change_log` entry and ticket close-out — coordinator's, twice-stated. No follow-up
tickets needed: all six findings are fixed, none deferred.
