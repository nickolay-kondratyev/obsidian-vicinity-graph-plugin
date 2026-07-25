# IMPLEMENTATION_WITH_SELF_PLAN — PUBLIC

Ticket `nid_abreq4lmpo8vnvf61y9k9yly0_e`: the "exact shipped baseline" tests in
`src/engine/SettingsSpec.test.ts` omitted `ViewSettings.outlineMaxDepth` on BOTH sides of the
`toEqual`, and their hand-listed shape made under-population invisible.

Only one file has ever changed on this branch:
`/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2/src/engine/SettingsSpec.test.ts`

---

# Iteration 1 — response to IMPLEMENTATION_REVIEW

## Disposition of every review finding

| # | Finding | Disposition |
|---|---|---|
| 1 | `NO_SPEC_LIMITS` is inert (self-comparison) | **ACCEPTED** — fixed, with a deviation from the suggested type (rationale below) |
| 2 | `sizing` defaults literal unguarded | **ACCEPTED** — fixed as suggested (one-liner) |
| 3 | NICE-TO-HAVE: `incomingDepth` / `step` never baselined; `depthStepper` unguarded | **ACCEPTED** — fell out for free from guarding `depthStepper` |
| 4 | NICE-TO-HAVE: stale ticket + `linkStrengthFactor` JSDoc drift | **NOT DONE** — out of scope per TOP_LEVEL_AGENT; TOP files the follow-up |

---

## SHOULD-FIX 1 — ACCEPTED. The marker now asserts something.

New guard, replacing `EverySpecField` on the `viewLimits` literal:

```ts
type SpecLimitsBaseline<TSpec> = {
	[K in keyof TSpec]: { [B in Extract<keyof TSpec[K], "min" | "max" | "step">]: unknown };
};
```

It is exhaustive over `keyof TSpec` exactly like `EverySpecField`, and additionally derives the
required bound keys **from the spec field itself**: a bounded field must pin every bound it
declares; a default-only field maps to `{}`, and only such a field may carry `NO_SPEC_LIMITS`.

### Why I deviated from the reviewer's exact snippet (not a convenience argument)

The suggested `TSpec[K] extends { readonly min: unknown } ? { min: unknown } : unknown` does not
survive contact with `satisfies`, because `satisfies` performs **excess-property checking**.
`outlineMaxDepth` pins `{ min, max, step }`; against a target of `{ min: unknown }` that is an
error. Verified on a scratch file:

```
.tmp/epc-scratch.ts(7,36): error TS2353: Object literal may only specify known properties,
  and 'max' does not exist in type '{ min: unknown; }'.
```

Adopting it verbatim would have forced me to **delete the `outlineMaxDepth.max` and `.step`
pins** — a weakening, and of an assertion this very ticket added. The `Extract<keyof TSpec[K], …>`
form gets the reviewer's intended semantics with no assertion loss. Same idea, correct mechanics.

### RED evidence (reviewer's own probe: `groupByFolder` gains limits)

Probe = add `min`/`max` to `groupByFolder` in both `ViewSpec` and `SETTINGS_SPEC.globalView`.

**BEFORE the fix — green, i.e. the finding is real** (`.tmp/probeA-before-*.txt`):
```
 Test Files  1 passed (1)
      Tests  15 passed (15)
test_exit=0     check_exit=0
```

**AFTER the fix — RED** (`.tmp/probeA-after-check.txt`, `check_exit=2`):
```
src/engine/SettingsSpec.test.ts(129,4): error TS2322:
  Type 'string' is not assignable to type '{ min: unknown; max: unknown; }'.
```
Line 129 is the `groupByFolder: NO_SPEC_LIMITS` entry — the marker is now a checked claim.

---

## SHOULD-FIX 2 — ACCEPTED. `sizing` is guarded.

Closed the sizing defaults literal with `} satisfies EverySpecField<SizingSpec>,` (+ the type
import), exactly as suggested.

### RED evidence (new `SizingSpec` field)

Probe = add `readonly fakeSizingKnob: DefaultSpec<number>` to `SizingSpec` + `fakeSizingKnob:
{ default: 3 }` to the spec.

**BEFORE — green** (`.tmp/probeB-before-*.txt`): `Tests 15 passed (15)`, `check_exit=0`.

**AFTER — RED** (`.tmp/probeB-after-check.txt`, `check_exit=2`):
```
src/engine/SettingsSpec.test.ts(72,6): error TS1360: Type '{ metrics: {...}; depthDecayK: number;
  minPx: number; maxPx: number; }' does not satisfy the expected type 'EverySpecField<SizingSpec>'.
```

---

## The last unguarded literal (`depthStepper`) — also closed

`depthStepper: { min, max }` was a hand-made alias reading only `outgoingDepth`. It is now:

```ts
globalDepths: {
	outgoingDepth: { min, max, step },
	incomingDepth: { min, max, step },
} satisfies SpecLimitsBaseline<DepthSpec>
```

Strictly additive — the old `min: 0 / max: 5` pin is retained and `step` plus the whole
`incomingDepth` field are now pinned. The key rename also makes the limits test's top-level shape
match the defaults test's (`globalDepths`). This is the review's NICE-TO-HAVE #3, obtained for
free, as TOP_LEVEL_AGENT permitted.

**Nothing was weakened and no test was deleted.** All 15 tests in the file remain; every prior
assertion is still made, several are now stricter.

## Known remaining gap (deliberate, KISS)

`nodeExclusion` has no entry in the LIMITS test at all (both its fields are default-only). A
future `nodeExclusion` field gaining bounds would not be caught there. Flagging rather than
building a third guarded literal for an all-default section; say the word and it is one line.

## Verification (iteration 1)

| Command | Result |
|---|---|
| `npm test` → `.tmp/iter1-test.txt` | exit 0 — **68 test files, 922 passed, 0 failed** |
| `npm run check` → `.tmp/iter1-check.txt` | exit 0 — tsc strict clean |
| `git status` after all probes | clean (only the intended `SettingsSpec.test.ts` change, now committed) |

---

# Iteration 0 (original implementation) — retained for context

`type EverySpecField<TSpec> = Record<keyof TSpec, unknown>` applied via `satisfies` to the
actual-side literal of each baseline test, so a field added to (or removed from) a spec section
without being baselined is an `npm run check` error naming the key. `outlineMaxDepth` pinned on
both sides of both `toEqual`s (`+ outlineMaxDepth: 2` in defaults; `+ outlineMaxDepth:
{ min: 1, max: 6, step: 1 }` in limits); `nodeCapMin: 1` restated as `nodeCap: { min: 1 }` (same
spec value, same pinned `1`, new key so it sits inside the guarded literal).

Compile-time was chosen over a runtime `Object.entries` projection because the repo prefers
compile-time checks and a uniform runtime projection cannot handle the mix of nested (`sizing`,
`forceLayout`) and leaf spec entries without a clever recursive mapper — over-engineering for a
test-quality fix. Original RED proof: adding `fakeNewKnob` to `ViewSpec` + the spec was green
before and produces `TS1360` at **both** baselines after.
