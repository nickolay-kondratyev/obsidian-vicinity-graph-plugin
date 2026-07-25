# IMPLEMENTATION_WITH_SELF_PLAN — PUBLIC

Ticket `nid_abreq4lmpo8vnvf61y9k9yly0_e`: the "exact shipped baseline" tests in
`src/engine/SettingsSpec.test.ts` omitted `ViewSettings.outlineMaxDepth` on BOTH sides of the
`toEqual`, and their hand-listed shape made under-population invisible.

## Outcome

Both baseline tests are now exhaustive over `ViewSpec` at COMPILE time, and `outlineMaxDepth`
is pinned on both sides of both `toEqual`s. Only one file changed:
`/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2/src/engine/SettingsSpec.test.ts`

## Mechanism chosen, and why

One shared, three-line helper (DRY — used by both baseline tests):

```ts
type EverySpecField<TSpec> = Record<keyof TSpec, unknown>;
const NO_SPEC_LIMITS = "no limits in the spec";
```

Each baseline's actual-side literal is extracted to a `const` annotated
`satisfies EverySpecField<ViewSpec>` and then spread into the `expect(...)`. Adding a field to
`SETTINGS_SPEC.globalView` without baselining it is now a `npm run check` error naming the
missing key. The defaults test additionally annotates its `globalDepths` and `nodeExclusion`
literals with `EverySpecField<DepthSpec>` / `EverySpecField<NodeExclusionSpec>`, so the test's
"exact shipped baseline" name is honest for all three spec sections, not just the view.

Why compile-time over a runtime `Object.entries(view)` projection: the repo prefers compile-time
checks, and a generic runtime projection cannot work uniformly here — `sizing` and `forceLayout`
are nested groups needing their own projection while the other five view fields are leaves. The
`satisfies` annotation keeps the existing readable literals AND closes the hole. It follows the
repo's existing `as const satisfies ...` completeness idiom (`src/engine/types.ts:175-188`)
without inventing a framework.

`NO_SPEC_LIMITS` marker (limits test only): `nodePreviewPreference`, `groupByFolder`,
`edgeVisibility` and `sizing` are default-only spec entries with no min/max/step. Rather than
silently skipping them (the very failure mode being fixed), they carry an explicit marker on both
sides — so a new field forces an explicit "has limits / has none" decision.

## RED proof (the core evidence)

Probe: temporarily add `readonly fakeNewKnob: DefaultSpec<number>` to `ViewSpec` and
`fakeNewKnob: { default: 7 }` to `SETTINGS_SPEC.globalView`, i.e. exactly the "someone adds a
spec key" scenario. Probe reverted afterwards (`git checkout src/engine/SettingsSpec.ts`).

BEFORE the fix — the gap is real, nothing goes red (`.tmp/red-proof-before.txt`,
`.tmp/red-proof-before-check.txt`):
```
 Test Files  1 passed (1)
      Tests  15 passed (15)
check_exit=0
```

AFTER the fix — the guard fires at BOTH baselines and names the culprit
(`.tmp/red-proof-after-check.txt`, `check_exit=2`):
```
src/engine/SettingsSpec.test.ts(61,5): error TS1360: Type '{ nodeCap: number; outlineMaxDepth: number; ... }'
  does not satisfy the expected type 'EverySpecField<ViewSpec>'.
  Property 'fakeNewKnob' is missing in type '{ ... }' but required in type 'EverySpecField<ViewSpec>'.
src/engine/SettingsSpec.test.ts(123,5): error TS1360: Type '{ nodeCap: { min: number; }; outlineMaxDepth: {...}; ... }'
  does not satisfy the expected type 'EverySpecField<ViewSpec>'.
  Property 'fakeNewKnob' is missing in type '{ ... }' but required in type 'EverySpecField<ViewSpec>'.
```

## Assertions added / changed

- Defaults baseline: `+ outlineMaxDepth: 2` (actual `view.outlineMaxDepth.default`).
- Limits baseline: `+ outlineMaxDepth: { min: 1, max: 6, step: 1 }`; `nodeCapMin: 1` restated as
  `nodeCap: { min: 1 }` (identical assertion on `SETTINGS_SPEC.globalView.nodeCap.min`, new key
  name so it sits inside the guarded per-field literal).
- Nothing loosened, nothing deleted. All 15 tests in the file remain, plus the two new pinned
  values inside existing assertions.

## Verification

| Command | Result |
|---|---|
| `npm test` → `.tmp/impl-test.txt` | 68 files, **922 passed, 0 failed** |
| `npm run check` → `.tmp/impl-check.txt` | exit 0, tsc strict clean |

No pre-existing failures observed on this branch.

## Rejected / out of scope

- **`linkStrengthFactor.max`** (`docs-internal/tickets/ticket-settings-baseline-tests-stale-after-spacing-change.md`)
  — untouched, as instructed. Confirmed NOT currently red: the test expects `max: 4` and
  `SettingsSpec.ts` has `max: 4`. That ticket appears stale/already-resolved on this branch;
  flagging for a human to close rather than editing it here.
- **A generic runtime "spec → defaults" projection helper** — rejected as over-engineering for a
  test-quality fix (nested vs leaf spec entries would force a clever recursive mapper).
