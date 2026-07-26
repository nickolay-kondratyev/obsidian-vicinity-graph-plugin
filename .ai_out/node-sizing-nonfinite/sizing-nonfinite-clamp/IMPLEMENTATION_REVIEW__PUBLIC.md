# IMPLEMENTATION REVIEW — sizing non-finite clamp (`sizing-nonfinite-clamp`)

Reviewed `git diff main..HEAD` (`4822bf7` fix, `5e3618b` docs). Read-only review; every claim below
was verified against the code or by a throwaway mutation that was reverted (tree left clean).

## Verified commands (run by the reviewer, not copied from the report)

| Command | Result |
|---|---|
| `npm run check` | **PASS**, exit 0 (`tsc -noEmit`, strict) |
| `npm test` | **PASS**, exit 0 — **71 files, 956 tests, 0 failures** |

Mutation probes (each reverted with `git checkout` immediately; `git status` clean afterwards):

| Mutation in `src/engine/NodeSizer.ts` | `NodeSizer.test.ts` result |
|---|---|
| A: drop `clampSizingSettings(rawSettings)` in `computeSizes` | **3 failures** — `minPx`, `maxPx`, metric-weight tests go RED; all three `k` tests stay green |
| B: drop the `Number.isFinite(decayed)` guard in `DepthDecayMetric` | **0 failures** — 22/22 green |
| C: both removed (pre-fix behaviour) | **5 failures** — `k = -1`, `k = NaN`, `minPx`, `maxPx`, weight. **`k = Infinity` still passes.** |

The implementer's two self-reported caveats are **true as stated**. Full marks for disclosing them.

## Summary

Bounds (`min/max/step`) are declared on `SETTINGS_SPEC.globalView.sizing` for `depthDecayK`, `minPx`,
`maxPx` and a new shared `metricWeight`; `SIZING_RANGES` + `clampSizingSettings` in
`src/engine/constants.ts` mirror the `clampForceLayoutSettings` precedent (both now share
`rangesOf` + `clampIntoRange`); the clamp is applied on the persistence-load path
(`parseSizing`), on the single UI write choke point (`planSettingsWrite` `global-sizing`) and once
more inside `NodeSizer.computeSizes`; `DepthDecayMetric` degrades a non-finite decay to
`NEUTRAL_NORMALIZED_VALUE`. Both UI surfaces take their input attributes from `SIZING_RANGES`.

**Overall: sound.** Correct layering (`view → adapters → engine`; the clamp lives in the pure
engine, `importGuard.test.ts` still green), single-source bounds, no anchor point or
behaviour-capturing test removed (the test diff is purely additive), no hack, no dead abstraction.
**No BLOCKING findings.** Five SHOULD-FIX items, of which #1 is a small real behaviour regression I
would fix before merge; the rest are honesty/coverage cleanups.

### Independently confirmed positives

- **Write paths are genuinely all covered.** `SizingSection.tsx` (`applySizing` / `setMetric`) and
  `VicinityGraphSettingTab.ts` (`applySizing` → `applyInteraction` → `planSettingsWrite`, line 582)
  both funnel through the one `global-sizing` case. `grep` finds no other producer of a
  `SizingSettings`. No bypass.
- **`metricWeight` is NOT scope creep.** The pre-fix React weight input guarded only `NaN`, so
  `1e999` → `Infinity` weight → `weightedSum / totalWeight` = `Infinity / Infinity` = `NaN` →
  `NaN sizePx`. Mutation A proves the new test is non-vacuous for exactly this path. Without it
  `clampSizingSettings` would have been a lie, as the report says.
- **Bounds are a real no-op for defaults and sane values** — `clampSizingSettings(defaults)` is
  pinned, and the untouched `SETTINGS_SPEC` default baselines are still green. `[0,10]` for `k`,
  `[1,400]` px, `[0,100]` weight are all defensible and generously above any plausible user value.
- **Inverted range cannot be *created* by clamping.** `minPx` and `maxPx` clamp into the *same*
  `[1,400]` interval, so clamping is monotone and can only shrink an existing inversion.

## 🚨 CRITICAL / BLOCKING

None.

## ⚠️ SHOULD-FIX

### 1. Settings tab: clearing a sizing field now writes a value (`Number("") === 0`)

`src/view/VicinityGraphSettingTab.ts` `addSizingNumber` changed from

```ts
if (!Number.isNaN(parsed) && parsed >= min) {   // before
if (Number.isFinite(parsed)) {                  // after
```

`Number("")` is `0`, and `Number.isFinite(0)` is `true`. Previously an empty field produced `0`,
which failed `parsed >= 1` and was **rejected** for `minPx`/`maxPx`; now it is forwarded and clamped
to `SIZING_RANGES.minPx.min` = **1**. So select-all-delete (the normal way to retype a number) now
immediately persists `minPx = 1` + `refreshOpenViews()`, and if the user clicks away without typing,
the stored value is `1` while the field looks empty. Same for the metric-weight input (`→ 0`).
The final typed value still wins, so this is not data loss — but it is a behaviour regression and a
visible flash. `SizingSection.tsx` is unaffected (`valueAsNumber` on an empty input is `NaN`).

Fix: reject blank input explicitly before `Number(raw)` — ideally inside the shared parser of #2.

### 2. DRY + zero coverage on the input-acceptance rule

The rule "accept only a finite number" is now written out at **four** call sites
(`SizingSection.tsx` ×2, `VicinityGraphSettingTab.ts` ×2), and there is no `SizingSection` or
`VicinityGraphSettingTab` test file at all — so nothing in the suite pins it, which is precisely why
#1 slipped through. Extract one pure helper (e.g. `parseSizingInput(raw: string): number | undefined`
next to `settingsWritePlan.ts`, handling blank / non-finite) and BDD-test it. One place to change,
one place to get right.

### 3. The `DepthDecayMetric` guard is untested, and its comment overstates its reachability

Mutation B: removing the guard leaves **all 956 tests green**. The three `k` tests in the new
`NodeSizer hostile sizing settings` describe do not exercise the guard at all — they exercise the
`computeSizes` clamp. The doc comment justifies the guard with *"this class is constructible with any
number"*, but the class is **module-private** with exactly one construction site, which already
receives clamped settings. So today it is unreachable and unpinned: a future refactor could delete it
without a single red test.

Keep it (the ticket mandates it and the blast radius of a miss is the whole session's edge routing),
but make it honest: say plainly that it is unreachable through `computeSizes` today and exists so the
metric is total in its own right. If you want it pinned, the cheap option is a direct unit test via a
narrow export of the metric class; otherwise accept that it is deliberately untested defence in depth
and say so.

### 4. The `k = Infinity` acceptance-criteria test is vacuous — and the ticket's premise is wrong

Mutation C confirms it passes with **both** guards removed. Reason (verified in
`src/engine/VicinityTraversal.ts`): only roots ever receive a depth-`0` tag (neighbours get
`currentDepth + 1`, line ~130) and `isCentral = rootPaths.has(path)` (line 165), so
`minDepth === 0` ⟺ `isCentral`, and centrals bypass metric composition
(`NodeSizer.computeSizes` line 54). The `Infinity * 0 = NaN` the ticket describes is computed and
then discarded. **There is no reachable `NaN` path from `k` alone** — the real reachable defects were
`k = -1` (`Infinity`), `k = NaN`, non-finite `minPx`/`maxPx`, and the `Infinity` metric weight, all
of which mutation C shows are genuinely caught.

Keep the test as a regression guard on the `minDepth === 0 ⇒ isCentral` coupling, but rename/comment
it to say *that* is what it pins (currently it advertises a defect it does not detect), and record the
correction on the ticket so the premise is not re-litigated later.

### 5. `clampForceLayoutSettings` silently gained NaN→default behaviour, untested

`clampIntoRange`'s `NaN` branch changes force-layout clamping too (previously `Math.min/Math.max`
propagated `NaN`). That is a good hardening, and the report discloses it — but
`src/engine/forceLayoutSettings.test.ts` is untouched, so the new behaviour is unpinned in the very
place the shared helper is most likely to be "simplified" back. Add one
`WHEN a force-layout field is NaN THEN it falls back to the spec default` test.

## 💡 Suggestions (NIT)

- **`minPx <= maxPx` is still unenforced.** `minPx = 400`, `maxPx = 40` yields a finite but inverted
  ramp (bigger score → smaller node). Pre-existing, not a regression, and harmless for geometry —
  worth a follow-up ticket rather than a change here.
- **Per-keystroke clamping snaps the controlled React field** (report's judgement call #4). Typing
  `500` into Max px lands on `400` mid-stroke and the cursor jumps. Acceptable for now; clamp-on-blur
  would be nicer. Same follow-up ticket as above.
- **`MinMaxNormalizedMetric` remains the one non-total metric**: a non-finite `sizeBytes` from a
  provider would give `(Infinity - min) / (Infinity - min)` = `NaN`. Not reachable from Obsidian's
  `stat.size`, and `hasFiniteGeometry` still backstops it — noting only so the "the sizer is TOTAL"
  comment is read as scoped to *settings*, which is how it is written.
- `edgeRouting.ts`'s corrected comment is a genuine improvement: it no longer claims a clamp gap that
  no longer exists, and it states WHY the guard stays. Good.

## Documentation Updates Needed

- None mandatory. `README.md` does not quote sizing numerics, `CLAUDE.md` needs no change. If the
  bounds become user-visible support questions, one line under *Sizing* in `README.md` would help.
- Ticket `nid_8vmo5ibhv1bvh2ukrgmafpofj_e` should carry the finding from #4 (the `k = Infinity`
  scenario is not reachable) before it is closed, so the record is accurate.

## Readiness verdict

**APPROVED for merge with follow-ups.** No BLOCKING issues; `npm run check` and `npm test` are green
(956/956). I would fix **SHOULD-FIX #1** (empty-field write) before merging — it is a five-line
change — and take #2–#5 either now or as a tracked follow-up ticket. The core design (single-source
bounds in the spec, clamp on load + on the one write choke point + inside the sizer) is correct,
consistent with the force-layout precedent, and preserves engine purity.
