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
   `clampStepperDepth`, `parseSizingInput`. All of that is pure TS (no `obsidian`, no
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
interface SettingsTypedNumberAccessor extends SettingsNumberAccessor {
  accept(raw: string): number | undefined; // what counts as a typed value
}
```

`SettingsRowAccessors` is a static class with one factory per control (ten, because
`sizing-metric` is two controls: `metricEnabled` + `metricWeight`).

Two deliberate calls inside it:

- **`bounds.max` is optional.** The node cap is declared `min`-only in `SETTINGS_SPEC`
  (a `MinBoundedNumberSpec`); inventing a ceiling would have been a behavior change. The
  consequence is that a *slider* row is only sound on a field that has a max — true of
  every slider-backed kind declared today, not expressible in the type; documented at
  both call sites.
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
accessor + state instead of six props, via a new `useSettingsValue` hook that wires the
accessor to the shared pipeline.

`DepthStepper` now takes `bounds` instead of importing `MIN/MAX_STEPPER_DEPTH`, and steps
by `bounds.step`. Note: each depth row now reads its OWN spec leaf rather than
`linkDepthOut`'s for all three — identical today (all three declare `DEPTH_STEPPER_BOUNDS`),
strictly more correct going forward.

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

## Deliberately NOT changed

`SizingRowWrite.interactionIfAccepted()` still builds its own
`{kind: "global-sizing-number", …}`. It is the sizing row's *write policy* object (bounds
feedback, cross-field rule, deferred re-judge), not a presenter, and routing it through
the accessor would have moved the clamp ahead of its own `capNotice` reasoning. Called out
so a reviewer knows it was seen; a follow-up if it ever drifts.

## Status

- `npm test` → **93 files, 1227 tests, all passing** (was 92 / 1217).
- `npm run check` → **exit 0** (tsc strict for `src/` and `e2e/`).
- `npm run test:e2e` NOT run (needs a real Obsidian; release gate).

## Files touched (repo-relative)

- `src/view/settingsRowAccessors.ts` — new, the accessor module.
- `src/view/settingsRowAccessors.test.ts` — new, the accessor contract suite.
- `src/view/VicinityGraphSettingTab.ts` — arms read from accessors; `applyRange` →
  `applyBounds`; three slider builders collapsed into one.
- `src/view/SettingsRowView.tsx` — `useSettingsValue`; `SliderRow`/`NumberRow` take an
  accessor; every row component is now one call.
- `src/view/DepthStepper.tsx` — takes `bounds`.
- `src/view/settingsRows.ts` — module doc states the accessor boundary (no code change).
- `src/view/settingsRowParity.test.ts` — one added guard.
