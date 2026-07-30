# IMPLEMENTATION_REVIEW — PUBLIC

Ticket `nid_armoson86j0ii8c33r1odo1rc_e` (dual presenters). Diff reviewed:
`git diff 72abfc5..HEAD` (`65e36fe`, `58e84fa`, `28f34fc`, `ffb8c45`).

**VERDICT: NOT READY — 1 BLOCKING (a ~5-line fix), 3 SHOULD-FIX, 6 NICE-TO-HAVE.**
The architecture is right and the subsumed tickets all landed. The one blocking item
is that half of the ticket's headline guarantee does not exist, while five documents
now assert that it does.

## Green claim — VERIFIED independently

| Command | Result |
|---|---|
| `npm test` | 87 files / **1137 tests passed**, exit 0 (`.tmp/rev_test.log`) |
| `npm run check` (`tsc` + `check:e2e`) | exit **0** (`.tmp/rev_check.log`) |
| `npm run test:e2e` | not run (per instructions) |

`ap_XXX_E` anchors: 1 before, 1 after — preserved.

---

## 🚨 BLOCKING

### B1. The settings tab's `addRow` switch is NOT exhaustiveness-checked — so "parity is compile-forced in BOTH presenters" is false, in five documents

`src/view/VicinityGraphSettingTab.ts:254-284` — `private addRow(...): void` switches on
`row.control.kind` with every case doing `return;` and **no `default`**. Because the
return type is `void`, adding a tenth arm to `SettingsRowControl` is **not** a compile
error there: the switch simply falls through and the row renders **nothing** in the
settings tab. I proved this under this repo's exact flags (`strict`,
`noImplicitReturns`, `noUncheckedIndexedAccess`) with a minimal probe — `tsc` exit **0**
on a 3-arm union with 2 cases handled.

The panel's twin (`src/view/SettingsRowView.tsx:69-89`) IS compile-forced, because it
returns `ReactElement` and a missing arm trips TS2366. So exactly one of the two
presenters carries the guarantee, and the asymmetry is invisible.

What currently asserts the opposite:
- `CLAUDE.md:42` — *"each an exhaustive `switch` … let both compile errors tell you where to render it"*
- `src/view/settingsRows.ts:19-22` — *"a new row is a compile error in BOTH presenters"*
- `src/view/VicinityGraphSettingTab.ts:250-252` — *"EXHAUSTIVE by `switch` on purpose — a new control kind … fails to compile HERE"*
- `src/view/SettingsRowView.tsx:36-39`, `docs-internal/architecture-map.md:+77`, `docs-internal/notes/settings.md:+32`, `settingsRowParity.test.ts:16-18` (*"that, not this file, is the primary guard"*)

This is precisely the POLS failure the implementer articulated correctly elsewhere
(`settingsResetPlan.ts`: "a guard that cannot fail while READING as protection").
It also matters practically: the ticket's GOAL sentence is "parity is structural rather
than remembered", and CLAUDE.md now instructs future work to rely on it.

**Fix (choose one, both cheap):**
```ts
// src/view/VicinityGraphSettingTab.ts, end of addRow's switch
default: {
    const unhandled: never = row.control;
    throw new Error(`unhandled settings row control=[${JSON.stringify(unhandled)}]`);
}
```
or make `addRow` return a non-`void` value (e.g. the built `Setting`) so
`noImplicitReturns` does the work. Then the five doc claims become true as written.

While there: tighten `settingsRowParity.test.ts:68` from `text.includes(`"${kind}"`)` to
`text.includes(`case "${kind}":`)`. As written the scan is satisfied by the kind name
appearing anywhere, including in a comment — it is the ONLY runtime guard today and it
is weaker than it reads.

---

## ⚠️ SHOULD-FIX

### S1. `disabledWhen` is data, but only ONE row's worth of it is actually honoured — on either surface

`src/view/settingsRows.ts:101-107` states that a row declaring `disabledWhen` is
rendered always and merely disabled *"on both surfaces"*, and `SettingsRow.disabledWhen`
reads as a general facility. It is not:
- Panel: only `ExclusionPatternsRow` calls `isSettingsRowDisabled`
  (`SettingsRowView.tsx:449`). `SliderRow` (:100-137) and `NumberRow` (:143-183) never
  set `disabled`, and `ExclusionEnabledRow`/`SizingMetricRow` never consult it.
- Tab: the `dependents` list is populated in exactly one place
  (`VicinityGraphSettingTab.ts:488`), and `applyRowDependencies` is only ever called
  from `addExclusionToggle` (:459, :465).

So declaring `disabledWhen: "exclusion-enabled"` on, say, a sizing-number row today
would silently do nothing on both surfaces, with no compile error and no test failure —
the exact "declared but unrendered" class of bug this ticket exists to kill.

**Fix (80/20):** pass the verdict through the two shared panel wrappers
(`disabled={isSettingsRowDisabled(row, state)}` in `SliderRow`/`NumberRow`, one line
each) and push a `DependentControl` from the tab's shared slider/number builders as
well. If that is deemed scope, then at minimum reword the model docblock to say the
mechanism is implemented for the patterns row only, and add a test pinning that no
other row declares `disabledWhen` — an honest limit beats a general-sounding promise.

### S2. Three user-visible UX changes nobody approved — get them signed off as a `decide` ticket, not as a report line

Self-declared, and I agree they are defensible; my concern is only that the record
lives in an `.ai_out` report the owner may never read:
1. Panel section order: **node exclusion 2nd → 5th** (`settingsRows.ts:223-339` order).
   README previously sold this as the in-view "toolbar pill"; it is the panel's only
   exclusion on/off switch and it just lost its prominence.
2. Panel **gains a Performance disclosure + node-cap row** — in no subsumed ticket
   ("Also closed the parity delta … not previously ticketed").
3. Four panel labels lengthened (`Outgoing`→`Outgoing depth`, `Min px`→`Minimum node
   size (px)`, …) on a 260px surface.

Judged against "Do Not Make Me Think": one declared order across both surfaces is the
right call and I would keep it — a user who learns the tab's order gets it for free in
the panel, and two hand-written orders were the drift generator. #2 is strictly more
parity. So: **no code change requested**, but file a `decide`-tagged ticket carrying
these three so the owner's answer is recorded (and `panelOrder` stays a one-line escape
hatch if they want exclusion back at #2).

### S3. A ticket filed by this change is already false, and six open tickets point at deleted files

- `_tickets/dead-css-vicinity-graph-layout-...md` (`nid_uer0a6uxv9ff3sxo9a4je40gp_e`)
  says the `.vicinity-graph-layout` rules "still ship" and were "deliberately left
  alone" — but this diff **deleted them** (`src/view/graph-view.css`, the hunk that
  replaced the layout-mode block with `.vicinity-graph-slider-row*`). `grep -rn
  "vicinity-graph-layout" src/` now finds nothing. The PUBLIC report repeats the false
  claim as item 1. Close the ticket as already-done.
- Open follow-ups this ticket explicitly leans on still point at components deleted
  here: `nid_hatwq2jlkhno5t6awcz0q6t9q_e`-family tickets and
  `_tickets/node-sizing-*`, `_tickets/sizing-maxpx-*`,
  `_tickets/settings-tab-sliders-have-no-accessible-label-a11y.md`,
  `docs-internal/tickets/ticket-controls-optimistic-input-latency.md` all reference
  `src/view/SizingSection.tsx` / `ForceLayoutSection.tsx` / `GlobalDepthControls.tsx`.
  Re-point them at `src/view/SettingsRowView.tsx` — an actionable ticket whose file
  does not exist costs the next reader the whole investigation.

---

## 💡 NICE-TO-HAVE

1. **Remaining per-kind duplication.** Each presenter still re-derives, per control
   kind, the value read (`state.globalView.sizing[field]`), the range table lookup, the
   clamp and the `SettingsInteraction` — twice, and `NODE_CAP_STEP` /
   `OUTLINE_DEPTH_SLIDER_STEP` are declared in both files
   (`VicinityGraphSettingTab.ts:64-70`, `SettingsRowView.tsx:57-60`). None of that is
   presentation. Moving a per-kind `{read, range, interaction}` accessor into the model
   would leave presenters as pure markup. Follow-up ticket, not this diff.
2. `SliderBounds` (`VicinityGraphSettingTab.ts:82-86`) is a hand-copy of the engine's
   `SettingsRange` — use `SettingsRange` (already imported).
3. `SectionRestoreButton` (`GraphToolbar.tsx:141`) keeps the class
   `vicinity-graph-forcelayout__restore` for a now-generic `panelReset` button —
   contradicts this diff's own "name the class after the SHAPE" decision.
4. `sectionSummary` (`GraphToolbar.tsx:162`) special-cases `"node-exclusion"` by
   identity. Defensible (the badge is telemetry, not a setting) but it is the one
   hand-remembered section fact left in a presenter; `panelSummaryBadge` as data would
   close it.
5. The old node-contents WHY-NOT ("no enable/disable toggle — document position is the
   escape hatch, now the pill's `Auto`") died with `renderNodeContents()` and was not
   carried into the row description. Worth a sentence in the model.
6. `src/view/sizingInput.ts:3-5` — the reflowed comment leaves a ~140-char line.

---

## Explicitly FINE (checked, no action)

- **The removed test WAS a genuine tautology.** `settingsSectionFields.test.ts` compared
  `SETTINGS_SECTIONS` to `SECTION_RESET_SCOPES`, which was `export const
  SECTION_RESET_SCOPES = SETTINGS_SECTIONS` — the same object. The real property ("no
  card lacks a restore row") is still asserted against an INDEPENDENT declaration,
  `Object.keys(SETTINGS_RESET_SCOPES)`, in `settingsResetPlan.test.ts:263`. **No
  coverage lost**; the in-place comment is the right disclosure.
- **The five deleted components lost nothing.** I diffed each against what
  `SettingsRowView.tsx` + `GraphToolbar.tsx` now render: every BEM class, the `nowheel`
  body escape hatch, the excluded-count badge in the exclusion summary, `useId()` radio
  grouping, the wrapping-`<label>` radio naming, index keys on the read-only pattern
  list, every `useOptimisticValue` + clamp pairing, and the nested Advanced-spacing
  disclosure all survive. A11y strictly improved (SizingNumber `aria-label`, metric
  checkbox name, scope-named panel restore button); stepper button names are
  byte-identical (`Decrease outgoing depth`).
- **Write path unchanged and compliant.** One pipeline (`this.plugin.settingsWrites` /
  `useControlsActions`), one `SerialPromiseChain`, one `ViewsRefreshPort` fan-out; no
  merge from a rendered snapshot — `GraphToolbar`'s `state` seeds display only and is
  documented as such.
- **Layering OK.** `settingsRows.ts` is view-layer with type-only `../engine` imports,
  so `e2e/settingsBaseline.ts` can import it in the node process; no deep engine paths;
  `importGuard` untouched and green.
- **Subsumed tickets all landed**: outlineMaxDepth AND nodeCap panel rows; one declared
  label per row; `SettingsRowNames` as the single stated naming convention applied to
  `SizingNumber` and the panel restore button; exclusion patterns always-rendered +
  disabled via declarative `disabledWhen`; ONE `Depth (all notes)` group on both
  surfaces with no per-doc / per-central arms and no `NOT_PERSISTABLE_NOTICE`.
- **e2e edits are self-consistent**, and I also checked the four specs that were NOT
  touched: `controlsRestart`/`pinnedCentralScenario` locate steppers by `hasText:
  "Outgoing"/"Incoming"` (substring — survives the label change) and by unchanged
  aria-labels; `settingsUxVisual`'s `Node cap` / `Outline depth` locators are scoped to
  `.vicinity-graph-settings`, so the panel's new twins cannot make them
  strict-mode-ambiguous; `MIN_NAMED_CONTROLS = 26` recounts correctly (10 sliders + 9
  numbers + 1 textarea + 6 toggles) and no longer depends on the exclusion flag; the
  derived panel-disclosure list absorbs the new order and the Performance entry.
- Docs (CLAUDE.md, architecture-map, high-level-plan, notes/settings.md, README,
  step-06) are accurate and succinct **once B1 is fixed** — B1 is the one place they
  overstate the code.

## Documentation Updates Needed

None beyond B1 (make the tab's guard real so the five existing claims are true) and S3
(close the stale dead-CSS ticket; re-point the tickets naming deleted components).

---

# Round 2 — re-review of iteration 1 (`ae7569e`, `bc0af6c`)

**VERDICT: READY / CONVERGED — 0 BLOCKING, 1 SHOULD-FIX (handoff-list item, not code),
2 NICE-TO-HAVE.** Every round-1 finding is genuinely resolved or rejected on sound
grounds. Scope was limited to the round-1 findings plus regressions in
`git diff ffb8c45..HEAD`; no fresh sweep.

## Green claim — re-verified independently

| Command | Result |
|---|---|
| `npm test` | 87 files / **1139 tests passed**, exit 0 (`.tmp/r2_test.log`) |
| `npm run check` | exit **0** (`.tmp/r2_check.log`) |
| `npm run test:e2e` | not run (per instructions) |

Working tree clean after all probes (`git status --porcelain` empty); no probe
artifacts left in the tree.

## B1 — VERIFIED FIXED, by my own probe (not by reading the claim)

Added a 10th arm `{ kind: "probe-tenth" }` to `SettingsRowControl` (+ the kinds tuple)
and ran `npx tsc -noEmit` under the repo's real config. Exit 2, and the errors are in
**both** presenters:

```
src/view/SettingsRowView.tsx(89,31): error TS2345: Argument of type
  '{ readonly kind: "probe-tenth"; }' is not assignable to parameter of type 'never'.
src/view/VicinityGraphSettingTab.ts(282,32): error TS2345: … 'never'.
```

The headline guarantee ("a new control kind is a compile error in BOTH presenters") is
now TRUE as written. `unhandledRowControl(control: never): never`
(`src/view/settingsRows.ts:110-113`) is the right shape, and its docblock states the
WHY (the tab's `void` arm) accurately. Probe reverted.

**The new BDD test really bites.** Deleting the tab's `default` arm →
`settingsRowParity.test.ts` fails with
`"settings tab does not close its switch with unhandledRowControl"`. Deleting the
panel's → `"controls panel does not close its switch with unhandledRowControl"`.
Verified separately for each side; both restored. The tightened
`case "${kind}":` scan is the right fix for the comment-satisfiable substring.

## S1 — `DEPENDENCY_AWARE_CONTROL_KINDS` — VERIFIED, honest, and it constrains

Probe: added `disabledWhen: "exclusion-enabled"` to the Node cap row
(`src/view/settingsRows.ts:389`). `tsc` exit 2:

```
src/view/settingsRows.ts(385,6): error TS2322: Type '{ … control: { kind: "node-cap"; };
  disabledWhen: "exclusion-enabled"; }' is not assignable to type 'SettingsRow'.
```

The allowlist is also FACTUALLY correct: `exclusion-patterns` is honoured on both
surfaces — panel at `SettingsRowView.tsx:451`, tab at `VicinityGraphSettingTab.ts:487`
plus the `DependentControl` re-apply registration at `:488`. No other kind claims it.
The implementer's third option is strictly better than either option I offered: the
limit is now compile-enforced rather than documented, and the OCP door
(`settingsRows.ts:137-139`, "teach both presenters, then add the kind") is explicit.
The runtime companion test (`settingsRows.test.ts:79-87`) is not a tautology — rows
built by `.map()` from other tables can widen past the literal type.

## Doc claims touched this round — all TRUE

- `CLAUDE.md:42` — now says "a `switch` … closed by `unhandledRowControl` (the tab's
  arm returns `void`, so the `default` is what makes its exhaustiveness real)" and
  scopes `disabledWhen` to `DEPENDENCY_AWARE_CONTROL_KINDS`. Both verified above.
- `docs-internal/architecture-map.md:73-83` — same two claims, same verdict.
- `docs-internal/notes/settings.md:33-38, 93-96` — accurate; the parity-test sentence
  correctly now says it also scans for the closing `default`.
- `docs-internal/plan/high-level-plan.md:72` and `README.md` — correctly left alone;
  the plan's `disabledWhen` sentence names the exclusion-patterns row specifically, so
  it was never over-general. Confirmed by grep, not by the implementer's say-so.
- `settingsRows.ts:119-125` still says "both surfaces render such a row ALWAYS and
  merely disable it" — true, and the very next docblock narrows the scope, so it does
  not over-claim in context.

## The 2 rejections — both sound, stated plainly

- **NTH-1 (per-kind `{read, range, interaction}` accessor) → follow-up ticket.**
  Sound. It is a real design question (the row model is deliberately pure DATA and is
  imported by the node-side e2e process), it was raised as a follow-up in round 1, and
  the queued ticket text captures the design question rather than just the symptom.
- **NTH-4 (`sectionSummary`'s `"node-exclusion"` identity check).** Sound. The badge is
  a per-graph excluded-node COUNT, not a settings row; expressing it "as data" means a
  `(state, count) => ReactNode` field in a `react`-free pure-data module. Trading one
  honest one-line special case for a function-valued field in the shared model is a
  net loss. I withdraw the suggestion.

## Regression check on `ffb8c45..HEAD` — none found

- `SliderBounds` → `SettingsRange` (`engine/constants.ts:122-126`) is field-identical
  (`min`/`max`/`step`); `tsc` green.
- The `SettingsRow` interface → union rewrite does not break `isSettingsRowDisabled`,
  `DependentControl.row`, or any presenter narrowing (`tsc` + 1139 tests green).
- CSS rename `vicinity-graph-forcelayout__restore` → `vicinity-graph-section-restore`:
  `grep -rn` finds the old name nowhere in `src/` or `e2e/`; the only two live
  references are `graph-view.css:796` and `GraphToolbar.tsx:140`; `styles.css` is
  gitignored (regenerated at build) and the local build carries the new name.
- Iteration 1 touched no e2e spec, and it changed no user-visible label or e2e
  selector, so the round-1 e2e self-consistency conclusion still holds.
- Ticket statuses in the handoff list spot-checked against the `ticket` CLI and all
  six match what the implementer claims (`uer0`/`hatw`/`klkd`/`que9` open;
  `9jii`/`5wir` closed). The "don't rewrite CLOSED tickets — they are historical
  record" rationale is correct; only actionable tickets need re-pointing.

## ⚠️ SHOULD-FIX (one, and it is about the handoff list, not the code)

### R2-S1. The queued ticket list omits the one thing that is genuinely unverified: the e2e release gate

This change **rewrote four e2e specs** (`settingsDependentRows`, `settingsUxVisual`,
`settingsResetVerify`, `settingsResetReview`) and `npm run test:e2e` has never been run
against any of it — correctly so, it needs a real Obsidian. `docs-internal/RELEASE_CHECKLIST.md:15`
covers it *at release*, which means a broken rewritten spec surfaces weeks later, far
from its author. The `decide` ticket mentions e2e only as a footnote about label
wrapping.

**Fix:** add a 6th item to "TICKETS FOR TOP_LEVEL_AGENT TO FILE" —
*"Run `npm run test:e2e` on this branch before merge: `nid_armoson86j0ii8c33r1odo1rc_e`
rewrote the two exclusion dependent-row tests and three settings selectors, and none of
it has executed against a real Obsidian."* One line, and it stops the only genuinely
unverified surface from being lost.

## 💡 NICE-TO-HAVE

1. `DEPENDENCY_AWARE_CONTROL_KINDS` (`src/view/settingsRows.ts:141`) is itself an
   unguarded allowlist: appending a kind there *without* teaching the presenters
   restores exactly the silent-ignore bug, and both the type and the runtime test go
   green. The two-step is documented (`:137-139`) but nothing trips. Cheap tripwire:
   pin the tuple's exact contents in `settingsRows.test.ts` with a comment saying that
   editing this test is the deliberate act of confirming both presenters were taught.
2. The parity scan's second test matches `return unhandledRowControl(row.control)`
   anywhere in the file, not specifically in a `default` arm. The compile guard is the
   primary protection so this is belt-and-braces, but a comment saying so would stop a
   future reader over-trusting the scan.

## Round-2 verdict

**READY / CONVERGED.** No blocking issues. The one SHOULD-FIX is a line of text in the
handoff list; the two nice-to-haves are optional. Nothing here should hold the merge.
