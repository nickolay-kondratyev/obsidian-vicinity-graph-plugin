# IMPLEMENTATION_REVIEWER — private notes (step-06-controls)

Review pass 1 (2026-07-20). Reviewed commits `9c51aab..3c56520` (Phases A–D) against
`step-06-controls.md`, `DETAILED_PLANNING__PUBLIC.md`, `CLARIFICATION__PUBLIC.md`.

## Gates (independently run)
- `npx vitest run`: **49 files / 499 tests passing**. Exit 0.
- `npm run check` (`tsc -noEmit`): **clean**. Exit 0.
- (Build not re-run; impl notes report esbuild OK and tsc is clean — low risk.)

## What I traced
- `planSettingsWrite`: pin-on-toggle (never inspects == global), reset carries `undefined`, whole-object
  merge for global-* — correct. Tested incl. equal-to-global + direction→field.
- `ControlsModelBuilder`: presence-based `pinned` on the OWNED layer, `value` via
  `TraversalSettingsResolver.resolveForRoot` (structural match to graph). Q-A semantics correct.
- `PinnedRootResolver`: single shared skip-rule; assembler refactored to use it; assembler output
  unchanged (pre-existing tests green). No behavior loss.
- `ControlsActions`: awaits write before `handleSettingsChanged`; `currentMainPath()` null → no-op;
  Notice on not-persistable/not-pinnable. Correct.
- `GraphViewController.handleSettingsChanged`: immediate rebuild, clears debounce, latest-wins token.
- Settings tab: reads globals fresh per edit (compose), one field merged via `planSettingsWrite`, cap
  guarded int ≥1, depth clamped 0..5, fan-out `refreshOpenViews`.
- Scenario tests (a) assembler round-trip + (b) engine re-exploration: both prove the headline behavior;
  reset field-delete covered by DocDataMutations.test.ts (step-03). No false-pass tests.
- No test files deleted / no anchor removals. No obsidian import leak into pure/controller.

## Findings (see PUBLIC file)
- No Critical, no blocking Important.
- Minor: direction→field map duplicated (settingsWritePlan.fieldOf + ControlsModel.DIRECTION_FIELD);
  `central.docid ?? ""` dead-defensive.
- Ticket: stepper rapid-click responsiveness (no optimistic local state; each increment waits a full
  build round-trip — bounded by MAX_STEPPER_DEPTH=5 so not data loss).

## Deviations — all ACCEPTED
1. Pinned centrals behind disclosure (not always-visible) — binding Q1 says exactly this; task item-10
   phrasing superseded. Correct.
2. Notice inside ControlsActions (no showNotice port) — KISS, obsidian glue file. Fine.
3. Only SIZING_METRICS extracted (spreads inline) — correct DRY judgment.

## Verdict: APPROVE-WITH-FOLLOWUPS
