# Exploration: SettingsSpec.test.ts "exact shipped baseline" test-quality bug

Repo: `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2`

## 0. The bug, stated concretely

`src/engine/SettingsSpec.test.ts` lines 28-83, the test
`"WHEN the spec is read THEN its default values equal the exact shipped baseline"`,
hand-builds an actual object (lines 30-53) that projects `SETTINGS_SPEC.globalView`
field-by-field, but **omits `outlineMaxDepth` entirely** — both from the actual-side
projection and from the `toEqual` literal (lines 54-82). `ViewSpec`/`ViewSettings` both
declare `outlineMaxDepth` as a real field (see §2), and `SETTINGS_SPEC.globalView` has an
`outlineMaxDepth` entry (default `2`, min `1`, max `6`, step `1`, `SettingsSpec.ts:128`).
Because the actual/expected objects are both hand-written literals rather than a projection
over every key of `SETTINGS_SPEC.globalView`, a missing/renamed/newly-added spec field would
NOT be caught by this "exact shipped baseline" test — it would silently pass regardless of
what `outlineMaxDepth` (or any future field) is set to. There IS a separate `describe` block
("outline depth spec", lines 185-206) that pins `outlineMaxDepth`'s default/limits on their
own — so the value itself is tested elsewhere — but the "exact shipped baseline" test's claim
to be the exhaustive pin of "every settings default" is false as written, and nothing
mechanically prevents this drift from recurring for the NEXT field someone adds to
`SETTINGS_SPEC.globalView`.

The limits-baseline test (lines 85-111) similarly hand-builds its actual/expected pair and
also does not include `outlineMaxDepth`'s min/max/step (again covered only by the separate
describe block at 190-193).

## 1. `src/engine/SettingsSpec.test.ts` — full structure

Imports (lines 1-19): `describe/expect/it` from vitest; from `./constants`:
`DEFAULT_EDGE_VISIBILITY, DEFAULT_INCOMING_DEPTH, DEFAULT_MAX_NODE_PX, DEFAULT_MIN_NODE_PX,
DEFAULT_NODE_CAP, DEFAULT_OUTGOING_DEPTH, EngineDefaults, FORCE_LAYOUT_RANGES,
MAX_OUTLINE_DEPTH, MAX_STEPPER_DEPTH, MIN_NODE_CAP, MIN_OUTLINE_DEPTH, MIN_STEPPER_DEPTH,
clampOutlineMaxDepth`; from `./SettingsSpec`: `SETTINGS_SPEC`; from `./SettingsDefaults`:
`SettingsDefaults`.

File doc comment (lines 21-26): states SETTINGS_SPEC is the single source of truth for every
default/limit, that these tests "pin the exact shipped baseline" and prove adapters are
"mechanical projections of the spec."

### `describe("SETTINGS_SPEC (single source of truth for defaults + limits)")` (27-112)

**Test A — defaults baseline** (28-83), `"WHEN the spec is read THEN its default values equal
the exact shipped baseline"`:
```ts
const view = SETTINGS_SPEC.globalView;
expect({
	globalDepths: {
		outgoingDepth: SETTINGS_SPEC.globalDepths.outgoingDepth.default,
		incomingDepth: SETTINGS_SPEC.globalDepths.incomingDepth.default,
	},
	nodeCap: view.nodeCap.default,
	nodePreviewPreference: view.nodePreviewPreference.default,
	groupByFolder: view.groupByFolder.default,
	edgeVisibility: view.edgeVisibility.default,
	sizing: {
		metrics: Object.fromEntries(
			Object.entries(view.sizing.metrics).map(([id, m]) => [id, m.default]),
		),
		depthDecayK: view.sizing.depthDecayK.default,
		minPx: view.sizing.minPx.default,
		maxPx: view.sizing.maxPx.default,
	},
	forceLayout: Object.fromEntries(
		Object.entries(view.forceLayout).map(([field, s]) => [field, s.default]),
	),
	nodeExclusion: {
		enabled: SETTINGS_SPEC.nodeExclusion.enabled.default,
		patterns: SETTINGS_SPEC.nodeExclusion.patterns.default,
	},
}).toEqual({
	globalDepths: { outgoingDepth: 1, incomingDepth: 1 },
	nodeCap: 100,
	nodePreviewPreference: "auto",
	groupByFolder: true,
	edgeVisibility: "walked-from-center",
	sizing: {
		metrics: {
			"own-file-size": { enabled: true, weight: 1 },
			"total-linker-size": { enabled: false, weight: 1 },
			"backlink-count": { enabled: false, weight: 1 },
			"outlink-count": { enabled: false, weight: 1 },
			"depth-decay": { enabled: false, weight: 1 },
		},
		depthDecayK: 1,
		minPx: 40,
		maxPx: 160,
	},
	forceLayout: {
		centerPullStrength: 0.05,
		repelStrength: 300,
		linkStrengthFactor: 1,
		linkGapPx: 40,
		collidePaddingPx: 50,
		elkNodeSpacingPx: 40,
		edgeRoutingClearancePx: 11,
	},
	nodeExclusion: { enabled: false, patterns: [] },
});
```
Note two things about HOW it builds the actual object:
- `sizing.metrics` and `forceLayout` ARE built generically via `Object.entries(...).map(...)`
  — i.e. those two nested groups already auto-project every key, so adding a new sizing
  metric or a new force-layout field to the spec WOULD be caught here (a key would appear
  on the actual side with no matching expected key → `toEqual` fails).
- The top-level `ViewSpec` fields (`nodeCap`, `outlineMaxDepth`, `nodePreviewPreference`,
  `groupByFolder`, `edgeVisibility`, `sizing`, `forceLayout`) are NOT built generically — they
  are individually named, and `outlineMaxDepth` was simply never added to that hand list. This
  is the asymmetry that caused the bug: two of the seven `ViewSpec` fields are auto-projected
  sub-objects, the rest are manually enumerated, and one manual enumeration item is missing.

**Test B — limits baseline** (85-111), `"WHEN the spec is read THEN its limits equal the exact
shipped baseline"`:
```ts
expect({
	depthStepper: {
		min: SETTINGS_SPEC.globalDepths.outgoingDepth.min,
		max: SETTINGS_SPEC.globalDepths.outgoingDepth.max,
	},
	nodeCapMin: SETTINGS_SPEC.globalView.nodeCap.min,
	forceLayout: Object.fromEntries(
		Object.entries(SETTINGS_SPEC.globalView.forceLayout).map(([field, s]) => [
			field,
			{ min: s.min, max: s.max, step: s.step },
		]),
	),
}).toEqual({
	depthStepper: { min: 0, max: 5 },
	nodeCapMin: 1,
	forceLayout: {
		centerPullStrength: { min: 0, max: 0.15, step: 0.01 },
		repelStrength: { min: 50, max: 1000, step: 10 },
		linkStrengthFactor: { min: 0.25, max: 4, step: 0.05 },
		linkGapPx: { min: 10, max: 250, step: 5 },
		collidePaddingPx: { min: 0, max: 100, step: 5 },
		elkNodeSpacingPx: { min: 10, max: 120, step: 5 },
		edgeRoutingClearancePx: { min: 6, max: 14, step: 1 },
	},
});
```
Again omits `outlineMaxDepth.min/max/step` (covered separately, see below).

### `describe("adapters derive from SETTINGS_SPEC")` (114-177)
6 tests, all currently passing, all mechanical-projection proofs:
- 115-125: `EngineDefaults.viewSettings()` toEqual an object built from
  `SETTINGS_SPEC.globalView.*.default` (this one DOES include `outlineMaxDepth`, line 118:
  `outlineMaxDepth: SETTINGS_SPEC.globalView.outlineMaxDepth.default`).
- 127-129: `EngineDefaults.depthSettings()` toEqual `{ outgoingDepth: 1, incomingDepth: 1 }`.
- 131-133: `EngineDefaults.nodeExclusionSettings()` toEqual `{ enabled: false, patterns: [] }`.
- 135-140: `sizingSettings()` called twice → deep-equal metrics but NOT the same object
  reference (defensive-copy proof).
- 142-150: `FORCE_LAYOUT_RANGES` mirrors `SETTINGS_SPEC.globalView.forceLayout`'s min/max/step
  for every field, via a `for...of Object.entries(...)` loop (i.e. genuinely exhaustive).
- 152-168: `DEFAULT_*` named constants (`DEFAULT_NODE_CAP`, `DEFAULT_OUTGOING_DEPTH`,
  `DEFAULT_INCOMING_DEPTH`, `DEFAULT_MIN_NODE_PX`, `DEFAULT_MAX_NODE_PX`,
  `DEFAULT_EDGE_VISIBILITY`) toEqual their literal shipped values.
- 170-176: view bound constants (`MIN_NODE_CAP`, `MIN_STEPPER_DEPTH`, `MAX_STEPPER_DEPTH`)
  toEqual `{ 1, 0, 5 }`.

### `describe("SettingsDefaults discoverability shim")` (179-183)
1 test: `SettingsDefaults.SPEC` `toBe` (reference identity) `SETTINGS_SPEC`.

### `describe("outline depth spec (CLARIFICATION Q1 + Q5)")` (185-206)
5 tests, ALL currently passing — this is where `outlineMaxDepth` IS pinned today, just not
inside the "exact shipped baseline" test:
- 186-188: `SETTINGS_SPEC.globalView.outlineMaxDepth.default` toBe `2`.
- 190-193: `{ min, max, step }` of that spec entry toEqual `{ min: 1, max: 6, step: 1 }`.
- 195-197: `clampOutlineMaxDepth(0)` toBe `MIN_OUTLINE_DEPTH`.
- 199-201: `clampOutlineMaxDepth(99)` toBe `MAX_OUTLINE_DEPTH`.
- 203-205: `clampOutlineMaxDepth(2.4)` toBe `2` (rounds).

Total: **15 tests** across 5 `describe` blocks in this one file.

## 2. `src/engine/SettingsSpec.ts` — shape

File doc (lines 1-17): declares itself the single source of truth for every default+limit;
"structure mirrors the persisted PluginData type shape ... NOT the settings-tab UI order."
Pure engine module (imports only `./types`).

Leaf shapes (27-48):
- `BoundedNumberSpec { default, min, max, step }` (all numbers).
- `MinBoundedNumberSpec { default, min }` (lower bound only, e.g. `nodeCap`).
- `DefaultSpec<T> { default: T }` (booleans/enums/unbounded numbers/lists/composites).

Section shapes (50-87):
- `DepthSpec { outgoingDepth: BoundedNumberSpec; incomingDepth: BoundedNumberSpec }`.
- `SizingSpec { metrics: Readonly<Record<SizeMetricId, DefaultSpec<SizingMetricSetting>>>;
  depthDecayK: DefaultSpec<number>; minPx: DefaultSpec<number>; maxPx: DefaultSpec<number> }`.
- `ForceLayoutSpec = Readonly<Record<keyof ForceLayoutSettings, BoundedNumberSpec>>`.
- `ViewSpec` (68-76) — **the type at the center of the bug**:
  ```ts
  export interface ViewSpec {
  	readonly nodeCap: MinBoundedNumberSpec;
  	readonly outlineMaxDepth: BoundedNumberSpec;
  	readonly nodePreviewPreference: DefaultSpec<NodePreviewPreference>;
  	readonly groupByFolder: DefaultSpec<boolean>;
  	readonly edgeVisibility: DefaultSpec<EdgeVisibilityMode>;
  	readonly sizing: SizingSpec;
  	readonly forceLayout: ForceLayoutSpec;
  }
  ```
  7 keys total; `outlineMaxDepth` is the 2nd declared key, right after `nodeCap`.
- `NodeExclusionSpec { enabled: DefaultSpec<boolean>; patterns: DefaultSpec<readonly string[]> }`.
- `SettingsSpec { globalDepths: DepthSpec; globalView: ViewSpec; nodeExclusion: NodeExclusionSpec }`.

Shared leaf constants (89-102): `DEPTH_STEPPER_BOUNDS = { min: 0, max: 5, step: 1 } as const`;
`DEFAULT_METRIC_WEIGHT = 1`.

`SETTINGS_SPEC` object literal (108-271) — values as of this checkout:
- `globalDepths`: `outgoingDepth`/`incomingDepth` each `{ default: 1, min: 0, max: 5, step: 1 }`.
- `globalView.nodeCap`: `{ default: 100, min: 1 }`.
- `globalView.outlineMaxDepth` (line 128): `{ default: 2, min: 1, max: 6, step: 1 }`.
- `globalView.nodePreviewPreference`: `{ default: "auto" }`.
- `globalView.groupByFolder`: `{ default: true }`.
- `globalView.edgeVisibility`: `{ default: "walked-from-center" }`.
- `globalView.sizing.metrics`: `own-file-size {enabled:true,weight:1}`, the other four
  (`total-linker-size`, `backlink-count`, `outlink-count`, `depth-decay`) all
  `{enabled:false,weight:1}`; `depthDecayK: {default:1}`; `minPx: {default:40}`;
  `maxPx: {default:160}`.
- `globalView.forceLayout` (7 fields, all `BoundedNumberSpec`):
  - `centerPullStrength: {default:0.05, min:0, max:0.15, step:0.01}`
  - `repelStrength: {default:300, min:50, max:1000, step:10}`
  - `linkStrengthFactor: {default:1, min:0.25, max:4, step:0.05}`
  - `linkGapPx: {default:40, min:10, max:250, step:5}`
  - `collidePaddingPx: {default:50, min:0, max:100, step:5}`
  - `elkNodeSpacingPx: {default:40, min:10, max:120, step:5}`
  - `edgeRoutingClearancePx: {default:11, min:6, max:14, step:1}`
- `nodeExclusion`: `enabled: {default:false}`, `patterns: {default:[]}`.

No `defaultsFrom`/`buildDefaults` projection helper exists inside `SettingsSpec.ts` itself —
the spec is a pure static data literal with no derivation logic.

### `ViewSettings` type (`src/engine/types.ts:297-311`)
```ts
export interface ViewSettings {
	readonly nodeCap: number;
	readonly outlineMaxDepth: number;
	readonly nodePreviewPreference: NodePreviewPreference;
	readonly groupByFolder: boolean;
	readonly edgeVisibility: EdgeVisibilityMode;
	readonly sizing: SizingSettings;
	readonly forceLayout: ForceLayoutSettings;
}
```
Same 7 keys, same order, as `ViewSpec` in `SettingsSpec.ts` (68-76) — the spec type
deliberately mirrors the resolved-settings type field-for-field. `outlineMaxDepth: number`
doc comment (300-304): "Deepest markdown heading level a node's outline renders (1–6). A
view-layer knob: the engine carries it, the view's mapping applies it."
`nodePreviewPreference: NodePreviewPreference` (168 in same file): `"auto" | "outline" |
"image"`.

## 3. Existing spec-to-defaults projection helper

`src/engine/constants.ts:120-174`, class `EngineDefaults` — this IS the projection helper,
and it DOES cover `outlineMaxDepth` correctly:
```ts
export class EngineDefaults {
	static depthSettings(): DepthSettings { ... }
	static sizingSettings(): SizingSettings { ... }
	static nodeExclusionSettings(): NodeExclusionSettings { ... }
	static forceLayoutSettings(): ForceLayoutSettings { ... }
	static viewSettings(): ViewSettings {
		const view = SETTINGS_SPEC.globalView;
		return {
			nodeCap: view.nodeCap.default,
			outlineMaxDepth: view.outlineMaxDepth.default,
			nodePreviewPreference: view.nodePreviewPreference.default,
			groupByFolder: view.groupByFolder.default,
			edgeVisibility: view.edgeVisibility.default,
			sizing: EngineDefaults.sizingSettings(),
			forceLayout: EngineDefaults.forceLayoutSettings(),
		};
	}
}
```
`SettingsSpec.test.ts` DOES use `EngineDefaults.viewSettings()` in the "adapters derive from
SETTINGS_SPEC" describe block (test at 115-125) — and that test correctly includes
`outlineMaxDepth`. But the "exact shipped baseline" test (the one with the bug) does NOT call
`EngineDefaults.viewSettings()`; it independently re-derives the same projection by hand from
`SETTINGS_SPEC.globalView` fields, duplicating `EngineDefaults`'s logic and drifting from it.
`SettingsDefaults.ts` (the discoverability shim, `src/engine/SettingsDefaults.ts`) only
re-exports `SETTINGS_SPEC` and a `SettingsDefaults.SPEC` pointer — no projection logic there.

There is no generic "every spec key → default value" helper (e.g. no `mapValues`/`deepDefaults`
utility) anywhere in `src/engine/` that the test could call to auto-derive the expected side
too — `EngineDefaults.viewSettings()` returns actual resolved `ViewSettings`, useful as the
"actual" side of a comparison, but the test would still need SOME hand-written expected
literal to pin the values; the missing piece is that the CURRENT hand-written actual-side
projection at lines 30-53 leaves out one `ViewSpec` key rather than iterating
`Object.keys(SETTINGS_SPEC.globalView)`.

## 4. TypeScript strictness / exhaustiveness idioms

`tsconfig.json` (repo root): `"strict": true`, `"noImplicitReturns": true`,
`"noFallthroughCasesInSwitch": true`, `"noUncheckedIndexedAccess": true`,
`"isolatedModules": true`, `"skipLibCheck": true`, target `ES2021`, module `ESNext`. No
`exactOptionalPropertyTypes`. `noUncheckedIndexedAccess: true` means any `Record<K,V>`/array
index access types as `V | undefined`, which is relevant if a downstream fix indexes
`SETTINGS_SPEC.globalView[key]` dynamically (the value must be narrowed/asserted before use).

Existing exhaustiveness idioms in the repo (no `assertNever` helper found anywhere in
`src/`):
- `src/engine/types.ts:175-188` — a "value list + compile-time completeness check" idiom used
  for `NodePreviewPreference`:
  ```ts
  export const NODE_PREVIEW_PREFERENCES = [
  	"auto",
  	"outline",
  	"image",
  ] as const satisfies readonly NodePreviewPreference[];

  type UnlistedPreference = Exclude<NodePreviewPreference, (typeof NODE_PREVIEW_PREFERENCES)[number]>;
  export const _assertEveryNodePreviewPreferenceListed: UnlistedPreference extends never ? true : UnlistedPreference =
  	true;
  ```
  Pattern: declare the array `as const satisfies readonly T[]`, then compute
  `Exclude<T, arrayElementUnion>` and assign it to a `const` typed as
  `X extends never ? true : X` — if the exclude type is non-empty, the assignment of literal
  `true` fails to typecheck against the widened union, and the error message names the
  missing member.
- `src/view/forceLayoutFieldMeta.ts:59, 65` — two more `as const satisfies readonly (keyof
  ForceLayoutSettings)[]` array literals (order-listing idiom, no exclude-guard follow-up
  visible in the grep hit but same base pattern).
- `src/view/settingsResetPlan.ts:186, 189` — `as const satisfies readonly
  SettingsResetScope[]` and `"all" satisfies SettingsResetScope`.
- `src/adapters/resolvePinnedDescriptors.ts:8` (doc comment only, mentions "structurally
  satisfies").

So the established repo idiom for "this literal must cover every member of a union/every key
of a type" is `as const satisfies readonly T[]` plus (optionally) an `Exclude<...> extends
never ? true : Unlisted` compile-time assertion constant — this is the closest existing
precedent to reuse for guarding `SETTINGS_SPEC.globalView`'s key set at compile time, e.g. by
asserting the hand-written expected object's key set (or a `keyof ViewSpec` array) is complete
against `ViewSpec`. There is no existing `Record<keyof ViewSpec, ...>`/`satisfies
Record<keyof ViewSpec, unknown>` usage in the repo to copy verbatim — the two closest
precedents are the union-array-plus-exclude-guard above and plain `Object.entries(...).map()`
runtime projections already used within this same test file (for `sizing.metrics` and
`forceLayout`, see §1) as a RUNTIME (not compile-time) exhaustiveness technique — extending
that `Object.entries` style to the top-level `ViewSpec` fields (not just its nested
sub-objects) would also close the gap without introducing new compile-time machinery, at the
cost of that then requiring a hand-maintained expected literal keyed the same way (which is
exactly what already exists).

## 5. Test run status

Command: `npx vitest run src/engine/SettingsSpec.test.ts` (output also saved to
`.tmp/settings-spec-test.txt` inside the repo).

Result: **all 15 tests in the file PASS**, 1 test file, 0 failed.
```
 Test Files  1 passed (1)
      Tests  15 passed (15)
```
This includes the "exact shipped baseline" defaults test (28-83) and the limits test
(85-111) — both green as currently written (they are green precisely BECAUSE they omit
`outlineMaxDepth`, not despite it; they are internally consistent, just non-exhaustive).

Cross-check against the "known-RED `linkStrengthFactor.max`" note in the task: as currently
checked out, `SETTINGS_SPEC.globalView.forceLayout.linkStrengthFactor.max` is `4`
(`SettingsSpec.ts:200`) and the limits-baseline test's expected literal for that field is also
`{ min: 0.25, max: 4, step: 0.05 }` (`SettingsSpec.test.ts:104`) — they already match, so this
specific assertion is NOT currently red on this checkout. This matches the ticket's own
"OPEN — narrowed to 1 assertion" framing being about `linkStrengthFactor.max: 2` (test) vs `4`
(spec) — that mismatch is not present in the file as it exists right now, i.e. it appears to
have already been fixed since the ticket was filed (see §6; do not touch this regardless, per
task instructions — it is out of scope either way since it's not currently failing).

## 6. Ticket summaries

### `docs-internal/tickets/ticket-settings-spec-baseline-tests-stale-after-node-spacing-bump.md`
**Status: CLOSED** (resolved on branch `settings`, "settings restore-defaults round,
iteration 1"). Root cause: commit `22bd5cb` ("Adjust node spacing defaults and increase one
of the max in settings") changed `SETTINGS_SPEC.globalView.forceLayout.collidePaddingPx`
default `20 → 50` and its `max` `80 → 100` without re-pinning the three tests that assert the
shipped baseline (`SettingsSpec.test.ts` defaults + limits tests, and
`forceLayoutSettings.test.ts`'s "...ticket-03 shipped layout constants" test). Resolution: a
human confirmed the bump was intentional, so the baselines were realigned to the shipped spec
(not reverted): `collidePaddingPx: 50` / `max: 100`, and `linkGapPx.max: 250` (also stale from
the same commit) in `SettingsSpec.test.ts`; matching update in `forceLayoutSettings.test.ts`;
and the `collidePaddingPx`/`linkGapPx` doc comments in `SettingsSpec.ts` were brought back in
sync. Ticket states `npm test` was fully green afterward (769 passed, 0 failed).

### `docs-internal/tickets/ticket-settings-baseline-tests-stale-after-spacing-change.md`
**Status: OPEN** — "pre-existing test failure, now narrowed to 1 assertion." Same root-cause
commit `22bd5cb`; explains that a follow-up commit `a6668b5` re-pinned the DEFAULTS block only,
leaving the LIMITS block behind. Explicitly cross-references the CLOSED sibling ticket above
(same root cause, filed independently on two branches — `settings` and `node-outline` — before
they merged). The single remaining claimed failure:
`SettingsSpec.test.ts` › "...its limits equal the exact shipped baseline" ›
`forceLayout.linkStrengthFactor.max` — test expects `2`, spec actually has `4`. The ticket
explicitly declines to fix this in passing ("re-pinning a baseline is a statement that the new
value is the intended shipped limit... that is the author's call") and lists the fix as: (1) a
human/dev-vault confirmation that `max: 4` is the intended shipped limit, (2) update that one
assertion. Acceptance: `npm test` green with no assertion loosened (exact value, not a range).
**As observed in this checkout (§5), this specific mismatch is NOT currently present** — the
test file already has `max: 4` at line 104, matching the spec's `max: 4` at
`SettingsSpec.ts:200`. This ticket appears stale/already-resolved on the current branch,
independent of the `outlineMaxDepth` bug this exploration is scoped to. Per task instructions,
this ticket's item is explicitly OUT OF SCOPE for the fix being planned here — do not touch
`linkStrengthFactor.max` regardless of its current state.

## Summary for the implementer

The concrete, minimal-diff fix target is `src/engine/SettingsSpec.test.ts` lines 28-83 (and
optionally the parallel limits test 85-111 for consistency): add `outlineMaxDepth` to both the
actual-side projection and the expected `toEqual` literal (default `2`; limits `{min:1, max:6,
step:1}`), AND close the "silently omits a field" hole per the ticket's acceptance criterion 2
— e.g. by switching the top-level `ViewSpec` fields to a generic `Object.entries(view)`-style
projection (matching the pattern already used for `view.sizing.metrics` and `view.forceLayout`
in the same test), or by adding a compile-time exhaustiveness guard modeled on the
`NODE_PREVIEW_PREFERENCES`/`_assertEveryNodePreviewPreferenceListed` idiom in
`src/engine/types.ts:175-188` keyed off `keyof ViewSpec`. `EngineDefaults.viewSettings()`
(`src/engine/constants.ts:162-173`) already correctly includes `outlineMaxDepth` and can serve
as a reference/cross-check but is a runtime resolver, not itself a compile-time guard.
