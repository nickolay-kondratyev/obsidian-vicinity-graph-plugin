# Settings row accessors — PUBLIC

Ticket `nid_uppprbbqursr6awuoevoqpah1_e`: move each control kind's `{value read, range,
interaction}` out of the two presenters and into the row model, leaving both presenters
as markup plus one call.

## Design decision: a SIBLING module

**`src/view/settingsRowAccessors.ts`**, not `settingsRows.ts`.

Rationale (both reasons independently sufficient):

1. **SRP.** `settingsRows.ts` answers "what rows exist, how are they worded, ordered,
   grouped and named". The accessor answers "where does this row's value live, which
   bounds does it move between, which write moves it". Different reasons to change.
2. **e2e import graph.** `e2e/settingsBaseline.ts` imports `SETTINGS_GROUPS` from
   `settingsRows.ts` in the node-side Playwright process. Today that module pulls in only
   copy tables. The accessor needs `SETTINGS_SPEC`, `SIZING_RANGES`,
   `FORCE_LAYOUT_RANGES`, `MIN_NODE_CAP`, `clampOutlineMaxDepth`, `clampSizingNumber`,
   `parseSizingInput` and the depth clamp. All of that is pure TS (no `obsidian`, no
   `react`) so putting it in `settingsRows.ts` *would* have worked — the choice is
   deliberate, not forced: nothing in e2e needs accessors, so the engine runtime graph
   stays out of the module e2e imports.

The `settingsRows.ts` module doc now states this boundary explicitly.

## What the accessor exposes

```ts
interface SettingsValueAccessor<T> { read(state): T; interaction(value: T): SettingsInteraction }
interface SettingsNumberAccessor extends SettingsValueAccessor<number> {
  readonly bounds: SettingsRowBounds;      // { min; max?; step }
  settlesAt(value: number): number;        // what the write path will actually STORE
}
interface SettingsTrackAccessor extends SettingsNumberAccessor {
  readonly bounds: SettingsRowClosedBounds; // `max` REQUIRED — sliders and the depth stepper
}
interface SettingsTypedNumberAccessor extends SettingsNumberAccessor {
  accept(raw: string): number | undefined; // what counts as a typed value
}
```

`SettingsRowAccessors` is a static class with one factory per control (ten, because
`sizing-metric` is two controls: `metricEnabled` + `metricWeight`).

Two deliberate calls inside it:

- **`bounds.max` is optional.** The node cap is declared `min`-only in `SETTINGS_SPEC`
  (a `MinBoundedNumberSpec`); inventing a ceiling would have been a behavior change. A
  control that must place a value on a TRACK takes `SettingsTrackAccessor` instead, whose
  bounds are closed — so a slider on a max-less field is a compile error (iteration 1, #3).
- **`interaction(value)` emits `settlesAt(value)`.** Previously the tab clamped inside
  the interaction (depth, outline) while the panel clamped only its optimistic display.
  Now the value written and the value shown are the same number by construction. No
  user-visible change: the clamps are idempotent with the ones the pipeline/stepper
  already applied, and the affected controls are range inputs that cannot leave their
  bounds anyway.

## Duplication removed

- `NODE_CAP_STEP` — was declared in **both** presenters; now one private constant in the
  accessor module (the spec gives `nodeCap` no step, so it has no engine home).
- `OUTLINE_DEPTH_SLIDER_STEP` — was declared in both presenters; gone, the accessor reads
  `SETTINGS_SPEC.globalView.outlineMaxDepth` for min/max/step at once.
- `DEPTH_SLIDER_STEP` (tab-only literal `1`) — gone, read from the depth field's spec leaf.
- Per-kind `state.globalX...` reads, range-table lookups, clamps and interaction literals
  — all now single-homed.
- The node-cap "integer ≥ MIN_NODE_CAP" rule was written twice (with a comment in the
  panel saying "same rule the settings tab's row applies"); now one `accept`.

The tab's slider builder collapsed: `addDepthSlider` / `addOutlineDepthSlider` /
`addForceLayoutSlider` are gone, replaced by `addSlider(container, row, accessor, state)`
called directly from the dispatch arms. The panel's `SliderRow` / `NumberRow` now take an
accessor + state instead of six props, via the `useSettingsValue` / `useSettingsNumber`
hooks that wire the accessor to the shared pipeline.

`DepthStepper` takes the depth accessor itself, so its track, its step and its clamp are one
object. Each depth row reads its OWN spec leaf for both bounds AND clamp rather than
`linkDepthOut`'s for all three — identical today (all three declare `DEPTH_STEPPER_BOUNDS`),
and now consistent by construction rather than by coincidence (iteration 1, #1).

## Tests

- **New** `src/view/settingsRowAccessors.test.ts` (10 tests), driven off
  `EVERY_SETTINGS_ROW` with a `switch` closed by `unhandledRowControl` — **a new control
  kind cannot reach the file without saying which accessors it uses**. Properties:
  read→interaction→`planSettingsWrite`→read returns what was written (identity and a new
  value); a numeric accessor handed a value beyond its bounds stores exactly what
  `settlesAt` promised; typed rows accept nothing half-typed; plus three non-vacuity
  guards. Verified it bites: pointing `sizingNumber.read` at the wrong field fails 3 of 9.
- **Strengthened, not weakened** `settingsRowParity.test.ts`: added one source-scan test
  asserting neither presenter names any `ACCESSOR_OWNED_SYMBOL` (`SETTINGS_SPEC`,
  `SIZING_RANGES`, `FORCE_LAYOUT_RANGES`, `MIN_NODE_CAP`, the outline/stepper bounds, the
  three clamps, `parseSizingInput`) — i.e. a presenter that starts re-deriving fails. All
  pre-existing parity assertions untouched.
- `settingsRowSpecCoverage.test.ts` and `settingsProductDefaults.test.ts` untouched.

## Status (after iteration 1)

- `npm test` → **93 files, 1230 tests, all passing**.
- `npm run check` → **exit 0** (tsc strict for `src/` and `e2e/`).
- `npm run test:e2e` NOT run (needs a real Obsidian; release gate).

## Files touched (repo-relative)

- `src/view/settingsRowAccessors.ts` — new, the accessor module.
- `src/view/settingsRowAccessors.test.ts` — new, the accessor contract suite.
- `src/view/VicinityGraphSettingTab.ts` — arms read from accessors; `applyRange` →
  `applyBounds`; three slider builders collapsed into one.
- `src/view/SettingsRowView.tsx` — `useSettingsValue` / `useSettingsNumber`;
  `SliderRow`/`NumberRow` take an accessor; every row component is now one call.
- `src/view/DepthStepper.tsx` — takes the depth accessor.
- `src/view/settingsRows.ts` — module doc states the accessor boundary (no code change).
- `src/view/settingsRowParity.test.ts` — one added guard.

(Iteration 1 touched more; see its own file list at the end.)

---

# Iteration 1 response

Every finding evaluated on its merits. **All six were ACCEPTED** — none was
over-engineering, and each named a real defect or a real hole. Details and the
verification for each:

## #1 Depth accessor paired per-field bounds with a field-agnostic clamp — ACCEPTED

The reviewer is right, and this one was mine: I introduced per-field `bounds` and called
it "strictly more correct" while leaving the clamp hard-wired to `linkDepthOut`. Since
`planSettingsWrite` stores a `global-depth` verbatim, that clamp is the ONLY clamp, so
the two must come from one leaf.

Changed:
- `clampStepperDepth` is **gone from `src/view/constants.ts`**. The depth clamp is now
  `clampDepthInto(bounds, value)`, private to `settingsRowAccessors.ts` and applied to the
  accessor's OWN `bounds` — one source per field. Behavior identical (same rounding, same
  NaN propagation, and the depth leaves are exactly the ones `settingsSpecBounds.test.ts`
  excludes from the engine's NaN-resolving rule).
- `DepthStepper` now takes the whole `SettingsTrackAccessor` instead of `bounds` + its own
  `clampStepperDepth` import, so bounds/step/clamp arrive as one object and cannot mismatch.
- `clampStepperDepth.test.ts` → **renamed** `settingsRowDepthClamp.test.ts`. Every one of
  its six assertions is preserved verbatim (same inputs, same expected numbers), retargeted
  at `SettingsRowAccessors.depth("linkDepthOut").settlesAt`. The clamp MOVED; nothing was
  removed or relaxed.
- Its second describe is new and is the guard the reviewer asked for: for EVERY declared
  depth row, both endpoints of the track it offers must survive its own clamp.
  **Mutation-verified**: making the clamp use `bounds.max - 1` fails 3 tests, one per depth
  field ("linkDepthOut: offers 5, clamp moves it to 4").
- `optimisticValue.test.ts` (the stepper simulation) and the
  `BOUNDS_ENFORCED_OUTSIDE_THE_ENGINE` allowlist prose in `settingsSpecBounds.test.ts` both
  now name the accessor. The allowlist entries are prose, not scanned — no guard weakened.

## #2 The `settlesAt` assertion was tautological for the clamping accessors — ACCEPTED

Correct: for depth/outline/sizing/weight, `interaction()` applies `settlesAt` itself, so
that assertion only proves the pipeline adds no FURTHER clamp — real for `nodeCap` and
`forceLayout`, vacuous for the rest, and my docblock oversold it.

Changed:
- The docblock now states plainly which accessors the assertion bites for and which it
  holds by construction for.
- **New assertion that does bite on a clamper**: a value beyond the bounds must settle
  either INSIDE those bounds (the accessor clamps) or VERBATIM (it does not) — there is no
  lawful third answer, and a clamp aimed at some other field's bounds gives exactly that
  third answer. Plus a non-vacuity test asserting both lawful arms are actually exercised
  by the shipped accessors, so the pair cannot degenerate into "everything is identity".
  **Mutation-verified**: a `forceLayout` clamp returning `max + 1` fails 6 tests.

I did not take suggestion (b) (round-tripping through the persistence parser): it would
pull the persistence layer into a view suite to assert a *load-path* property that
`settingsSpecBounds.test.ts` already owns per bounded leaf.

## #3 Optional `bounds.max` diverged between the presenters — ACCEPTED

Honest assessment as asked: **not reachable today** — every slider-backed row (depth,
outline depth, force layout) is on a field with a declared `max`, and the only max-less
field (node cap) is a number input on both surfaces. So this was latent, not live.

But the reviewer is right that requiring `max` is the simpler correct model, and my comment
claiming it "is not expressible in this type" was simply wrong. Two different silent wrong
behaviours for one mistake (an immovable `setLimits(min, min)` vs. a native range input
quietly defaulting `max` to 100) is worse than one compile error, in a repo that states a
preference for compile-time checks.

Changed: added `SettingsRowClosedBounds` (`max: number`) and `SettingsTrackAccessor`
(a numeric accessor whose bounds are closed). `depth()` / `outlineDepth()` / `forceLayout()`
return it; the tab's `addSlider`, the panel's `SliderRow` and `DepthStepper` require it. The
`?? min` fallback, the `max !== undefined` branch and both apologetic comments are gone.
**Verified**: passing `nodeCap()` to `addSlider` is now
`error TS2345: Argument of type 'SettingsTypedNumberAccessor' is not assignable to parameter of type 'SettingsTrackAccessor'`.

Named "track" rather than "slider" because the panel renders a depth as a *stepper*, and it
needs the ceiling for the same reason.

## #4 `SizingRowWrite` still spelled the interaction literal — ACCEPTED

The reviewer is right that my `capNotice` justification does not hold: `capNotice` takes the
TYPED value as its own parameter, so clamping the returned interaction cannot disturb it.
`interactionIfAccepted` now returns `SettingsRowAccessors.sizingNumber(field).interaction(value)`.

I did NOT take the constructor-injection form suggested. `SettingsRowAccessors` is a static
factory over declared data, not a collaborator needing inversion; DI here would add a
constructor parameter and churn every test's construction to buy nothing testable. A direct
call keeps the class's own tests untouched (they assert in-range values, which the clamp
leaves alone) and still leaves the literal spelled once.

## #5 `useSettingsValue`'s optional `settlesAt` is a foot-gun — ACCEPTED

Added `useSettingsNumber(accessor, state)`, which always passes `accessor.settlesAt`.
`useSettingsValue` lost the optional parameter entirely, so the non-numeric kinds have
nothing to forget and the three hand-passing call sites are gone.

## #6 The accessor scan covered only the two presenter files — ACCEPTED

It now iterates `EVERY_ROW_RENDERING_MODULE`, and `DepthStepper.tsx` joins that set via a
new `ROW_CONTROL_COMPONENTS` table (a component a presenter delegates one control kind to
renders a declared row just as much as the presenter that mounts it). This is only possible
because #1 removed `DepthStepper`'s legitimate `clampStepperDepth` use — the ordering the
reviewer predicted.

## #7 Ticket / change_log close-out — NOT MINE

Left to the coordinator, per explicit instruction. Nothing here is un-ticketed: all six
findings are fixed in this iteration, so there is no follow-up to file.

## Documentation

- `CLAUDE.md` — new "Settings values" bullet beside "Settings rows": the accessor is the
  single home of the value half, a presenter never names an engine range table or clamp
  (with the guard named), `interaction()` emits `settlesAt(value)`, bounds and clamp come
  from the same spec leaf, and `SettingsTrackAccessor` makes a max-less slider a compile
  error.
- `docs-internal/architecture-map.md` — `view/settingsRowAccessors.ts` added to the
  `src/view/` responsibility map, directly under `view/settingsRows.ts`, with its three
  guards named.

## Files touched in iteration 1

- `src/view/settingsRowAccessors.ts`, `src/view/settingsRowAccessors.test.ts`
- `src/view/settingsRowDepthClamp.test.ts` (renamed from `src/view/clampStepperDepth.test.ts`)
- `src/view/constants.ts` (clamp removed + a pointer comment), `src/view/DepthStepper.tsx`
- `src/view/SettingsRowView.tsx`, `src/view/VicinityGraphSettingTab.ts`, `src/view/sizingRowWrite.ts`
- `src/view/settingsRowParity.test.ts`, `src/view/optimisticValue.test.ts`
- `src/engine/settingsSpecBounds.test.ts` (allowlist prose only)
- `CLAUDE.md`, `docs-internal/architecture-map.md`
