# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE (working notes)

## Plan

**Goal**: settings tests ITERATE the spec leaves instead of restating literals; keep a
curated literal set for product-meaningful defaults; verify (not rebuild) the parity test.

**Steps**
1. NEW test-support module `src/engine/testFixtures/settingsSpecLeaves.ts` — flat walk over
   `SETTINGS_SPEC` (leaf = a spec node carrying `default`), with path/id/default/bounds,
   read/write/delete helpers over the 3-slice settings root, and a per-leaf ALTERNATE
   (non-default) value generator that THROWS naming a leaf it cannot serve.
2. Rewrite `src/engine/SettingsSpec.test.ts` → structural (spec invariants + adapter
   projection built from the walk). Delete the two giant `toEqual` literal blocks and the
   `EverySpecField`/`SpecLimitsBaseline` compile machinery they needed.
3. NEW `src/engine/settingsSpecBounds.test.ts` — every BOUNDED leaf has exactly one declared
   enforcer (engine clamp) or a declared reason it is enforced elsewhere; each enforcer
   clamps below-min → min, above-max → max, NaN → default.
4. NEW `src/engine/settingsProductDefaults.test.ts` — the CURATED literal set (one place,
   documented WHY).
5. Rewrite `src/engine/forceLayoutSettings.test.ts` — drop the 7-field literal `toEqual`
   (structural claims + the anti-collapse invariant stay).
6. NEW `src/persistence/settingsSpecPersistence.test.ts` — per-leaf parse / round-trip /
   missing→default / garbage→default.
7. NEW `src/view/settingsResetSpecCoverage.test.ts` — every leaf resets to its default under
   the "all" scope; every leaf has exactly one section home; each section reset restores its
   own leaves and touches nothing else.
8. Verify GOAL 2 (`settingsRowParity.test.ts`) rather than rebuild it.
9. Prove each structural test can actually fail (temporary spec field + temporary wiring
   breaks), then revert.

## Findings that shaped the design

- Leaf detection: a spec node is a LEAF iff it has an own `default` key. Handles
  `sizing.metrics.<id>` (object default) and stops before recursing into it.
- `globalView.sizing.metricWeight` is a BOUNDS-ONLY leaf: no `SizingSettings` counterpart
  (it declares the bounds shared by every metric's weight). Declared as an exception list
  with a test that every id in it is a real spec leaf, so the exception cannot rot.
- Alternate value rule for numbers: use `bounds.min`, falling back to `bounds.max`.
  Verified EVERY bounded leaf's `min` differs from its `default`, so this is always a real
  alternate, always in range, and always an exact JSON number (no float noise from
  `default + step`).
- Garbage sentinel: ONE string sentinel is wrong for every leaf type at once (number →
  `numberOrUndefined` undefined; boolean → not boolean; array → not array; metric object →
  not a record; `nodePreviewPreference` → unrecognized). So a single test covers all leaves.
- `nodeCap` is NOT clamped on load, and that is PINNED behavior:
  `persistedShapes.test.ts:279` "WHEN a persisted view stores nodeCap zero THEN the zero
  survives (a real value, not an absence)". I did NOT change it (guardrail: no silent
  behavior change, no deleting behavior-capturing tests). Classified as
  bounds-enforced-at-the-input with a WHY + a follow-up `decide` ticket.
- Depth bounds (0..5) are deliberately NOT enforced on load either (spec says the stepper
  bound is an affordance; the engine honours any depth). Enforcer = `clampStepperDepth`
  (view layer, already covered by `src/view/clampStepperDepth.test.ts`).
- Bounds are asserted ONCE, at the clamp-function level (engine), NOT again on the parse
  path — `persistedShapes.test.ts` already has the per-family load-clamp behavior tests.
- Layering: the walk lives in `src/engine/testFixtures/` (precedent: `denseVaultFixtures.ts`,
  `truncationHarness.ts`), so persistence and view tests may import it (both already depend
  on the engine); the engine never imports them.

## Rehydration pointers

- `EVERY_SETTINGS_SPEC_LEAF` / `SETTINGS_FIELD_LEAVES` / `alternateSettingsRoot()` are the
  three symbols every new test hangs off.
- If a new settings field is added: declare it in `SETTINGS_SPEC`, and the four spec-iterating
  suites cover it automatically. If its type is exotic (not number/boolean/string-enum/array/
  metric-setting), `alternateLeafValue` returns `undefined` and `alternateSettingsRoot()`
  throws naming the leaf — that is the intended prompt to teach the generator about it.
