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

---

# IMPLEMENTATION_REVIEWER — private memory (round 2)

## Scope
Commit `7da47d3` ("fix(view): bind a number-field refusal to the stored value it judged"),
the response to my round-1 CHANGES_REQUESTED. Verdict round 2: **APPROVED** (2 doc nits only).

## Verified green (ran myself, working tree clean at 7da47d3)
- `npm run check` → **exit 0** (`.tmp/review2-check.txt`).
- `npm test` → **exit 0**, **96 files / 1283 tests passed** (`.tmp/review2-test.txt`).
  Matches the implementer's claim exactly (+3 vs round 1's 1280).
- `npm run test:e2e` NOT run (per instruction).

## Finding 1 (stale refusal) — genuinely FIXED
- `NumberFieldRefusal` (`src/view/numberRowCommit.ts:105-124`): private ctor, `fromCommit(commit,
  storedWhenJudged)`, `messageWhileStoredIs(stored)`. Pure, no React, unit-tested.
- Component wiring VERIFIED by reading, not by claim: `SettingsRowView.tsx:248` computes
  `shownRefusal` ONCE and it is the sole input to `aria-invalid` (:256), `aria-describedby`
  (:257) and the rendered `role="alert"` div (:277-282). `grep` confirms no other use of the
  raw `refusal` state anywhere in the module → message and invalid marking cannot disagree.
- Invariant preserved: a REFUSED commit writes nothing → `stored` does not move → the refusal
  is not self-cancelling. Accepted commits produce `fromCommit(...)===undefined` → cleared.
- Round-1 repro (refuse maxPx → Restore defaults) is closed: stored 100→160 makes
  `messageWhileStoredIs(160)` undefined; pinned by `numberRowCommit.test.ts:180-186`.
- Residual (store bounces away and BACK to the same number, field untouched → message
  re-shows): judged ACCEPTABLE. Requires a second surface writing twice with an outstanding
  panel refusal; non-destructive, self-clearing on the next commit, documented on the class
  rather than hidden. The value-free alternative (render-time state adjustment) is exactly
  the untestable shape the fix removes. 80/20 correct.

## Findings 2 & 3 — both fixed, nothing weakened
- Scan renamed `panelTypedNumberFields.test.ts` → `src/view/typedNumberFields.test.ts` and now
  walks `EVERY_ROW_RENDERING_MODULE`, naming the offending module in the failure.
  Non-vacuous: `typedNumberFields.test.ts:86-89` asserts ≥2 fields found, and the round-1
  scan-mutation experiments still apply (regexes unchanged: `SPREAD_COMMIT_PROPS`,
  `CONTROLLED_VALUE` with `defaultValue=` deliberately not matching).
- Parity suite: mechanically diffed old vs new with comments/blank lines stripped
  (`.tmp/old_parity.txt` vs `.tmp/new_parity.txt`) → the ONLY delta is the 3 node imports
  removed, the `./rowRenderingSource` import added, and the moved tables/helper deleted.
  All 8 `it(...)` and all 11 `expect(...)` identical, including the `ACCESSOR_OWNED_SYMBOLS`
  list and `EVERY_ROW_RENDERING_MODULE.length > Object.keys(PRESENTERS).length` vacuity guard.
  Moved code in `rowRenderingSource.ts` is byte-identical to what was removed.
- `rowRenderingSource.ts` imported ONLY by the two test suites (grep over src/, e2e/) → not
  in the bundle despite `node:fs`.

## Finding on their REJECTION (disabled-scan) — ACCEPTED
Their argument is correct and the one I'd have made: a text scan asserts only that the token
`disabled={` exists, so it would pass unchanged on the inverted `disabled={enabled}`, and
reaching only the weight would hard-code one field's identity into a structural guard. Gap
recorded on `nid_7qot0m6nuxxmd5z0yb9jylsd6_e` where a render harness can actually close it.
Do NOT re-raise.

## Remaining (non-blocking, doc-only)
1. `src/view/rowRenderingSource.ts:10` still names `panelTypedNumberFields.test.ts` — the file
   the SAME commit renamed.
2. `src/view/numberRowCommit.test.ts:148` same stale name.
   (CLAUDE.md WAS updated correctly.)
3. `numberRowCommit.test.ts:185` hard-codes the full refusal copy, a 4th test copy of a string
   `settingsValidation.ts:80` owns; this test's subject is presence-vs-absence. Pre-existing
   pattern, consistent, not worth a round.

## Other diff surface checked
- `disabled={!enabled}` now AFTER the spread with a WHY comment (`SettingsRowView.tsx:382-385`).
- Stale `key={shown}` doc at `numberRowCommit.ts:80` corrected.
- CLAUDE.md: one bullet, renamed+widened scan only — accurate, no other rule changed.
- Two tickets: `nid_bbe962ojwwkhzn3uq27zw5w6l_e` NEW (focus-out no-op write, with acceptance
  criteria); note appended to `nid_7qot0m6nuxxmd5z0yb9jylsd6_e`. No behavior-capturing test or
  anchor point removed anywhere in the diff.
