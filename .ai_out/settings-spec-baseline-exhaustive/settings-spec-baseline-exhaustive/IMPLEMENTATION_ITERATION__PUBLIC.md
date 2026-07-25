# IMPLEMENTATION ITERATION — PUBLIC (review iteration 1, convergence record)

Ticket `nid_abreq4lmpo8vnvf61y9k9yly0_e` — make the `SETTINGS_SPEC` "exact shipped baseline"
tests exhaustive. Branch `settings-spec-baseline-exhaustive`.

## Verdict: **READY — CONVERGED.** 0 BLOCKING, 0 SHOULD-FIX. I signal readiness.

Both iteration-0 SHOULD-FIX findings are genuinely fixed — verified by re-running my own probes
against the new code, not by reading the implementer's evidence. One NICE-TO-HAVE landed for
free; the other is correctly deferred as out of scope. One residual gap is documented below and
explicitly judged **acceptable** — it does not warrant another round.

## Disposition of every prior finding

| # | Prior finding | Implementer | My verification | Status |
|---|---|---|---|---|
| 1 | `NO_SPEC_LIMITS` is inert (self-comparison) | ACCEPTED, fixed with a *different* type than I suggested | Re-ran my exact iteration-0 probe: **now RED** | **CLOSED** |
| 2 | `sizing` defaults literal unguarded | ACCEPTED, `satisfies EverySpecField<SizingSpec>` | New `SizingSpec` field probe: **now RED** | **CLOSED** |
| 3 | NICE-TO-HAVE: `incomingDepth` / `step` unbaselined, `depthStepper` unguarded | ACCEPTED, restated as guarded `globalDepths` | Strictly additive (see below); drop-a-pin probe RED | **CLOSED** |
| 4 | NICE-TO-HAVE: stale ticket + `linkStrengthFactor` JSDoc drift | NOT DONE, out of scope | Confirmed untouched; both still live for TOP | **DEFERRED (correct)** |

## Verification (run independently this round)

| Command | Result |
|---|---|
| `npm test` → `.tmp/rev1-test.txt` | exit 0 — **68 test files, 922 tests passed, 0 failed** |
| `npm run check` → `.tmp/rev1-check.txt` | exit 0 — tsc strict clean |
| `git status` after all probes | clean |

No `sanity_check.sh` in this repo. The reviewed file still holds **15 tests** — none removed.

### Guard probes (mine, all reverted)

| Probe | Mutation | Result |
|---|---|---|
| C′ | `groupByFolder` (default-only) GAINS `min`/`max` — my iteration-0 counter-example | **RED** `test.ts(129,4) TS2322: Type 'string' is not assignable to type '{ min: unknown; max: unknown; }'` |
| D | `outlineMaxDepth.max` pin deleted | **RED** `TS2741: Property 'max' is missing … required in '{ min; max; step }'` |
| D2 | `nodeCap.min` pin deleted | **RED** `TS2741: Property 'min' is missing` |
| E | new `SizingSpec` field added | **RED** `test.ts(72,6) TS1360 … 'fakeSizingKnob' is missing … 'EverySpecField<SizingSpec>'` |
| F | `incomingDepth.step` pin deleted | **RED** `test.ts(147,5) TS2741: Property 'step' is missing` |

So the marker is a checked claim now, and a pinned bound cannot be quietly dropped either.
Both directions hold.

## On the deviation from my suggested snippet — **the implementer was right, I was wrong**

I verified their rationale on merits, on a scratch file under `--strict`:

```
error TS2353: Object literal may only specify known properties,
  and 'max' does not exist in type '{ min: unknown; }'.
```

`satisfies` performs excess-property checking, so my
`TSpec[K] extends { readonly min: unknown } ? { min: unknown } : unknown` would have made
`outlineMaxDepth`'s `{min, max, step}` an error and forced **deleting** the `max`/`step` pins
this very ticket added — a weakening. Their form,

```ts
type SpecLimitsBaseline<TSpec> = {
	[K in keyof TSpec]: { [B in Extract<keyof TSpec[K], "min" | "max" | "step">]: unknown };
};
```

derives the required bound keys from the spec field itself: it is exhaustive over `keyof TSpec`
like `EverySpecField`, forces every declared bound to be pinned, and lets only a bound-less field
carry the marker. Same intent, correct mechanics, strictly stronger than my proposal. Rationale
**confirmed**.

## No weakening introduced (key-by-key vs `main`)

- **Limits test** — `main`: `depthStepper {min:0, max:5}` (outgoing only), `nodeCapMin: 1`,
  `forceLayout` (7 × min/max/step). **Branch**: `globalDepths.outgoingDepth {min:0,max:5,step:1}`
  **+** `incomingDepth {min:0,max:5,step:1}`, `nodeCap {min:1}`, `outlineMaxDepth {min:1,max:6,step:1}`,
  identical `forceLayout` block. The `depthStepper` → `globalDepths` restatement is **strictly
  additive**: old `min: 0 / max: 5` retained, `step` and the whole `incomingDepth` field added.
- The `{}`/marker entries for default-only fields swallowed **nothing** — those four view fields
  had *no entry at all* in `main`'s limits test, so there was no prior bound to lose.
- `linkStrengthFactor: { min: 0.25, max: 4, step: 0.05 }` (`test:168`) **untouched**, as instructed.
- **Defaults test** — `main`'s 8 actual-side keys, plus `outlineMaxDepth` on both sides. Nothing dropped.
- `src/engine/SettingsSpec.ts` and the stale ticket file are **not in the diff**. Only
  `src/engine/SettingsSpec.test.ts` has ever changed in `src/`.

## 🚨 CRITICAL / BLOCKING

None.

## ⚠️ SHOULD-FIX

None.

## 💡 Residual gap — my verdict: **acceptable, do not fix in this ticket**

The implementer flagged that `nodeExclusion` has no entry in the limits test. Verified: a
`nodeExclusion.patterns` that gains a `max` stays green. **But this is not a `nodeExclusion`
issue — it is one general gap:** `SpecLimitsBaseline` inspects only a field's *direct*
`min|max|step` keys, so any *composite* section maps to `{}` and its **nested** bound drift is
invisible. I confirmed the same hole for `sizing`: giving `sizing.minPx` a `min/max/step` also
stays green.

So the proposed one-liner would close the *less* likely of the two cases (both `nodeExclusion`
fields are a boolean and a `string[]`; neither will ever grow bounds) while leaving
`sizing.minPx/maxPx` — the likelier candidate — open, creating false symmetry. Correct call is
to leave it. Optional, zero-risk: one sentence in the `SpecLimitsBaseline` doc noting that a
composite section maps to `{}` and its nested bounds are out of the guard's reach. Not required
for sign-off.

## Acceptance criteria

| AC | Status |
|---|---|
| 1. `outlineMaxDepth` on both sides of the baseline `toEqual` | **MET** — defaults `test:61`/`test:90`; limits `test:123-127`/`test:160` |
| 2. Cannot silently omit a field; a new spec entry fails | **MET** — probe-verified for `ViewSpec`, `DepthSpec`, `SizingSpec`, `NodeExclusionSpec`; iteration-0's `SizingSpec` shortfall is closed |
| Do not weaken existing assertions | **MET** — key-by-key diff shows additions only; 15/15 tests retained |
| Leave `linkStrengthFactor.max` alone | **MET** |

## Follow-ups for TOP (not this ticket)

1. `docs-internal/tickets/ticket-settings-baseline-tests-stale-after-spacing-change.md` is OPEN
   claiming 1 RED test, but `main` re-pinned `max: 4` in `258ec5a` and the suite is green — stale,
   needs a human close.
2. `src/engine/SettingsSpec.ts:196-198` — the `linkStrengthFactor` JSDoc documents `[0.25, 2]`
   while the code ships `max: 4`. Real doc drift, still live.

## Documentation Updates Needed

None for `CLAUDE.md`. Items above are ticket/JSDoc hygiene owned by TOP.
