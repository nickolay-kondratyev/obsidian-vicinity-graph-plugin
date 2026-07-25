# IMPLEMENTATION_REVIEWER — PRIVATE (rehydration notes)

Ticket `nid_abreq4lmpo8vnvf61y9k9yly0_e`, branch `settings-spec-baseline-exhaustive`.
Review iteration 1. Verdict: **READY** — 0 BLOCKING, 2 SHOULD-FIX, 2 NICE-TO-HAVE.

## Scope reviewed

`git diff main...HEAD -- src/` touches exactly ONE file:
`src/engine/SettingsSpec.test.ts` (+63/-13). No production code changed. Commits on branch:
`0c37a16` (scaffold notes), `74671aa` (the test change).

## Independent verification actually run (not taken on faith)

| Command | Result |
|---|---|
| `npm test` → `.tmp/rev-test.txt` | `test_exit=0`, **68 files, 922 passed, 0 failed** |
| `npm run check` → `.tmp/rev-check.txt` | `check_exit=0`, tsc strict clean |

### Probe A — added spec key (guard fires?)
Temporarily added `readonly fakeNewKnob: DefaultSpec<number>` to `ViewSpec` +
`fakeNewKnob: { default: 7 }` to `SETTINGS_SPEC.globalView`, then `npx tsc -noEmit`
(`.tmp/probeA.txt`, exit 2). BOTH baselines errored and BOTH named the key:

```
src/engine/SettingsSpec.test.ts(61,5): error TS1360: ... does not satisfy 'EverySpecField<ViewSpec>'.
  Property 'fakeNewKnob' is missing ... but required in type 'EverySpecField<ViewSpec>'.
src/engine/SettingsSpec.test.ts(123,5): error TS1360: ... (same, second baseline)
```
Reverted from `.tmp/SettingsSpec.ts.bak`. `git status --short` clean afterwards.

### Probe B — removed spec key direction
Scratch file `.tmp/probe/excess.ts` under `--strict`:
`const x = { a:1, b:2, c:3 } satisfies Record<keyof S, unknown>` →
`TS2353: Object literal may only specify known properties, and 'c' does not exist in type 'E<S>'.`
So `satisfies` DOES excess-property-check → a REMOVED spec key is also caught (in addition
to the `view.removedKey.default` property-access error). Guard is bidirectional. The
concern raised in the task brief ("only catches an added key") does not hold.

### Probe C — is `NO_SPEC_LIMITS` inert? (YES — the one real finding)
Temporarily changed `ViewSpec.groupByFolder` to `DefaultSpec<boolean> & { min: number; max: number }`
and the spec entry to `{ default: true, min: 0, max: 9 }`, i.e. a default-only field that
GAINS limits. Result (`.tmp/probeC.txt`): **15/15 tests still pass, tsc reports 0 errors in
the test file.** The marker is a self-comparison (`NO_SPEC_LIMITS` on both sides of the
`toEqual`) and asserts nothing. Reverted from `.tmp/SettingsSpec.ts.bak2`; `git status` clean.

## Key-by-key diff of the asserted sets (vs `main`)

Defaults test — actual side keys on main: `globalDepths, nodeCap, nodePreviewPreference,
groupByFolder, edgeVisibility, sizing, forceLayout, nodeExclusion`. On branch: identical
set **plus** `outlineMaxDepth`. Expected side: same delta. **Nothing dropped.**

Limits test — main: `depthStepper, nodeCapMin, forceLayout`. Branch: `depthStepper,
nodeCap{min}, outlineMaxDepth, nodePreviewPreference, groupByFolder, edgeVisibility,
sizing, forceLayout`. `nodeCapMin: SETTINGS_SPEC.globalView.nodeCap.min` → `nodeCap: { min:
view.nodeCap.min }` reads the SAME spec value and pins the same `1`. Coverage identical,
not shrunk. **Nothing dropped.**

`unknown` as the `Record` value type does not weaken anything: on `main` these literals had
no type annotation at all, and vitest's `toEqual<E>` is unconstrained, so no compile-time
value checking existed before either. The real value pinning is the runtime `toEqual`, and
that is strictly larger now.

## linkStrengthFactor.max (instructed not to touch)
Untouched. Note: it is NOT currently red. `main` already carries `max: 4` (re-pinned in
`258ec5a "fix(engine): align the settings-limits baseline to the shipped linkStrengthFactor
max"`), and `SettingsSpec.ts:200` has `max: 4`. So
`docs-internal/tickets/ticket-settings-baseline-tests-stale-after-spacing-change.md` (status
OPEN, claims 1 RED test) is STALE — human should close it. Its sibling doc-sync item is also
still live: the `linkStrengthFactor` JSDoc at `SettingsSpec.ts:196-198` still documents the
range as `[0.25, 2]` while the code says `max: 4`.

## Findings (as filed in the PUBLIC review)
1. SHOULD-FIX — `NO_SPEC_LIMITS` (test:39, 113-116, 134-137) is inert (Probe C). Suggested
   fix: a mapped type forcing bounded specs to pin an object.
2. SHOULD-FIX — the `sizing` literal (test:50-57) is hand-listed and UNGUARDED; adding a
   field to `SizingSpec` is still silently omissible. Same bug class, one level down.
   One-line fix: `} satisfies EverySpecField<SizingSpec>,`.
3. NICE-TO-HAVE — limits test never baselines `incomingDepth` bounds nor either `step`.
4. NICE-TO-HAVE — stale ticket + stale JSDoc above.

## Rehydration pointers
- Reviewed file: `/home/nickolaykondratyev/.../src/engine/SettingsSpec.test.ts`
- Spec under test: `/home/nickolaykondratyev/.../src/engine/SettingsSpec.ts`
- No source/test file was modified by me; all probes reverted and verified clean.
