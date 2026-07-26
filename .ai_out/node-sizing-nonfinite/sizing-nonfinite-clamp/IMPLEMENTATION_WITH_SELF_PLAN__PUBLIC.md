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

---

# ITERATION 1 — response to `IMPLEMENTATION_REVIEW__PUBLIC.md`

Commit `062be14` on `sizing-nonfinite-clamp`.
**`npm run check`: PASS (exit 0). `npm test`: PASS — 72 files, 966 tests, 0 failures** (was 71/956;
+1 file, +10 tests). Every number below was produced by running the command, not estimated.

## Disposition per finding

| # | Finding | Disposition |
|---|---|---|
| SHOULD-FIX 1 | `Number("") === 0` — clearing a sizing field persists a clamped `1` | **INCORPORATED** |
| SHOULD-FIX 2 | Finite-input rule duplicated at 4 sites, zero coverage | **INCORPORATED** |
| SHOULD-FIX 3 | `DepthDecayMetric` guard dead + unpinned, comment overstates reachability | **INCORPORATED** (pinned, not deleted) |
| SHOULD-FIX 4 | `k = Infinity` test vacuous; ticket premise wrong | **INCORPORATED** (reframed + ticket corrected) |
| SHOULD-FIX 5 | `clampForceLayoutSettings` NaN→default untested | **INCORPORATED** |
| NIT | `minPx <= maxPx` unenforced | **INCORPORATED as follow-up ticket** `nid_hatwq2jlkhno5t6awcz0q6t9q_e` |
| NIT | Per-keystroke clamp snaps the React field | **INCORPORATED as follow-up ticket** (same one) |
| NIT | `MinMaxNormalizedMetric` not total for a non-finite `sizeBytes` | **REJECTED** (no change) — rationale below |
| Re-examined | `metricWeight [0,100]` = scope creep? | **KEPT** — rationale below |

### 1 + 2 — the regression and the duplication, fixed together

The review is right and this was a real behavioural regression I introduced: `Number("")` is `0`,
`Number.isFinite(0)` is `true`, so select-all-delete forwarded a value the old `parsed >= min` check
had rejected. Started from the failing test (`src/view/sizingInput.test.ts`, red before the helper
existed).

New **`src/view/sizingInput.ts`** — `parseSizingInput(raw: string): number | undefined`. One rule,
one place: blank / whitespace / non-numeric / non-finite → `undefined`; anything else forwarded for
the DOWNSTREAM clamp (so a mid-typing out-of-range value is never silently dropped). All four sites
now call it — `VicinityGraphSettingTab.addSizingNumber` and its metric-weight input, and
`SizingSection`'s `SizingNumber` and weight input. The React sites switched from
`event.target.valueAsNumber` to `event.target.value`, so both surfaces genuinely share ONE rule
rather than two rules that happen to agree today.

I did NOT fold the `Node cap` input into this helper: its rule is different (integer + `>= MIN_NODE_CAP`)
and merging them would have produced a parameterised parser that is harder to read than either. Out
of scope for this ticket.

### 3 — the `DepthDecayMetric` guard: kept, and now genuinely pinned

Three options were on the table: delete it as dead code, keep it as declared-untested defence in
depth, or pin it. I chose to **pin** it, because the ticket's decided design explicitly mandates the
guard ("a `DepthDecayMetric` guard is still warranted as the last line of defence"), and a guard that
no test can kill is a guard the next refactor deletes.

`DepthDecayMetric` is now `export`ed from `NodeSizer.ts` (deliberately NOT re-exported from
`src/engine/index.ts`, so the engine's public surface is unchanged), and two tests construct it
directly with `k = -1` and `k = Infinity`. The class doc no longer implies reachability — it states
plainly that `computeSizes` clamps `k` first, so the guard is unreachable there, and that it exists
so the metric is total in its own right.

Mutation-verified: with `Number.isFinite(decayed) ? … :` removed, those two tests go RED (before this
iteration, removing it left all 956 green).

### 4 — `k = Infinity`: the ticket's premise was wrong, stated plainly

Confirmed independently. `VicinityTraversal` tags neighbours `currentDepth + 1`, so `minDepth === 0`
holds for roots only, and roots are exactly the centrals — which `computeSizes` gives
`CENTRAL_SIZE_SCORE` without composing metrics. The `Infinity * 0 = NaN` the ticket predicted is
computed and then discarded. **There was never a reachable NaN from `k` alone.** The genuinely
reachable defects were `k = -1`, `k = NaN`, non-finite `minPx`/`maxPx` and an `Infinity` metric
weight.

Actions: the `k = Infinity` row stays in the acceptance-criteria table (the ticket asks for it) but no
longer claims to catch `Infinity * 0`; the describe-level comment now says which rows die without the
clamp and which do not; and a NEW test pins the `minDepth === 0 ⇒ isCentral` coupling directly
(`WHEN a node is not central THEN its minDepth is at least 1`) — that is the invariant whose breakage
would make the predicted NaN reachable, and it asserts the actual depths `[1, 2]` so it cannot pass
vacuously on an empty set. The correction is recorded as a note on ticket
`nid_8vmo5ibhv1bvh2ukrgmafpofj_e`.

### 5 — force-layout NaN branch pinned

One test in `forceLayoutSettings.test.ts`: `WHEN a field is NaN THEN it falls back to its spec
default`. Mutation-verified RED when `clampIntoRange`'s NaN branch is removed. The comment says WHY
it lives there: that file is where a "simplify this back to `Math.min`/`Math.max`" would land.

### `metricWeight [0, 100]` — re-examined, KEPT

Re-checked against the scope-creep concern, and the review's own analysis agrees. The pre-fix React
weight input guarded `NaN` only, so `1e999` gave an `Infinity` weight and
`weightedSum / totalWeight` = `Infinity / Infinity` = `NaN` → `NaN sizePx` — the same defect, in the
same settings object, through the same input surface. Mutation A (reviewer's) proves the test is
non-vacuous. Excluding it would have made `clampSizingSettings` a lie about the object it clamps.

### REJECTED: `MinMaxNormalizedMetric` totality for a non-finite `sizeBytes`

No change. That would harden against a hostile *LinkProvider*, not hostile *settings* — a different
trust boundary and a different ticket. `sizeBytes` comes from Obsidian's `stat.size`, `hasFiniteGeometry`
still backstops the geometry, and the review itself notes this only so the "the sizer is TOTAL"
comment is read as scoped to settings, which is how it is written.

## New tests (all 10)

- `src/view/sizingInput.test.ts` (6): plain number, negative forwarded, blank rejected, whitespace
  rejected, `1e999` rejected, non-numeric rejected.
- `src/engine/NodeSizer.test.ts` (3): non-central `minDepth >= 1` coupling; `DepthDecayMetric` with
  `k = -1`; `DepthDecayMetric` with `k = Infinity`.
- `src/engine/forceLayoutSettings.test.ts` (1): NaN → spec default.

## Honest coverage statement

`sizingInput` is unit-tested; the *wiring* of those four inputs is still not covered (there is no
`SizingSection` / `VicinityGraphSettingTab` test harness in this repo, and building one is well beyond
this ticket). The helper is a pure function called from four one-line call sites, which is the 80/20
line I drew.

## Not done, deliberately

- No `change_log` entry, ticket not closed, not merged to main (TOP_LEVEL_AGENT's job).
- Follow-up ticket `nid_hatwq2jlkhno5t6awcz0q6t9q_e` filed for the two NITs; not fixed here.
