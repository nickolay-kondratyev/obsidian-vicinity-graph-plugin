# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE (rehydration state)

Ticket: `nid_abreq4lmpo8vnvf61y9k9yly0_e` — SettingsSpec baseline tests not exhaustive.
Branch: `settings-spec-baseline-exhaustive`.

## Status: DONE — iteration 1 (review response) committed, all verification green

## Iteration 0 (predecessor) — shipped
`EverySpecField<TSpec> = Record<keyof TSpec, unknown>` + `NO_SPEC_LIMITS` marker in
`src/engine/SettingsSpec.test.ts`; both baseline literals annotated `satisfies`;
`outlineMaxDepth` pinned on both sides of both `toEqual`s. Details in git history.

## Iteration 1 — review response (this instance)
Both SHOULD-FIX findings ACCEPTED. Only `src/engine/SettingsSpec.test.ts` changed.

1. **SHOULD-FIX 1 (inert marker)** — added `SpecLimitsBaseline<TSpec>`, replacing
   `EverySpecField` on the `viewLimits` literal:
   ```ts
   type SpecLimitsBaseline<TSpec> = {
       [K in keyof TSpec]: { [B in Extract<keyof TSpec[K], "min" | "max" | "step">]: unknown };
   };
   ```
   Deviates from the reviewer's suggested `TSpec[K] extends {min:unknown} ? {min:unknown} : unknown`
   because `satisfies` does excess-property checking — proven on a scratch file:
   `{min,max,step} satisfies {min:unknown}` → `TS2353 ... 'max' does not exist`. That variant would
   have forced DROPPING the `outlineMaxDepth.max`/`.step` pins = a weakening. Mine derives the
   required bound keys FROM the spec field, so a bounded field must pin exactly its own bounds and
   a default-only field maps to `{}` (marker allowed).
2. **SHOULD-FIX 2 (`sizing` unguarded)** — `} satisfies EverySpecField<SizingSpec>,` on the sizing
   defaults literal (+ `SizingSpec` import).
3. **`depthStepper` (reviewer's remaining unguarded literal)** — restated as a guarded
   `globalDepths: { outgoingDepth: {...}, incomingDepth: {...} } satisfies SpecLimitsBaseline<DepthSpec>`.
   Strictly additive: keeps the old `min: 0 / max: 5` pin and adds `step` + `incomingDepth`
   (this incidentally covers NICE-TO-HAVE #3 for free, as TOP_LEVEL allowed).

## Probe technique (re-runnable; scripts live at `.tmp/probeA.py`, `.tmp/probeB.py`)
Probe A: `groupByFolder` gains `min`/`max` in `ViewSpec` + `SETTINGS_SPEC`.
Probe B: new `fakeSizingKnob` field in `SizingSpec` + `SETTINGS_SPEC`.
```bash
python3 .tmp/probeA.py; npm run check; git checkout src/engine/SettingsSpec.ts
```
Evidence (untracked): `.tmp/probeA-before-{test,check}.txt`, `.tmp/probeB-before-{test,check}.txt`,
`.tmp/probeA-after-check.txt`, `.tmp/probeB-after-check.txt`, `.tmp/iter1-{test,check}.txt`.

## Out of scope, untouched (per TOP_LEVEL_AGENT)
- `linkStrengthFactor.max` assertion + the stale spacing-change ticket.
- `linkStrengthFactor` JSDoc drift at `src/engine/SettingsSpec.ts:196-198` (TOP files a follow-up).
- `nodeExclusion` has no entry in the LIMITS test at all (all-default section). Deliberate KISS
  call — noted in PUBLIC, not fixed.

## Next steps if resumed
None. Nothing incomplete. `git status` clean apart from the committed change.
