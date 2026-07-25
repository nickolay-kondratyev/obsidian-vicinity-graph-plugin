# IMPLEMENTATION_REVIEWER — PRIVATE (rehydration notes)

Ticket `nid_abreq4lmpo8vnvf61y9k9yly0_e`, branch `settings-spec-baseline-exhaustive`.

- **Iteration 0 verdict**: READY — 0 BLOCKING, 2 SHOULD-FIX, 2 NICE-TO-HAVE.
- **Iteration 1 verdict (this round): READY / CONVERGED — 0 BLOCKING, 0 SHOULD-FIX.**
  Both SHOULD-FIXes are genuinely fixed (probe-verified), NICE-TO-HAVE #3 landed for free,
  NICE-TO-HAVE #4 correctly deferred as out of scope.

## Scope (unchanged in shape)

`git diff main...HEAD -- src/` still touches exactly ONE file: `src/engine/SettingsSpec.test.ts`
(+79/-15 cumulative). No production code changed. Branch commits: `0c37a16`, `74671aa`,
`0ee0aa4` (my iteration-0 review), `1e22168` (the iteration-1 fix).

## Independent verification (re-run this round, not taken on faith)

| Command | Result |
|---|---|
| `npm test` → `.tmp/rev1-test.txt` | `test_exit=0` — **68 test files, 922 passed, 0 failed** |
| `npm run check` → `.tmp/rev1-check.txt` | `check_exit=0` — tsc strict clean |

No `sanity_check.sh` in this repo. 15 tests remain in the reviewed file (2 + 7 + 1 + 5),
same count as iteration 0 — nothing deleted.

## Probes (all run by me; `.tmp/probe.py`, `.tmp/probe2.py`; every one reverted, `git status` clean)

| Probe | Mutation | tsc | Message |
|---|---|---|---|
| C′ | `ViewSpec.groupByFolder` gains `min`/`max` (my own iteration-0 probe) | **exit 2 — RED** | `test.ts(129,4) TS2322: Type 'string' is not assignable to type '{ min: unknown; max: unknown; }'` |
| D | drop `max: view.outlineMaxDepth.max` pin | **exit 2 — RED** | `TS2741: Property 'max' is missing … required in '{min;max;step}'` |
| D2 | `nodeCap: { min: … }` → `nodeCap: {}` | **exit 2 — RED** | `TS2741: Property 'min' is missing` |
| E | new `SizingSpec.fakeSizingKnob` field | **exit 2 — RED** | `test.ts(72,6) TS1360 … 'fakeSizingKnob' is missing … 'EverySpecField<SizingSpec>'` |
| F | drop `incomingDepth.step` pin | **exit 2 — RED** | `test.ts(147,5) TS2741: Property 'step' is missing` |
| G | `sizing.minPx` gains `min/max/step` (NESTED bound drift) | exit 0 — green | residual gap, see below |
| H | `nodeExclusion.patterns` gains `max` | exit 0 — green | residual gap, see below |

So: `NO_SPEC_LIMITS` is no longer inert (C′), bound pins can no longer be dropped (D/D2/F),
and the `sizing` guard fires (E).

## My own iteration-0 snippet was WRONG — implementer's rationale confirmed

I verified it on a scratch file (`.tmp/scratch/epc.ts`, `--strict`):

```
.tmp/scratch/epc.ts(7,16): error TS2353: Object literal may only specify known properties,
  and 'max' does not exist in type '{ min: unknown; }'.
```

`satisfies` does excess-property checking, so my `TSpec[K] extends {readonly min: unknown} ?
{min: unknown} : unknown` would have forced DELETING the `outlineMaxDepth.max`/`.step` pins this
ticket just added. The implementer's `{ [B in Extract<keyof TSpec[K], "min"|"max"|"step">]: unknown }`
derives the required bound keys from the spec field itself — same intent, correct mechanics,
strictly stronger. **Their deviation was right; my suggestion was the weaker form.**

## Key-by-key: nothing weakened this round

`main` limits test asserted: `depthStepper {min:0,max:5}` (outgoing only), `nodeCapMin: 1`,
`forceLayout` (7 fields × min/max/step). Branch asserts: `globalDepths.outgoingDepth
{min:0,max:5,step:1}` + `incomingDepth {min:0,max:5,step:1}`, `nodeCap {min:1}`,
`outlineMaxDepth {min:1,max:6,step:1}`, identical `forceLayout` block. **Strictly additive** —
the `depthStepper` → `globalDepths` restatement retains `min: 0 / max: 5` and adds `step` +
`incomingDepth`. `linkStrengthFactor: { min: 0.25, max: 4, step: 0.05 }` (test:168) unchanged.

The `{}` mapping for default-only fields swallowed nothing: on `main` those four view fields had
**no entry at all** in the limits test, so there was no prior bound to lose.

Defaults test: `main`'s 8 actual-side keys, plus `outlineMaxDepth` on both sides. Nothing dropped.

## Residual gap (NOT blocking — my verdict: acceptable scope-closure)

`SpecLimitsBaseline` inspects only the DIRECT `min|max|step` keys of a spec field, so a
*composite* section maps to `{}` and its NESTED bound drift is invisible. This is one gap class,
not two: it hits `sizing` (probe G) exactly as it hits the absent `nodeExclusion` (probe H).
Adding the one-line `nodeExclusion` literal would close the less likely of the two (both fields
are a boolean and a `string[]` — neither will grow bounds) while leaving `sizing.minPx/maxPx`
open, creating false symmetry. Correct disposition = leave as is, one doc sentence at most.
Not worth another round.

## Out-of-scope items confirmed untouched
- `src/engine/SettingsSpec.ts` — not in the diff at all; `linkStrengthFactor` JSDoc (lines 196-198)
  still documents `[0.25, 2]` against the shipped `max: 4`. Still a live doc-drift item for TOP.
- `docs-internal/tickets/ticket-settings-baseline-tests-stale-after-spacing-change.md` — untouched,
  still OPEN, still stale (main already re-pinned `max: 4` in `258ec5a`). Human should close it.

## Rehydration pointers
- Reviewed file: `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2/src/engine/SettingsSpec.test.ts`
- Spec under test: `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2/src/engine/SettingsSpec.ts`
- I modified no source/test file; all probes reverted, `git status --short` empty afterwards.
