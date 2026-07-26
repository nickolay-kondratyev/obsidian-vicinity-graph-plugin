# PRIVATE — sizing non-finite clamp (ticket nid_8vmo5ibhv1bvh2ukrgmafpofj_e)

Branch `sizing-nonfinite-clamp`. Primary input: `EXPLORATION_PUBLIC.md` (same dir) — accurate, trust it.

## Plan (self-made)

**Goal**: no non-finite / degenerate value can reach `NodeSize.sizePx`; sizing settings are bounded
in `SETTINGS_SPEC` and clamped on BOTH the persistence-load path and the UI-write path.

**Steps**
1. Failing tests first: `src/engine/sizingSettings.test.ts` (new, mirrors `forceLayoutSettings.test.ts`),
   `NodeSizer.test.ts` hostile-settings describe, `persistedShapes.test.ts` sizing clamp,
   `settingsWritePlan.test.ts` global-sizing clamp.
2. `SettingsSpec.ts`: `depthDecayK`/`minPx`/`maxPx` → `BoundedNumberSpec`; add `metricWeight: BoundedNumberSpec`
   (the per-metric weight input has the SAME Infinity hole and weight feeds `composeScore`'s divisor).
3. `constants.ts`: `SIZING_RANGES` + `clampSizingSettings`; shared `clampIntoRange(value, range, fallback)`
   helper that ALSO rejects non-finite (Math.min/Math.max do not filter NaN) — reused by
   `clampForceLayoutSettings`.
4. `NodeSizer.computeSizes` clamps its incoming settings with the same `clampSizingSettings`
   (makes the engine total — required by the ticket's acceptance criterion "sizePx finite for
   non-finite minPx/maxPx"); `DepthDecayMetric` keeps a self-contained finite guard.
5. `persistedShapes.parseSizing` wraps its return in `clampSizingSettings` (mirrors `parseForceLayout`).
6. `settingsWritePlan` `global-sizing` case clamps — ONE choke point for both UI surfaces
   (React panel + settings tab). Stricter than the forceLayout precedent, intentional per ticket.
7. UI inputs read min/max/step from `SIZING_RANGES` instead of hardcoded literals.

**Bounds chosen** (see PUBLIC for rationale): depthDecayK `[0, 10] step .5`; minPx/maxPx `[1, 400] step 4`;
metric weight `[0, 100] step .5`. All shipped defaults (1 / 40 / 160 / 1) sit inside → clamp is a no-op.

## Decisions / notes

- `ForceLayoutRange` renamed → `SettingsRange` (only 2 usages: `constants.ts`, `index.ts` re-export).
  Clean break, no alias, because sizing needs the same `{min,max,step}` shape and duplicating it
  would duplicate knowledge.
- `clampIntoRange` gains a non-finite → `fallback` (spec default) branch. This also hardens
  `clampForceLayoutSettings` against NaN. Unobservable in production today (`numberOrUndefined`
  already drops non-finite on load, and forceLayout has no UI-write clamp) but the helper would
  otherwise be a lie.
- Clamping INSIDE `NodeSizer.computeSizes` is deliberate and is NOT the "defensive patch" the ticket
  warned against: it applies the SAME single-source table, and it is the only way to satisfy the
  acceptance criterion about non-finite `minPx`/`maxPx`.
- `src/view/edgeRouting.ts` `hasFiniteGeometry` stays (defense in depth); its doc comment's now-stale
  "`depthDecayK` has no engine-side clamp" sentence updated to point at the clamp.

## Dead ends / corrections made mid-flight

- First version of `clampIntoRange` sent ALL non-finite values to the spec default. Two of my own
  tests went red on it: `Infinity` (from `1e999`) means "as large as possible", so it should clamp to
  the range MAX, not reset to the default. Final rule: `NaN` → default, `±Infinity` → Math.min/max
  bound. Do not "simplify" this back to a single `!Number.isFinite` branch.
- `SettingsSpec.test.ts`'s `EverySpecField` / `SpecLimitsBaseline` compile-time guards FORCED the
  baseline updates (adding `metricWeight` and the sizing limits) — that is the guard working, not a
  test I chose to weaken. `sizing: NO_SPEC_LIMITS` became a nested `SpecLimitsBaseline<SizingSpec>`.
- Mutation results (run, not assumed): removing the `computeSizes` clamp reds the px/weight tests
  only; removing the `DepthDecayMetric` guard reds nothing. The `k = Infinity` test also passed
  pre-fix because `minDepth === 0` implies `isCentral`, which bypasses metric composition. All of
  this is disclosed in the PUBLIC file — do not quietly restate the coverage as stronger than it is.

## ITERATION 1 (review response) — commit `062be14`

All 5 SHOULD-FIX incorporated, both actionable NITs turned into follow-up ticket
`nid_hatwq2jlkhno5t6awcz0q6t9q_e`, one NIT (`MinMaxNormalizedMetric` totality) rejected as a
different trust boundary. `npm run check` exit 0; `npm test` 72 files / 966 tests, 0 failures.

- The `Number("")` regression was REAL and mine. Fix: new `src/view/sizingInput.ts`
  `parseSizingInput(raw: string): number | undefined` — the single acceptance rule for all four
  sizing inputs. React sites now pass `event.target.value` (string), NOT `valueAsNumber`, so both
  surfaces share one rule instead of two that agree by luck. Do not "simplify" a site back inline.
- `DepthDecayMetric` is now `export`ed from `NodeSizer.ts` SOLELY so its guard is directly testable;
  it is deliberately NOT in `src/engine/index.ts`. Keep it that way.
- `k = Infinity` is NOT a reachable NaN — `minDepth === 0` ⟺ `isCentral`, centrals bypass metrics.
  Recorded as a note on the ticket. The new "non-central minDepth >= 1" test asserts `[1, 2]`
  (not `.every(...)`) so it cannot pass vacuously.
- Mutation-verified this iteration (run, not assumed): removing the `DepthDecayMetric` guard →
  2 RED; removing `clampIntoRange`'s NaN branch → 3 RED including the new force-layout test.
  CAUTION learned the hard way: `git checkout <file>` to revert a mutation also throws away
  UNCOMMITTED work in that file — I lost and had to re-apply the `NodeSizer.ts` export. Commit first.

## State

DONE (iteration 1). `npm run check` exit 0; `npm test` 966/966 pass. Commits `4822bf7` + `062be14`
on `sizing-nonfinite-clamp`. Ticket NOT closed, no change_log entry, not merged (all TOP_LEVEL's job).

See `IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md` for the final result, files touched and the REAL
`npm run check` / `npm test` output. Work is committed on `sizing-nonfinite-clamp`.
