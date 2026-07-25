# IMPLEMENTATION REVIEW — PUBLIC (iteration 1)

Ticket `nid_abreq4lmpo8vnvf61y9k9yly0_e` — make the `SETTINGS_SPEC` "exact shipped baseline"
tests exhaustive. Branch `settings-spec-baseline-exhaustive`.

## Verdict: READY — 0 BLOCKING, 2 SHOULD-FIX, 2 NICE-TO-HAVE

Both acceptance criteria are met, nothing was weakened or deleted, and I reproduced the
RED proof myself rather than trusting the implementer's evidence.

## Summary

One file changed: `src/engine/SettingsSpec.test.ts` (+63/-13). A three-line helper
(`type EverySpecField<TSpec> = Record<keyof TSpec, unknown>`) is applied via `satisfies` to
the actual-side literals of both baseline tests, `outlineMaxDepth` is pinned on both sides of
both `toEqual`s, and four default-only view fields carry an explicit `NO_SPEC_LIMITS` marker
in the limits test. No production code touched.

## Verification (run independently)

| Command | Result |
|---|---|
| `npm test` → `.tmp/rev-test.txt` | exit 0 — **68 test files, 922 tests passed, 0 failed** |
| `npm run check` → `.tmp/rev-check.txt` | exit 0 — tsc strict clean |

No `sanity_check.sh` in this repo.

### Guard genuinely fires (my own probe, not the implementer's)
Added `readonly fakeNewKnob: DefaultSpec<number>` to `ViewSpec` + `fakeNewKnob: { default: 7 }`
to `SETTINGS_SPEC.globalView` → `tsc -noEmit` exits 2 with an error at **both** baselines,
each naming the key:
`SettingsSpec.test.ts(61,5)` and `(123,5)`: `TS1360 ... Property 'fakeNewKnob' is missing in
type '{...}' but required in type 'EverySpecField<ViewSpec>'.` Probe reverted, `git status`
clean.

### The guard is bidirectional (better than the brief assumed)
`satisfies` performs excess-property checking on object literals — verified on a scratch file:
`{ a:1, b:2, c:3 } satisfies Record<keyof S, unknown>` → `TS2353 ... 'c' does not exist`. So a
**removed** spec key is caught too, not only an added one.

### Assertion-set diff vs `main` (key by key) — nothing dropped
- **Defaults test**: same 8 actual-side keys as `main`, **plus** `outlineMaxDepth`; expected
  side gains the matching `outlineMaxDepth: 2`.
- **Limits test**: `main` had `depthStepper, nodeCapMin, forceLayout`; branch has all three
  (with `nodeCapMin` restated) plus `outlineMaxDepth` and the four markers.
- `nodeCapMin: SETTINGS_SPEC.globalView.nodeCap.min` → `nodeCap: { min: view.nodeCap.min }`
  reads the **same spec value** and pins the same `1`. Equivalent, not shrunk.
- `unknown` as the value type weakens nothing: `main`'s literals were unannotated, and
  vitest's `toEqual<E>` is unconstrained, so no compile-time value check existed before. The
  runtime pinning is strictly larger now.
- `linkStrengthFactor.max` assertion (`test:141`) **untouched**, as instructed.

## 🚨 CRITICAL / BLOCKING

None.

## ⚠️ SHOULD-FIX

### 1. `NO_SPEC_LIMITS` is inert — it asserts nothing (`SettingsSpec.test.ts:39, 113-116, 134-137`)
The marker appears as a hardcoded constant on **both** sides of the `toEqual`, so those four
entries compare a constant to itself. Proven: I temporarily gave `groupByFolder` a
`min`/`max` in `ViewSpec` and in the spec — a default-only field that *gains limits*, exactly
the drift the file exists to catch — and **all 15 tests still passed with 0 tsc errors**. So
the marker's text "no limits in the spec" is a claim the test never checks, while the test
name promises "the exact shipped baseline". That is the same honesty gap the ticket was
filed about, just relocated.

Concrete fix (compile-time, in the style already chosen):
```ts
/** Bounded spec fields MUST pin their bounds; only default-only fields may carry the marker. */
type LimitsBaseline<TSpec> = {
	[K in keyof TSpec]: TSpec[K] extends { readonly min: unknown } ? { min: unknown } : unknown;
};
```
Annotate `viewLimits` with `satisfies LimitsBaseline<ViewSpec>` (it can replace
`EverySpecField` there — a mapped type over `keyof TSpec` is equally exhaustive). Then a field
that gains a `min` while still marked `NO_SPEC_LIMITS` is a `npm run check` error.

### 2. The `sizing` defaults literal is still hand-listed and unguarded (`SettingsSpec.test.ts:50-57`)
`depthDecayK` / `minPx` / `maxPx` are hand-listed with no exhaustiveness annotation (only the
inner `metrics` is derived via `Object.entries`). Adding a field to `SizingSpec` is therefore
*still* silently omissible from the "exact shipped baseline" — the ticket's exact failure
mode, one nesting level down. One-line fix: close line 57 with
`} satisfies EverySpecField<SizingSpec>,` (and import the type). `forceLayout`, `metrics`,
`globalDepths` and `nodeExclusion` are already covered.

## 💡 NICE-TO-HAVE

3. **Limits test never baselines `incomingDepth`** (`SettingsSpec.test.ts:125-128`): only
   `outgoingDepth.min/max` is read, and neither depth field's `step` is pinned. Pre-existing
   (they share `DEPTH_STEPPER_BOUNDS`), so low risk — but `depthStepper` is the one literal in
   the limits test with no `satisfies` guard at all.
4. **Stale ticket + stale doc**: `docs-internal/tickets/ticket-settings-baseline-tests-stale-after-spacing-change.md`
   is still marked OPEN claiming 1 RED test, but `main` already re-pinned `max: 4` in
   `258ec5a`; the suite is green. Human should close it. Related and still live: the
   `linkStrengthFactor` JSDoc at `src/engine/SettingsSpec.ts:196-198` documents the range as
   `[0.25, 2]` while the code is `max: 4`. Neither belongs in this ticket.

## Acceptance criteria

| AC | Status |
|---|---|
| 1. `outlineMaxDepth` on both sides of the baseline `toEqual` | **MET** — defaults `test:46` / `test:75`; limits `test:108-112` / `test:133` |
| 2. Cannot silently omit a field; new spec entry fails | **MET** for `ViewSpec`, `DepthSpec`, `NodeExclusionSpec` (probe-verified, both tests, key named). Partially unmet one level down for `SizingSpec` → SHOULD-FIX #2 |
| Do not weaken existing assertions | **MET** — key-by-key diff shows only additions |
| Leave `linkStrengthFactor.max` alone | **MET** |

## Documentation Updates Needed

None for `CLAUDE.md`. The stale ticket in item 4 needs a human close, not an edit here.
