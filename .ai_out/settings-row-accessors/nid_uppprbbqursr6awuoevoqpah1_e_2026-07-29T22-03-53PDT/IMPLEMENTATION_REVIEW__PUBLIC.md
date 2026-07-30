# Implementation review — settings row accessors (`nid_uppprbbqursr6awuoevoqpah1_e`)

> **Final verdict: READY** (see "Iteration 1 verification" at the end — all six findings
> fixed and independently verified on commit `37daba9`).

Reviewed: commit `ef5f163` + working tree (tree is clean, nothing uncommitted).

## Verified myself

- `npm test` → **93 files, 1227 tests, exit 0**.
- `npm run check` → **exit 0** (`tsc -noEmit` for `src/` and `e2e/`).
- No `sanity_check.sh` in this repo.
- `settingsRowSpecCoverage.test.ts` and `settingsProductDefaults.test.ts` untouched by the
  commit; `settingsRowParity.test.ts` only GAINED a test. No behaviour-capturing test removed,
  no anchor point touched.

## Summary

Both presenters previously re-derived, per control kind, the value read, the range lookup, the
clamp and the `SettingsInteraction`. `src/view/settingsRowAccessors.ts` now owns all four behind
`{read, bounds, settlesAt, interaction}` (+ `accept` on typed rows). The tab's three slider
builders collapse to one; the panel's row components are one call each. The design call (a
SIBLING module, not `settingsRows.ts`) is correct and correctly justified — layering holds
(`view → engine`, nothing new in `src/engine/`), and `e2e/settingsBaseline.ts` still imports only
the pure-data `settingsRows.ts`.

### Behavior preservation — checked, not taken on faith

The "`interaction()` now emits the clamped value, and that is behavior-neutral" claim **holds**.
Traced per kind:

- `global-sizing-number` / `global-sizing-metric-weight`: `planSettingsWrite` routes both through
  `sizingCommand` → `clampSizingSettings`, which clamps `minPx`/`maxPx`/`depthDecayK` AND every
  metric weight (`src/engine/constants.ts:216`). Clamping in `interaction()` is idempotent with
  it — same stored number.
- `global-depth`: `planSettingsWrite` stores verbatim, but the tab already clamped inside its
  interaction and the panel's `DepthStepper` already clamped before calling `onChange`. No change.
- `global-outline-depth`: tab already clamped in the interaction; the panel's control is a range
  input that cannot leave its bounds. No change.
- `global-cap` / `global-force-layout-field`: `settlesAt` is identity — no new clamp introduced.

Bounds/step/a11y-name equivalence also checked: `SETTINGS_SPEC.globalDepths[field]` is
`DEPTH_STEPPER_BOUNDS {0,5,1}` for all three depth fields, identical to the old
`MIN/MAX_STEPPER_DEPTH` + literal `1`; `MIN/MAX_OUTLINE_DEPTH` are literally projections of the
same spec leaf; `applyBounds` still omits `max` for the max-less node cap; the sizing row's seed
changed from `write.storedValue()` to `accessor.read(state)`, and `rowState()` reads the same
store inside the same synchronous `display()` pass, so it is the same number.

**No user-visible change found.** Duplication is genuinely gone: `NODE_CAP_STEP` is one private
constant, `OUTLINE_DEPTH_SLIDER_STEP` and `DEPTH_SLIDER_STEP` are gone entirely, and the new
`ACCESSOR_OWNED_SYMBOLS` scan makes re-derivation in either presenter a test failure.

## 🚨 CRITICAL Issues

None.

## ⚠️ IMPORTANT Issues

### 1. The depth accessor pairs PER-FIELD bounds with a FIELD-AGNOSTIC clamp
`src/view/settingsRowAccessors.ts:102-109`, `src/view/constants.ts:252`, `src/view/DepthStepper.tsx:2,55,69`

`depth(field)` takes `bounds` from `SETTINGS_SPEC.globalDepths[field]` (the report sells this as
"strictly more correct going forward") but `settlesAt`/`interaction` use `clampStepperDepth`,
which is hard-wired to `linkDepthOut`'s min/max (`src/engine/constants.ts:62-63`). The moment any
depth leaf declares different bounds, the two disagree silently: the slider/stepper offers a
range the write path clamps away, and `planSettingsWrite` for `global-depth` stores verbatim, so
the view clamp is the *only* clamp. `DepthStepper` makes it worse — it now takes `bounds` for the
disabled-state and the step size, but still imports `clampStepperDepth` for the value it emits.

The new accessor suite cannot catch this: it asserts `stored === settlesAt(requested)`, and since
`interaction()` applies `settlesAt` itself, both sides move together.

Suggested fix: derive the clamp from the same leaf as the bounds, e.g.
`settlesAt: (v) => Math.min(bounds.max, Math.max(bounds.min, Math.round(v)))` (or a shared
`clampIntoBounds(bounds, v)` helper), and pass `accessor.settlesAt` into `DepthStepper` instead of
its `clampStepperDepth` import — then bounds and clamp have exactly one source per field.
`clampStepperDepth` and its test can stay for the non-row callers, or be re-expressed over
`linkDepthOut`'s bounds.

### 2. "`settlesAt` promises what the write path stores" is tautological for the clamping accessors
`src/view/settingsRowAccessors.test.ts:200-213` (doc claim at lines 14-24)

The suite's stated value is catching "promising a clamp the pipeline does not apply". But for
`depth`, `outlineDepth`, `sizingNumber` and `metricWeight`, `interaction(v)` emits `settlesAt(v)`,
so `planSettingsWrite` receives an already-clamped number and the assertion holds by construction.
The test only genuinely bites for the two `unclamped` accessors (`nodeCap`, `forceLayout`), where
it asserts the pipeline does NOT clamp. That is a real property, but it is the opposite of what
the docblock advertises, and a reader who trusts the comment will over-trust the guard.

Suggested fix (either): (a) drive the beyond-bounds probe with the RAW requested value —
`planSettingsWrite({...accessor.interaction(v), value: v})` is awkward, so cleaner is (b): assert
the pipeline's own agreement separately, e.g. `settlesAt(v)` is a FIXED POINT of the store's
clamp — round-trip the planned command through the persistence parser and require the value to
come back unchanged. At minimum, correct the docblock to state what the assertion actually covers.

### 3. `bounds.max` optionality is silently divergent between the two presenters
`src/view/settingsRowAccessors.ts:46-50`, `VicinityGraphSettingTab.ts` (`addSlider`, `setLimits(min, max ?? min, step)`), `SettingsRowView.tsx` (`SliderRow`, `max={accessor.bounds.max}`)

The module comment says "a slider row is only sound on a field that has a max … not expressible in
this type". It IS expressible, and the fallbacks currently diverge: the tab degenerates to
`setLimits(min, min, step)` — an immovable slider — while the React `SliderRow` passes
`max={undefined}` and the native input silently defaults to `100`. Two different silent wrong
behaviours for the same mistake, in a codebase whose stated preference is compile-time checks.

Suggested fix: add
`interface SettingsSliderAccessor extends SettingsNumberAccessor { readonly bounds: SettingsRowBounds & { readonly max: number } }`,
have `depth()` / `outlineDepth()` / `forceLayout()` return it, and type both slider presenters
against it. The `?? min` fallback and both comments then disappear.

## 💡 Suggestions

### 4. `SizingRowWrite` still spells the interaction literal
`src/view/sizingRowWrite.ts:68` — `return { kind: "global-sizing-number", field: this.field, value }`.

The report flags this as deliberate, and the reasoning about `capNotice` is sound as far as it
goes — but `capNotice` takes the raw `typed` value as its own parameter, so routing the RETURN
through the accessor would not move any clamp ahead of it. This is exactly the interaction literal
the ticket set out to single-home. Cheap fix: constructor-inject
`private readonly interaction: (value: number) => SettingsInteraction` (pass
`SettingsRowAccessors.sizingNumber(field).interaction`), leaving the policy logic untouched.
Otherwise, file it as a follow-up ticket rather than only a report note.

### 5. `useSettingsValue`'s optional `settlesAt` is a foot-gun
`src/view/SettingsRowView.tsx` (`useSettingsValue`), called as `useSettingsValue(accessor, state, accessor.settlesAt)` at three sites.

`useOptimisticValue`'s own doc says a clamping control MUST pass `settlesAt`, and a numeric
accessor always has one — so three call sites hand the hook a value it could have read off the
accessor. Forgetting it at a fourth site produces a control stuck showing an un-echoed value.
Suggested fix: a `useSettingsNumber(accessor: SettingsNumberAccessor, state)` overload that always
uses `accessor.settlesAt`, leaving `useSettingsValue` for the non-numeric kinds.

### 6. The new parity scan covers only the two presenter files
`src/view/settingsRowParity.test.ts` (`ACCESSOR_OWNED_SYMBOLS` scan iterates `PRESENTERS`).

`DepthStepper.tsx` — which does name `clampStepperDepth` — and `GraphToolbar.tsx` are not scanned,
so the escape hatch is "push the derivation one component down". The file already has
`EVERY_ROW_RENDERING_MODULE` for exactly this reason. Consider scanning that set once finding #1
removes the legitimate `clampStepperDepth` use from `DepthStepper`.

### 7. Ticket / change_log close-out not in this commit
The previous ticket in this series closed with a `chore(tickets,change_log)` commit (`bf236b8`).
Nothing equivalent here, and no ticket file mentions `uppprbbqursr6awuoevoqpah1`. Close the ticket
and add the `change_log` entry (and file tickets for whichever of #1–#6 are not fixed now).

## Documentation Updates Needed

- `CLAUDE.md`'s settings conventions paragraph currently names ONE declared row model
  (`settingsRows.ts`) and ONE write pipeline. It should now also name `settingsRowAccessors.ts` as
  the single home of the VALUE half (`read` / `bounds` / `settlesAt` / `interaction`), and state the
  rule "a presenter never names an engine range table or clamp" — that is stable knowledge and the
  new parity guard enforces it.
- `docs-internal/architecture-map.md` — add the new module to the `src/view/` responsibility map.

## Verdict

**READY** — with findings #1 and #2 fixed or ticketed before this is considered done.

No critical issue, no behaviour regression, no weakened guard, and the ticket's actual goal
(presenters as markup plus one call, duplication single-homed) is genuinely met. Findings #1 and
#3 are latent rather than live bugs; #2 is a guard that is weaker than its own docblock claims.

---

# Iteration 1 verification (commit `37daba9`)

Verdict: **READY**. All six technical findings are genuinely fixed. Nothing I checked was
overstated in the implementer's response.

## Gates re-run by me

- `npm test` → **93 files, 1230 tests, exit 0** (was 1227). Matches their claim.
- `npm run check` → **exit 0** (`src/` and `e2e/`). Tree clean.

## 1. The test RENAME preserved coverage — CONFIRMED

Diffed `src/view/clampStepperDepth.test.ts` (deleted) against
`src/view/settingsRowDepthClamp.test.ts` (added). All six assertions survive with the SAME
inputs and the SAME expected values — `-1 → MIN`, `0 → 0`, `3 → 3`, `5 → MAX`, `6 → MAX`,
`2.4 → 2` — retargeted from `clampStepperDepth` to
`SettingsRowAccessors.depth("linkDepthOut").settlesAt`. Nothing dropped, nothing relaxed, no
assertion loosened to fit. The file adds a second `describe` (track-endpoint reachability over
every declared depth row) plus a non-vacuity test.

Ancillary edits are honest too: `optimisticValue.test.ts`'s stepper simulation now derives from
the accessor (same arithmetic), and the `settingsSpecBounds.test.ts` change is allowlist PROSE
only — the enforcer table and its rules are untouched, so no engine guard was weakened.

## 2. The new guards bite — CONFIRMED BY MY OWN PROBE, not by their mutation claim

I evaluated both predicates against deliberately wrong clamps in a throwaway script that
imports the real accessor (no source edited, script deleted afterwards):

| clamp aimed at | "settles inside bounds or verbatim" | "track endpoints survive" |
|---|---|---|
| the real bounds (max 5) | passes | passes |
| a WIDER max (7, 15) | **fails** | passes |
| a NARROWER max (4) | passes | **fails** |

So the two guards are genuinely complementary and each is falsifiable: a clamp aimed at bounds
wider than the control's is caught by the new "lawless" assertion in
`settingsRowAccessors.test.ts`, and one aimed narrower — the case that silently takes back a
value the control offered — is caught by the endpoint guard in `settingsRowDepthClamp.test.ts`.
That is exactly the hole finding #1 named, now closed from both sides.

Also checked: the non-vacuity test asserts BOTH lawful arms are exercised (`clamping: true,
verbatim: true`), so the pair cannot degenerate into "every accessor is identity"; and the
corrected docblock now states plainly that the first assertion holds by construction for the
clamping accessors — the over-claim in finding #2 is gone.

## 3. `clampStepperDepth` deletion left no caller and no behavior change — CONFIRMED

Grep over `src/` and `e2e/`: no `clampStepperDepth` callers remain (only the parity scan's
forbidden-symbol list, the pointer comment in `src/view/constants.ts`, and the engine's own
`MIN/MAX_STEPPER_DEPTH` constants, which `SettingsSpec.test.ts` still pins to the spec leaf).
`clampDepthInto(bounds, value)` is `Math.min(max, Math.max(min, Math.round(v)))` over the
field's own bounds — byte-for-byte the old formula, and all three depth leaves declare the same
`DEPTH_STEPPER_BOUNDS {0,5,1}`, so every depth field behaves identically today. NaN propagation
is unchanged (`Math.min(max, Math.max(min, NaN)) === NaN` before and after). `DepthStepper` now
takes the whole accessor, so its track and its clamp cannot diverge; its `−`/`+` disabled logic
is the same comparison with the optional-max branch removed.

## 4. Both rejections are sound, not dodges

- **Constructor-injecting the accessor into `SizingRowWrite`** — rightly rejected.
  `SettingsRowAccessors` is a static factory over declared data, not a collaborator with a
  behavioural seam worth inverting; the class already imports `SIZING_RANGES` and
  `clampSizingSettings` directly, so a direct call is the CONSISTENT choice. The point of my
  finding — the interaction literal spelled twice — is fully addressed:
  `interactionIfAccepted` now returns `SettingsRowAccessors.sizingNumber(field).interaction(value)`
  and `capNotice` still judges the typed value it is handed.
- **The persistence round-trip test** — rightly rejected. It would drag the persistence layer
  into a view suite to assert a LOAD-path property that `settingsSpecBounds.test.ts` already
  owns per bounded leaf. Their substitute (the "inside bounds or verbatim" law) targets the
  actual hole I raised more precisely than my suggestion did.

## 5. Docs are accurate, not aspirational — CONFIRMED

Every claim in the new `CLAUDE.md` "Settings values" bullet is enforced today: the
`ACCESSOR_OWNED_SYMBOLS` scan really does iterate every row-rendering module (a new
`ROW_CONTROL_COMPONENTS` table adds `DepthStepper.tsx`); `interaction()` really does emit
`settlesAt(value)`; `SettingsTrackAccessor` really does make a max-less slider a type error
(`nodeCap()` is a `SettingsTypedNumberAccessor`, not assignable). The
`docs-internal/architecture-map.md` entry names three guards that all exist. Both are one entry
each, in the surrounding style.

## Residuals — noted for honesty, NOT blocking

- The endpoint-reachability guard exists only for the depth rows; a hypothetically
  narrower-than-bounds clamp on `outlineDepth` would slip past both assertions. `clampOutlineMaxDepth`
  is derived from the same spec leaf as its bounds, so there is nothing to fix today.
- `MIN/MAX_STEPPER_DEPTH` are now referenced only from tests. They remain the spec projection
  `SettingsSpec.test.ts` pins, so this is deliberate, not stale.

Neither warrants an edit. Remaining open item is the coordinator's, as the implementer says:
close the ticket and add the `change_log` entry.
