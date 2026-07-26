# IMPLEMENTATION (self-plan) — sizing non-finite clamp

Ticket `nid_8vmo5ibhv1bvh2ukrgmafpofj_e`. Branch `sizing-nonfinite-clamp`, one commit: `4822bf7`.
**`npm run check`: PASS (exit 0). `npm test`: PASS — 71 files, 956 tests, 0 failures.**

## What changed and why

The defect had two halves: a `depthDecayK = -1` divides `1 / (1 + k * minDepth)` by zero at depth 1
(`Infinity` → `sizePx` → `FlowNode.width/height`), and `1e999` parses to `Infinity`, which passes a
`NaN`-only input guard. Fixed at the SETTINGS BOUNDARY per the ticket's decided design, mirroring the
`clampForceLayoutSettings` precedent (bounds in `SettingsSpec.ts`, clamp in `constants.ts`).

1. **`src/engine/SettingsSpec.ts`** — `depthDecayK` / `minPx` / `maxPx` promoted from bare
   `DefaultSpec<number>` to `BoundedNumberSpec`, each with a WHY-bounded comment like the
   force-layout fields. Added **`metricWeight: BoundedNumberSpec`**: the per-metric weight input has
   the identical `Infinity` hole and an unbounded weight makes `composeScore`'s
   `weightedSum / totalWeight` `Infinity/Infinity` = `NaN` — the same defect class in the same
   settings object, so leaving it out would have made `clampSizingSettings` a lie.
2. **`src/engine/constants.ts`** — `SIZING_RANGES` + `clampSizingSettings`, built from the spec by a
   shared `rangesOf` projection. Both clamps now share one `clampIntoRange(value, range, fallback)`.
3. **`src/engine/NodeSizer.ts`** — `computeSizes` clamps its incoming settings with that same table
   (see "judgement calls"), and `DepthDecayMetric` degrades a non-finite `1/(1+k*d)` to
   `NEUTRAL_NORMALIZED_VALUE` — the convention `MinMaxNormalizedMetric` already uses for
   "this metric cannot discriminate".
4. **`src/persistence/persistedShapes.ts`** — `parseSizing` wraps its return in `clampSizingSettings`,
   exactly parallel to `parseForceLayout`. (Note `numberOrUndefined` already dropped non-finite values;
   the clamp is what stops a **finite** `-1`.)
5. **`src/view/settingsWritePlan.ts`** — the `global-sizing` case clamps. This is the ONE choke point
   both sizing surfaces (React panel + settings tab) write through, so the live-session write path is
   covered without duplicating the clamp in two components.
6. **UI surfaces** (`SizingSection.tsx`, `VicinityGraphSettingTab.ts`) — inputs now take min/max/step
   from `SIZING_RANGES` instead of hardcoded literals, and accept only `Number.isFinite` input.
7. **`src/view/edgeRouting.ts`** — `hasFiniteGeometry` UNCHANGED (defense in depth at the wasm
   boundary); only its now-stale "`depthDecayK` has no engine-side clamp" sentence was corrected.

## Bounds chosen (rationale)

| Field | Range | Why |
|---|---|---|
| `depthDecayK` | `[0, 10]` step 0.5 | `min 0` is a CORRECTNESS bound: the denominator vanishes at `k = -1/depth`, and `k >= 0` keeps it `>= 1` at every depth. `k = 0` = decay off. At `k = 10` a depth-1 node is already 1/11 of the central — steeper is indistinguishable. |
| `minPx`, `maxPx` | `[1, 400]` step 4 | `min 1` is the floor both inputs already shipped with (a 0/negative box is not geometry). `max 400` = 2.5x the 160 default; one node past that fills a typical vicinity pane. |
| `metricWeight` | `[0, 100]` step 0.5 | Only weight RATIOS matter (the average divides by the total), so the range only spans "muted" to "dominant": at 100 a metric already outvotes an equal peer 100:1. |

**Clamping is a no-op for every shipped default** (1 / 40 / 160 / 1) and every in-range value — pinned
by `clampSizingSettings(defaults) === defaults` and by the untouched, still-green `SETTINGS_SPEC`
baseline tests. No behavior-capturing test was weakened or removed.

## Test coverage added

- **`src/engine/sizingSettings.test.ts`** (new, mirrors `forceLayoutSettings.test.ts`): defaults pass
  through unchanged; over/under-shooting every field; `NaN` → default; `Infinity` → range max;
  `enabled` flags survive; the `min >= 0` / `min > 0` singularity invariants.
- **`src/engine/NodeSizer.test.ts`**: new `NodeSizer hostile sizing settings` describe — `sizePx` is
  finite for `k` ∈ {-1, Infinity, NaN}, for non-finite `minPx`/`maxPx`, and for an `Infinity` weight.
- **`src/persistence/persistedShapes.test.ts`**: out-of-range persisted sizing (incl. the FINITE `-1`)
  and an out-of-range metric weight are clamped on load.
- **`src/view/settingsWritePlan.test.ts`**: a `global-sizing` write carrying `-1` / `Infinity` is
  clamped in the planned command.
- **`src/engine/SettingsSpec.test.ts`**: baselines extended for `metricWeight` and for the sizing
  limits (its `EverySpecField` compile-time guard forced this — working as designed); new
  `SIZING_RANGES` projection test.

### Honest notes on test strength (mutation-verified, not assumed)

- Removing the `computeSizes` clamp → the `minPx`/`maxPx`/weight tests go RED, the `k` tests stay
  green (the `DepthDecayMetric` guard catches those). Removing only the `DepthDecayMetric` guard →
  everything stays green (the clamp covers `k`). So each guard is independently sufficient for `k`,
  and the clamp is uniquely necessary for px/weight. The `DepthDecayMetric` guard is therefore
  genuinely redundant through the public entry point today — kept because the ticket asks for it and
  the class is constructible with any `k`.
- The `k = Infinity` case passed even BEFORE the fix: `minDepth === 0` implies `isCentral`
  (`VicinityTraversal` sets `isCentral = rootPaths.has(path)`), and centrals bypass metric
  composition — so the `Infinity * 0 = NaN` value the ticket describes is computed inside the metric
  but discarded downstream. The test is kept as a regression guard on that coupling. The other 15
  new/changed assertions were verified RED before the fix.

## Judgement calls a reviewer should check

1. **`NodeSizer.computeSizes` clamps its own input.** The ticket said clamp at the boundary "rather
   than defensively patching `NodeSizer`", but its acceptance criterion demands finite `sizePx` for
   non-finite `minPx`/`maxPx`, which is only achievable inside the sizer. It applies the SAME
   single-source table rather than a bespoke guard, so the two cannot drift.
2. **`clampIntoRange` treats `Infinity` and `NaN` differently** — `±Infinity` carries an intent ("as
   large as possible") that `Math.min`/`Math.max` resolve to the finite bound; `NaN` carries none and
   falls back to the spec default. This also **hardens `clampForceLayoutSettings` against `NaN`**,
   which the bare min/max pattern silently propagated. Unobservable in production today, but the
   shared helper would otherwise be dishonest.
3. **`ForceLayoutRange` renamed to `SettingsRange`** (clean break, no alias — 2 usages). Sizing needs
   the identical `{min,max,step}` shape and duplicating it would duplicate knowledge.
4. **Write-path clamping is stricter than the force-layout precedent** (which clamps on load only).
   Intentional and ticket-mandated. Consequence: an out-of-range keystroke is now clamped and the
   controlled field snaps to the bound (previously such a value was silently dropped by the settings
   tab and accepted by the React panel) — a wart inherent to per-keystroke controlled writes, not
   made worse in kind.

## Deliberately out of scope

- `hasFiniteGeometry` in `edgeRouting.ts` stays (only its comment was corrected).
- Force-layout's missing UI-write-path clamp: its UI is `<input type=range>` sliders, which clamp
  natively, and the load path already clamps — the gap is theoretical, so no ticket was filed.
- The ticket was NOT closed and no `change_log` entry was written (TOP_LEVEL_AGENT's job). Not merged
  to main.
