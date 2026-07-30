# IMPLEMENTATION_REVIEWER — private memory (round 1)

## Scope
Review of commit `1875811` ("fix(view): commit the panel's size-metric weight on blur, not per keystroke")
against `_tickets/controls-panel-the-size-metric-weight-input-still-writes-per-keystroke-controlled.md`.
READ-ONLY on source. Round-1 verdict: **CHANGES_REQUESTED** (one regression + two DRY/coverage items).

## Verified green (ran myself)
- `npm run check` → exit 0 (output `.tmp/review-check.txt`).
- `npm test` → exit 0, 96 files / 1280 tests (output `.tmp/review-test.txt`).
- `npm run test:e2e` NOT run (needs real Obsidian) — per instruction.

## What the change does
- `NumberField` component folded away; commit protocol extracted to hook
  `useNumberFieldCommit(accessor, write, stored, onCommit)` → `{key, inputProps, refusal}`
  (`src/view/SettingsRowView.tsx:225-275`).
- `NumberRow` (`:278-299`) and `SizingMetricRow` (`:339-380`) both call it; the weight input
  is now uncontrolled (`defaultValue`) + blur/Enter-committed, `disabled={!enabled}` kept,
  `aria-label` (`SettingsRowNames.role(row,"weight")`) and `title="Weight"` kept.
- Metric row wrapped in `.vicinity-graph-number-row-block` (CSS column flex; parent
  `.vicinity-graph-sizing__metrics` gap still applies → no visual regression).
- New scan `src/view/panelTypedNumberFields.test.ts`; extended `numberRowCommit.test.ts`;
  `e2e/controlsRestart.e2e.ts` `setNumberInput` now focus→set value→input→blur;
  CLAUDE.md typed-fields bullet updated to name the hook + scan.

## Findings (round 1)
1. **SHOULD-FIX / regression (the one I'd hold on)** — refusal state moved UP into the hook,
   which lives in the never-remounted row component. Previously `<NumberField key={shown}>`
   remounted (and thus CLEARED refusal + `aria-invalid`) whenever the stored value moved.
   Now the input remounts on `key = `${stored}:${reseeds}`` (text reseeded) but `refusal`
   and `aria-invalid=true` persist → a valid, freshly-seeded number under a stale red
   message, marked invalid to AT.
   Reachable path: set maxPx=100; type maxPx=20 in the panel → refused; Restore defaults →
   maxPx stored 100→160, field reseeds to 160, stale refusal remains.
   Not disclosed in `IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md`.
   Remedy: tie the refusal to the stored value it was judged against
   (`useState<{forStored:number; message:string}|undefined>`, treat as absent when
   `forStored !== stored`) — a REFUSED commit never moves `stored`, so the "a refusal is
   never remounted away" invariant is preserved.
2. **SHOULD-FIX** — scan covers only `SettingsRowView.tsx`
   (`panelTypedNumberFields.test.ts:34`), while `settingsRowParity.test.ts` already has
   `EVERY_ROW_RENDERING_MODULE` (`SettingsRowView.tsx`, `GraphToolbar.tsx`,
   `DepthStepper.tsx`). A typed field added in another panel module escapes the tripwire
   the test exists to be.
3. **SHOULD-FIX (DRY)** — comment-stripping `source()`/`panelSource()` duplicated verbatim
   between `settingsRowParity.test.ts:93-101` and `panelTypedNumberFields.test.ts:36-42`.
   Extract a shared test helper (e.g. `src/view/sourceScan.ts`).
4. **NICE-TO-HAVE** — stale doc: `src/view/numberRowCommit.ts:80` still says
   "`NumberRow`'s `key={shown}`"; the key is now `${stored}:${reseeds}` on the input.
5. **NICE-TO-HAVE** — `disabled={!enabled}` sits BEFORE `{...weightField.inputProps}`
   (`SettingsRowView.tsx:373-374`); harmless today (props carry no `disabled`) but a future
   prop would silently win. Also no test pins the disabled criterion.

## Scan quality — empirically checked (`.tmp/scan-sim.mjs`, no source edits)
- as-is: 2 fields, 0 unwired, 0 controlled.
- weight reverted to `value=`+`onChange`, no spread → 1 unwired + 1 controlled (FAILS ✔).
- spread kept but `value={weight}` added → 1 controlled (FAILS ✔).
- non-self-closing `<input …></input>` reformat → still 2 fields, still passes (no false alarm).
- extra controlled number field appended → caught ✔.
Conclusion: the tripwire is real, not fooled by trivial reformatting, and NOT redundant with
`settingsRowParity.test.ts` / `ACCESSOR_OWNED_SYMBOLS` (different property asserted).

## e2e helper
`own-file-size` ships `enabled: true` (`src/engine/settingsProductDefaults.test.ts:62`), so the
weight input is NOT disabled in `controlsRestart.e2e.ts` §11 → focus/blur works. No other e2e
site drives a PANEL number input (`settingsResetReview.e2e.ts`, `settingsTabPage.ts`,
`settingsUxVisual.e2e.ts` all target the debounced settings TAB). Note the old helper's
synthetic `input` dispatch would have "worked" even on a disabled input; the new one will not —
fine today, worth remembering if a spec ever drives a disabled metric's weight.

## Design-call judgment
Hook extraction (over two-layout component / policy-only reuse) is the right call: 100% of the
protocol shared (min/max/step, defaultValue, remount-key, Enter-blur, aria-invalid/describedby,
refusal markup), 0% of layout; removes a component layer. No re-derived clamp; accessor still
owns the value half; `NumberRowCommitPolicy` still owns the decision.
