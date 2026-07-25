# TOP_LEVEL_AGENT — settings-spec-baseline-exhaustive

Ticket: `nid_abreq4lmpo8vnvf61y9k9yly0_e` — SettingsSpec 'exact shipped baseline' toEqual silently omits `outlineMaxDepth`.

Branch: `settings-spec-baseline-exhaustive` (off `main`).

## Acceptance criteria (from ticket)
1. `outlineMaxDepth` on both sides of the baseline `toEqual`.
2. Test can no longer silently omit a field — project EVERY key of `SETTINGS_SPEC.globalView`, or add a compile-time exhaustiveness guard, so a new spec entry with no baseline value fails.
- Do NOT weaken existing assertions.
- Do NOT fix the known-RED `linkStrengthFactor.max` baseline (tracked separately).

## Flow (straightforward-flow)
- [x] EXPLORATION (Explore agent) → EXPLORATION_PUBLIC.md
- [x] IMPLEMENTATION_WITH_SELF_PLAN → `74671aa`
- [x] IMPLEMENTATION_REVIEW → READY, 0 blocking, 2 should-fix (`0ee0aa4`)
- [x] IMPLEMENTATION_ITERATION 1 → both accepted (`1e22168`); re-review CONVERGED (`e2c07cb`)
- [x] change_log entry + ticket close + merge to main

## Outcome — CONVERGED at iteration 1 (of max 4)

Both acceptance criteria met. Only `src/engine/SettingsSpec.test.ts` changed (+79/-15);
no production code touched. `npm test` 922 passed / 0 failed, `npm run check` clean —
verified independently by implementer and reviewer.

Mechanism: `EverySpecField<TSpec>` (defaults) + `SpecLimitsBaseline<TSpec>` (limits,
derives each field's required bound keys) applied via `satisfies`. Adding, removing, or
under-pinning a spec key is now a `npm run check` error naming the key.

### Notable calls
- Reviewer's first-round suggested type would have forced deleting the `max`/`step` pins
  the ticket had just added (`satisfies` does excess-property checking). Implementer
  diverged with rationale; reviewer confirmed the divergence was correct on re-review.
- Scope extended beyond the ticket's literal ask to the **limits** baseline and nested
  `sizing`/`depthStepper` literals — same structural gap, same ticket intent.
- Accepted limitation: `SpecLimitsBaseline` sees only DIRECT bound keys, so composite
  sections (`sizing`, `nodeExclusion`) map to `{}` and nested bound drift stays invisible.
  Closing only `nodeExclusion` would be false symmetry.

### Out of scope, handled
- `linkStrengthFactor.max` untouched. It is **not** currently RED (contrary to the ticket) —
  `main` re-pinned it to `4` in `258ec5a`. Annotated the stale ticket file, left OPEN: its
  step 1 (human confirmation that `4` is the intended limit) never happened.
- Follow-up filed: `nid_2yygojiqkdi9hp73pgv0w7qfu_e` — `linkStrengthFactor` JSDoc says
  `[0.25, 2]` while the spec ships `max: 4`.

## Log
- Created branch, spawned Explore agent.
- IMPLEMENTATION → REVIEW → ITERATION 1 → converged. Ticket closed, change log written.
