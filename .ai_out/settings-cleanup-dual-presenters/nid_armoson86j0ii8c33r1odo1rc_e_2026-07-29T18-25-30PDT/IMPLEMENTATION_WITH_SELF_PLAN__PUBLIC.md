# IMPLEMENTATION_WITH_SELF_PLAN — PUBLIC

Ticket `nid_armoson86j0ii8c33r1odo1rc_e` — **dual presenters**. Branch
`nid_armoson86j0ii8c33r1odo1rc_e_2026-07-29T18-25-30PDT`, three commits
(`65e36fe`, `58e84fa`, `28f34fc`). Base was GREEN; end state is GREEN.

## Results (run, not claimed)

| Command | Result |
|---|---|
| `npm test` | **87 files / 1137 tests passed**, exit 0 (was 85 / 1124) |
| `npm run check` (`tsc` + `check:e2e`) | exit **0** |
| `npm run build` | exit **0** (regenerates `main.js` + `styles.css`) |
| `npm run test:e2e` | **NOT run** — needs a real Obsidian, per instructions |

Logs in `.tmp/` (`test5.log`, `check4.log`, `build2.log`).

## Plan (executed as written)

1. Declare the row model in a pure view module.
2. Move row copy into it (incl. the two `NODE_PREVIEW_ROW_*` consts).
3. Rewrite the settings tab as a presenter over it.
4. Rewrite the panel as the second presenter over it.
5. Parity + BDD tests; e2e updates; docs; the `SECTION_RESET_SCOPES` collapse.

## The shared model — `src/view/settingsRows.ts` (pure: no `obsidian`, no `react`)

```ts
SETTINGS_GROUPS: Readonly<Record<SettingsSection, SettingsGroup>>

SettingsGroup  { heading, description?, openInPanel?, panelClass?,
                 panelBodyClass?, panelReset?, blocks: SettingsRowBlock[] }
SettingsRowBlock { collapsedUnder?, panelClass?, rows: SettingsRow[] }
SettingsRow    { label, description?, control: SettingsRowControl,
                 disabledWhen?: SettingsRowDependency }

SettingsRowControl =                       // 1:1 with the SettingsInteraction arms
  | { kind:"depth"; direction: Direction }
  | { kind:"sizing-metric"; metric: SizeMetricId }
  | { kind:"sizing-number"; field: SizingNumberField }
  | { kind:"node-preview" } | { kind:"outline-depth" }
  | { kind:"force-layout"; field: keyof ForceLayoutSettings }
  | { kind:"exclusion-enabled" } | { kind:"exclusion-patterns" }
  | { kind:"node-cap" }

SETTINGS_ROW_CONTROL_KINDS   // runtime tuple, compile-guarded against the union
EVERY_SETTINGS_ROW, settingsRowsFor(kind)
SettingsRowDependency = "exclusion-enabled"
SettingsRowState = SettingsWriteContext      // the three global slices
isSettingsRowDisabled(row, state): boolean
class SettingsRowNames { sole(row) | role(row, "enabled"|"weight") | action("Decrease"|"Increase", row) }
```

Presenters:
- **tab** — `VicinityGraphSettingTab.display()` walks `SETTINGS_SECTIONS` → groups →
  blocks → rows; `addRow()` is an exhaustive `switch` on `row.control.kind`.
- **panel** — `GraphToolbar.tsx` walks the same sections into `Disclosure`s;
  `SettingsRowView.tsx` is the exhaustive `switch` twin.

**Parity is therefore compile-forced**: a new control kind fails to compile in BOTH
switches; a new row of an existing kind needs no presenter edit at all. *(As shipped in
`65e36fe` this was only HALF true — the tab's `void` switch had no `default`. Fixed in
iteration 1, `ae7569e`, and probe-verified there.)*

## Key decisions and why

1. **Separate module from `settingsSectionFields.ts`, which is untouched.** That
   table answers "which FIELDS does this section's reset clear" (per-family key
   COLUMNS feeding three separately-typed `restoreFields<T>` calls). The row table
   answers "which ROWS does this section PRESENT" — different cardinality (one
   `sizing` field is eight rows). Both are keyed by the same `SettingsSection`, so a
   section cannot exist in one and not the other. **No `{family, key}` row union was
   invented** (per the ticket note): each control arm carries its own typed field
   reference, so a presenter builds its `SettingsInteraction` with no re-widening.
2. **`disabledWhen` is a NAMED dependency + a pure evaluator**, not a closure — so a
   test can enumerate and evaluate it (`settingsRows.test.ts`). Its one instance
   today is the exclusion-patterns row; the tab applies it via a `dependents` list
   re-evaluated from a FRESH read after the write (plus one synchronous optimistic
   pass in click order, the sizing-metric idiom).
3. **The sizing-metric WEIGHT input stays imperatively disabled by its row-mate
   toggle.** `disabledWhen` is a ROW-level declaration and the weight is the second
   control on one row. Stated in the code.
4. **ONE label per row, taking the settings tab's fuller wording as canonical.** The
   panel's abbreviations are gone: `Outgoing`→`Outgoing depth`, `Min px`→`Minimum
   node size (px)`, `Max px`→`Maximum node size (px)`, `Exclude notes`→`Exclude notes
   from the graph`. The tab's wording won because it is the discoverable, searchable
   surface. The panel's narrowness is handled by CONTROL choice (steppers) and by
   descriptions riding as `title` tooltips, not by shorter names.
5. **Panel section order and membership now derive from `SETTINGS_SECTIONS`** — so
   exclusion moves from 2nd to 5th and the panel gains a **Performance** disclosure.
   Two hand-written orders became one. *This is a visible UX change; flagging it.*
6. **A11y: one stated convention (`SettingsRowNames`), applied by both surfaces.**
   Fixes both nits in `nid_que9qloigra7ku2boh83qizz0_e`: the panel's `SizingNumber`
   inputs now carry `aria-label` = the row label, and the panel's restore button
   carries `aria-label` = the reset scope's label (from `settingsResetPlan`, so its
   own un-shared `title` string is gone). The panel's sizing-metric checkbox also
   gained the explicit `<label> enabled` name the tab already used.
   `DepthStepper` builds `Decrease outgoing depth` from the row label, so the
   existing e2e names are byte-identical.
7. **Radio `name` stays per-surface** (tab constant vs `useId()`); the model
   deliberately does not own it. Documented in both places.
8. **CSS classes named after the SHAPE, not the section that first used it**, so the
   new outline-depth and node-cap rows reuse them:
   `vicinity-graph-forcelayout__field|head|label|value` → `vicinity-graph-slider-row*`,
   `vicinity-graph-sizing__field` → `vicinity-graph-number-row`. No new CSS file, so
   `AUTHORED_CSS_FILES` is unchanged. The one e2e selector affected was updated in
   the same commit (`selectorGuard.test.ts` requires that, and it caught it).

## Subsumed tickets — what landed

| Ticket | Delivered as |
|---|---|
| `nid_klkdpmx6axf90y4xj8khwrlf2_e` (panel outline depth) | declared row; panel renders a `SliderRow` under *Node contents*, below the Preview pill. The docblock that stated the omission is gone with the component. |
| `nid_1rslube8at5xj60ji4jeve0b0_e` (Depth group) | ONE declared `Depth (all notes)` group, heading declared once instead of twice; row labels now say `depth` on both surfaces. GLOBAL rows only — no per-doc/per-central dials, no `NOT_PERSISTABLE_NOTICE`, no pinned indicator. The ticket's "maybe rename to depth-of-links" is **deferred to ticket 6** per the standing owner decision in `docs-internal/notes/settings.md`. |
| `nid_que9qloigra7ku2boh83qizz0_e` (panel a11y) | decision 6 above. |
| `nid_qp56jugz8en8wkgjirwcb269p_e` (exclusion row) | `disabledWhen: "exclusion-enabled"`. `showExclusionPatterns`, its slot div and its WHY-NOT comment are deleted. |
| `nid_llfhrqo1ecg8tuxigo7bcrrrf_e` (duplicate names) | `SECTION_RESET_SCOPES` deleted; every consumer reads `SETTINGS_SECTIONS`. |

Also closed the parity delta: **`nodeCap` gained a panel row** (not previously
ticketed).

## Files touched

**New** — `src/view/settingsRows.ts`, `src/view/SettingsRowView.tsx`,
`src/view/settingsRows.test.ts`, `src/view/settingsRowParity.test.ts`.

**Deleted** (absorbed into the two presenters) — `src/view/GlobalDepthControls.tsx`,
`SizingSection.tsx`, `ForceLayoutSection.tsx`, `NodeContentsSection.tsx`,
`NodeExclusionSection.tsx`.

**Rewritten** — `src/view/VicinityGraphSettingTab.ts` (~790 → ~640 lines, now a
presenter), `src/view/GraphToolbar.tsx`, `src/view/DepthStepper.tsx` (row-driven).

**Edited** — `Disclosure.tsx` (`summaryTitle`), `nodePreviewPreferenceMeta.ts` (row
copy moved out; `NODE_PREVIEW_OPTION_META` stays), `settingsResetPlan.ts` (alias
removed; exclusion-confirmation rationale reworded), `graph-view.css`,
`sizingMetrics.ts` / `sizingInput.ts` / `engine/types.ts` (stale doc references),
`settingsSectionFields.test.ts`, `settingsResetPlan.test.ts`,
`nodePreviewPreferenceMeta.test.ts`, `engineDefaultsSingleSource.test.ts` (comment).

**e2e** — `settingsBaseline.ts` (card headings + panel disclosures now DERIVED from
`SETTINGS_GROUPS`; `SECTION_CARD_HEADINGS` deleted; `FORCE_LAYOUT_RESET_NAME` added),
`settingsUxVisual.e2e.ts`, `settingsDependentRows.e2e.ts`,
`settingsResetVerify.e2e.ts`, `settingsResetReview.e2e.ts`.

**Docs** — `CLAUDE.md` (one conventions line), `docs-internal/architecture-map.md`
(new seam bullet), `docs-internal/plan/high-level-plan.md` (one bullet: same
sections both surfaces + the always-render-disabled rule),
`docs-internal/notes/settings.md` (silent hole #3 closed; the add-a-field cost list
item 6 rewritten; satellite list updated), `README.md` (settings model intro,
outline-depth + node-cap now on the panel, exclusion patterns disabled-not-hidden),
`docs-internal/plan/steps/step-06-controls.md` (stale component name).

## Tests

**New, BDD, one behaviour each**
- `settingsRows.test.ts` — distinct row labels; every declared control kind is used;
  no section declares zero rows; one metric row per shipped metric. Then
  `disabledWhen`: no-dependency rows are never disabled / patterns row disabled when
  exclusion is off / enabled when on. Then the three `SettingsRowNames` forms.
- `settingsRowParity.test.ts` — the parity test, **structural, no hand-enumerated
  list**: every kind in `SETTINGS_ROW_CONTROL_KINDS` is named by both presenters;
  both section walkers still read `SETTINGS_GROUPS` and `SETTINGS_SECTIONS`; plus a
  non-vacuity assertion. It states plainly that the PRIMARY guard is the exhaustive
  `switch` and that this is a source scan only because the repo has no React
  component-test infra (`nid_7qot0m6nuxxmd5z0yb9jylsd6_e`).

**Changed, and exactly why**
- `settingsSectionFields.test.ts` — the "sections match the reset scopes" test was
  **removed, not weakened**: with the `SECTION_RESET_SCOPES` alias gone the two sides
  are literally the same tuple, so the assertion became a tautology. The same
  property is still asserted against `SETTINGS_RESET_SCOPES`'s independent key set in
  `settingsResetPlan.test.ts`. A comment in place records this.
- `nodePreviewPreferenceMeta.test.ts` — reads the row label from the row model now;
  additionally asserts the preview row EXISTS so the `not.toContain` cannot pass
  vacuously.
- `settingsResetPlan.test.ts`, `e2e/settingsBaseline.ts` — import rename only.

**e2e specs updated (release-gate; not runnable here)**
1. `settingsDependentRows.e2e.ts` — the two exclusion tests were rewritten from
   "row appears/disappears" to the sizing-weight shape already in the same file:
   same DOM node, `toBeDisabled()`/`toBeEnabled()`, identity probe, focus + scroll
   preserved. Strictly stronger (they now also assert node identity).
2. `settingsUxVisual.e2e.ts` — `.vicinity-graph-forcelayout__value` →
   `.vicinity-graph-slider-row__value`; panel restore button located by its scoped
   accessible name; `MIN_NAMED_CONTROLS` **stays 26** (the tab's control count did
   not change — the textarea it already counted is simply now unconditional) and its
   "turn exclusion on first" GIVEN is deleted as no longer needed; the panel
   disclosure list is derived, so the new Performance entry and the new order need no
   edit here.
3. `settingsResetVerify.e2e.ts` — the "COLLAPSED" precondition became
   `toHaveCount(1)` + `toBeDisabled()`; test name and screenshot names follow.
4. `settingsResetReview.e2e.ts` — `storeHiddenPatterns` → `storeInactivePatterns`,
   asserting `toBeDisabled()`; the confirmation-still-needed rationale reworded (a
   dimmed row is easy to read past — the confirmation stays).

## Deliberately NOT done

- **No single renderer.** Obsidian's `Setting` API cannot mount in React; the ticket
  says not to fight it and I did not.
- **No panel reset buttons beyond force layout.** Declared as data
  (`panelReset`), so adding more is a one-line change, but adding five affordances
  nobody asked for is scope. `e2e/settingsResetReview.e2e.ts`'s exact ordered
  `Restore*` list is scoped to `.vicinity-graph-settings`, so the panel's button
  (which now DOES carry a `Restore…` aria-label) cannot disturb it.
- **No panel validation/feedback UI** for numeric rows — that is
  `nid_hatwq2jlkhno5t6awcz0q6t9q_e`, and it now covers the node-cap row too (see
  below). The panel had none before; adding it here would have doubled the diff.
- **No depth field rename** (`linkDepthOut` / `embedDepthOut` / `linkDepthIn`) —
  owner decision D2 defers it to ticket 6.
- **No jsdom / React component-test harness** — `nid_7qot0m6nuxxmd5z0yb9jylsd6_e` is
  an open owner `decide`. The parity test is a source scan because of it, and says so.
- **No migration / back-compat**: nothing PERSISTED changed shape, so there is
  nothing to break. Row labels are UI copy only; `data.json` keys are untouched.
  (The debounce is keyed by row label, so three tab debounce keys changed — an
  in-memory key with a sub-second lifetime, not stored state.)

## Worth a ticket / owner attention

1. ~~**FILED — `nid_uer0a6uxv9ff3sxo9a4je40gp_e`**: dead `.vicinity-graph-layout` CSS
   in `graph-view.css`, rendered nowhere.~~ **WRONG — corrected in iteration 1.** This
   diff had already DELETED those rules; `grep -rn "vicinity-graph-layout" src/` finds
   nothing. The ticket should be closed as already-done (see iteration 1, ticket 2).
2. **Panel node-cap typing** (add to `nid_hatwq2jlkhno5t6awcz0q6t9q_e`): the panel's
   number inputs are CONTROLLED, so refusing an out-of-spec keystroke — which is the
   right call for the write — means the box cannot be backspaced to blank on the way
   to a new value (select-and-retype works). The settings tab's uncontrolled input
   keeps the text and only drops the write. Documented at the call site.
3. **Panel section reorder is user-visible** (exclusion 2nd → 5th) and the panel is
   one disclosure taller. Both fall out of "one declared order"; say the word if the
   old exclusion prominence was intentional and it becomes a declared
   `panelOrder` instead.
4. `e2e/settingsBaseline.ts`'s `summaryAlsoMatchesAnAncestor` flags were preserved
   byte-for-byte (`depth-defaults` and `force-layout` true) with `performance: false`
   added. I could not derive WHY the first two need `.first()` from the rendered
   nesting and would not guess on a gate I cannot run; the field is now the one
   hand-written fact in that module, keyed by section so a new one is a compile error.

## No blocking issues

Nothing in this ticket pushed toward a hack, and nothing was contradictory once the
GLOBAL-ONLY scope note was applied.

---

# Iteration 1 — response to round-1 review

Commit `ae7569e` on the same branch. **READINESS: READY for re-review.** The BLOCKING
finding was correct and is fixed; the fix is verified by PROBE, not by assertion.

## Results (run, not claimed)

| Command | Result |
|---|---|
| `npm test` | **87 files / 1139 tests passed**, exit 0 (was 1137; +2 new) — `.tmp/it1_test.log` |
| `npm run check` | exit **0** — `.tmp/it1_check.log` |
| `npm run build` | exit **0** — `.tmp/it1_build.log` (regenerates `styles.css` for the renamed class) |
| `npm run test:e2e` | **NOT run**, per instructions |

**Verification probes (temporary edits, reverted; `tsc` clean again after):**
1. Added a 10th `SettingsRowControl` arm → `tsc` errors in **BOTH** presenters:
   `SettingsRowView.tsx(89,31)` and `VicinityGraphSettingTab.ts(282,32)`, TS2345
   "not assignable to parameter of type 'never'". The headline guarantee is now real.
2. Added `disabledWhen: "exclusion-enabled"` to the node-cap row → `tsc` TS2322 at the
   declaration site. An unhonoured dependency can no longer be declared at all.

## Per-finding decisions

### BLOCKING

| # | Decision | What was done / why |
|---|---|---|
| **B1** — tab's `void` switch is not exhaustiveness-checked; 5 docs say otherwise | **INCORPORATED** | The reviewer's analysis was exactly right. Added `unhandledRowControl(control: never): never` to `settingsRows.ts` and closed BOTH presenters' switches with `default: return unhandledRowControl(row.control)`. Chose the explicit `never` default over "give `addRow` a return value": the tab has no value worth returning, and a fake return would put the guarantee in a place a reader has to infer. The same helper on both surfaces also makes the property *scannable*. Docs updated to state WHY the `default` is load-bearing on the `void` side. |
| **B1 rider** — tighten `settingsRowParity.test.ts:68` | **INCORPORATED** | Scan is now `case "${kind}":`, not a bare `"${kind}"` substring (the kind names appear in prose comments on both surfaces, so the old form was satisfiable by a comment). |
| **B1 rider** — "add a test that would have caught it" | **INCORPORATED** | New BDD test: *"WHEN a presenter's switch is scanned THEN it is closed by the shared exhaustiveness guard"* — scans both presenter sources for `return unhandledRowControl(row.control)`. Deleting either `default` fails `npm test` as well as `tsc`. |

### SHOULD-FIX

| # | Decision | Rationale |
|---|---|---|
| **S1** — `disabledWhen` documented general, honoured for one row | **INCORPORATED, by a THIRD option** | I rejected both offered options and took a stricter one. *Rejected "make it general"*: it means threading a verdict through 9 control kinds × 2 surfaces (~18 sites, plus a `DependentControl` registration each on the tab) for **zero** current declarations, with no React test infra to verify any of it — YAGNI, and it would re-create "declared but unverified". *Rejected "just reword the doc + add a test"*: a doc is not a guard. Instead the LIMIT is now **compile-enforced**: `DEPENDENCY_AWARE_CONTROL_KINDS` lists the kinds whose presenters actually honour it, and `SettingsRow` is a union that accepts `disabledWhen` **only** on those (probe-verified, see above). Extending it is documented as a two-step (teach the presenters, then add the kind), which is the OCP door the reviewer wanted left open. The reviewer's requested runtime test is also there ("no other row declares a dependency"), because rows built by `.map()` from other tables could otherwise widen past the type. Docs in `CLAUDE.md`, `architecture-map.md`, `notes/settings.md` narrowed to this truth. |
| **S2** — three unapproved panel UX changes need a `decide` ticket | **INCORPORATED as requested** — kept the code, wrote the ticket text below. No code change (the reviewer agrees one declared order is the right call). |
| **S3** — one filed ticket is already false; open tickets point at deleted files | **INCORPORATED, PARTIALLY** | Ticket text below. **Partial**, and deliberately: of the files the reviewer listed, only **three** are `status: open` (`nid_uer0a6uxv9ff3sxo9a4je40gp_e`, `nid_hatwq2jlkhno5t6awcz0q6t9q_e`, plus the two subsumed ones that should now close). The rest — `nid_5wiribg2mn0mqcr7ni4ya0cfe_e` (tab slider a11y), `nid_9jiira82snkh7bgy8zv060c9r_e` (sizing maxPx), `nid_8vmo5ibhv1bvh2ukrgmafpofj_e`, `nid_u36pqr4zljs44jt42lk9ln8ry_e`, `nid_vqw34wdpmb5qzn52cy6qugqgd_e`, `docs-internal/tickets/ticket-controls-optimistic-input-latency.md` — are **CLOSED**. Those are historical records of what the code looked like when the work was done; rewriting them would falsify the record and costs a reader nothing (a closed ticket is not an instruction). Only ACTIONABLE tickets get re-pointed. |

### NICE-TO-HAVE

| # | Decision | Rationale |
|---|---|---|
| 1 — remaining per-kind duplication (`{read, range, interaction}` accessor in the model) | **REJECTED for this diff → TICKET** (text below) | Agreed on substance and the reviewer agrees it is a follow-up. It would move engine reads and clamps into the row model, which is a real design question (the model is currently pure DATA + copy; an accessor table makes it behaviour) and is not what this ticket bought. |
| 2 — `SliderBounds` is a hand-copy of `SettingsRange` | **INCORPORATED** | Deleted; `addSlider` takes `SettingsRange` (already imported). |
| 3 — `vicinity-graph-forcelayout__restore` on a generic button | **INCORPORATED** | → `vicinity-graph-section-restore`, with a WHY comment. No e2e selector uses it (`selectorGuard` green); `styles.css` regenerated. |
| 4 — `sectionSummary` special-cases `"node-exclusion"` by identity | **REJECTED** | The badge is not a settings row: it is a per-graph excluded-node COUNT, so "as data" would mean putting a `(state, excludedNodeCount) => ReactNode` in a module that is deliberately pure data and `react`-free (it is imported by the node-side e2e process). Trading one honest one-line special case for a function-valued field in the shared model is a net loss in altitude. Stated in the existing docblock, which already says why the count lives in the summary. |
| 5 — the node-contents WHY-NOT died with the component | **INCORPORATED** | Carried into `SETTINGS_GROUPS["node-contents"]` as a WHY-NOT comment (the pill's `Auto` *is* the "whatever the note has" answer). |
| 6 — ~140-char line in `sizingInput.ts` | **INCORPORATED** | Reflowed. |

## Files touched in iteration 1

`src/view/settingsRows.ts` (guard fn, `DEPENDENCY_AWARE_CONTROL_KINDS`, `SettingsRow`
as a union, WHY-NOT), `src/view/VicinityGraphSettingTab.ts` (`default` arm,
`SettingsRange`), `src/view/SettingsRowView.tsx` (`default` arm),
`src/view/GraphToolbar.tsx` + `src/view/graph-view.css` (class rename),
`src/view/settingsRowParity.test.ts`, `src/view/settingsRows.test.ts`,
`src/view/sizingInput.ts`, `CLAUDE.md`, `docs-internal/architecture-map.md`,
`docs-internal/notes/settings.md`. `high-level-plan.md` and `README.md` needed no edit —
their `disabledWhen` sentences already name the exclusion-patterns row specifically.

---

# TICKETS FOR TOP_LEVEL_AGENT TO FILE

## 1. NEW ticket (`decide`) — panel UX changes that fell out of one declared order

**Title:** `Panel settings UX changed by the dual-presenter ticket: exclusion moved 2nd→5th, a Performance disclosure appeared, four labels grew`

**Tags:** `ux, settings, settings-cleanup, decide` — **deps:** `[nid_armoson86j0ii8c33r1odo1rc_e]`

**Body:**
```
nid_armoson86j0ii8c33r1odo1rc_e made the in-graph controls panel derive its section
order and membership from SETTINGS_SECTIONS instead of a hand-written order. Three
user-visible consequences were NOT in any ticket and need an owner yes/no:

1. Node exclusion moved from the 2nd disclosure to the 5th. It carries the panel's
   only exclusion on/off switch, and the README used to sell it as a prominent
   in-view control.
2. The panel gained a Performance disclosure with a Node cap row (it had none — this
   closed a parity gap nobody had ticketed). The panel is one disclosure taller.
3. Four panel labels took the settings tab's fuller wording on a ~260px surface:
   Outgoing -> Outgoing depth, Incoming -> Incoming depth, Min px -> Minimum node
   size (px), Max px -> Maximum node size (px), Exclude notes -> Exclude notes from
   the graph. Wrapping is unverified (npm run test:e2e was not run for this).

Implementer's and reviewer's shared recommendation: KEEP all three. One declared
order means a user who learns the tab gets the panel for free, and the two
hand-written orders were the drift generator; #2 is strictly more parity.

[decide] If the old exclusion prominence was intentional, the escape hatch is a
one-line declared `panelOrder` in src/view/settingsRows.ts (do NOT reintroduce a
second hand-written order in GraphToolbar.tsx). If the longer labels wrap badly at
260px, tune .vicinity-graph-number-row / .vicinity-graph-exclusion__toggle-row in
src/view/graph-view.css rather than re-abbreviating — one label per row is the
property this ticket bought.
```

## 2. CLOSE `nid_uer0a6uxv9ff3sxo9a4je40gp_e` — already done, and its text is now false

**Resolution note to append, then close:**
```
ALREADY DONE — filed one commit too early. nid_armoson86j0ii8c33r1odo1rc_e deleted
the .vicinity-graph-layout / .vicinity-graph-layout select rules from
src/view/graph-view.css in the same diff that filed this (the hunk that replaced the
layout-mode block with .vicinity-graph-slider-row*). `grep -rn "vicinity-graph-layout"
src/` now finds nothing. Nothing left to do; the ticket's claim that the rules "still
ship" was wrong the moment it was written.
```

## 3. CLOSE the two subsumed tickets whose components no longer exist

Both were delivered by `nid_armoson86j0ii8c33r1odo1rc_e` (details in the "Subsumed
tickets" table above) and both still point at files this diff deleted, so leaving them
open costs the next reader a dead-file investigation.

- **`nid_klkdpmx6axf90y4xj8khwrlf2_e`** (panel outline-depth). Note:
  `DONE by nid_armoson86j0ii8c33r1odo1rc_e. NodeContentsSection.tsx no longer exists —`
  `Outline depth is a declared row in src/view/settingsRows.ts ("node-contents") and`
  `the panel renders it as a SliderRow in src/view/SettingsRowView.tsx, below the`
  `Preview pill. The docblock that stated the omission died with the component.`
- **`nid_que9qloigra7ku2boh83qizz0_e`** (panel a11y nits). Note:
  `DONE by nid_armoson86j0ii8c33r1odo1rc_e. Both nits are fixed and the convention is`
  `now stated once in SettingsRowNames (src/view/settingsRows.ts): the panel's sizing`
  `number inputs carry aria-label = the row label, and the panel's restore button`
  `carries aria-label = the reset scope's label from settingsResetPlan. SizingSection`
  `.tsx / ForceLayoutSection.tsx are deleted; the code is in`
  `src/view/SettingsRowView.tsx and GraphToolbar.tsx (SectionRestoreButton).`

## 4. RE-POINT `nid_hatwq2jlkhno5t6awcz0q6t9q_e` (still OPEN, `decide`)

**Note to append:**
```
FILE RENAMES (nid_armoson86j0ii8c33r1odo1rc_e): every reference to
src/view/SizingSection.tsx in this ticket is now src/view/SettingsRowView.tsx —
specifically SizingNumberRow (min/max/k) and the shared NumberRow it renders. The
settings-tab half is unchanged (VicinityGraphSettingTab.addSizingNumber).

SCOPE GREW BY ONE ROW: the panel now also has a Node cap row (NodeCapRow, same
NumberRow shape) and it has the SAME open problem, in a sharper form — it refuses an
out-of-spec keystroke on a CONTROLLED input, so the field cannot be backspaced to
blank on the way to a new number (select-and-retype works). Documented at the call
site. The [decide] question is unchanged and now covers this row too.
```

## 5. NEW ticket — the last per-kind duplication between the two presenters

**Title:** `Settings rows: move each control kind's {value read, range, interaction} into the row model so presenters are pure markup`

**Tags:** `settings, settings-cleanup, refactor, ui` — **deps:** `[nid_armoson86j0ii8c33r1odo1rc_e]`

**Body:**
```
After nid_armoson86j0ii8c33r1odo1rc_e the two presenters share all COPY, order,
grouping and a11y naming, but each still re-derives, per control kind: the value read
(state.globalView.sizing[field]), the range-table lookup, the clamp, and the
SettingsInteraction to emit. None of that is presentation, and it is written twice —
src/view/VicinityGraphSettingTab.ts and src/view/SettingsRowView.tsx. Two step
constants are literally declared in both files (NODE_CAP_STEP,
OUTLINE_DEPTH_SLIDER_STEP).

Proposal: a per-kind accessor in the row model — {read(state), range, interaction(value)}
— leaving each presenter as markup plus one call. Design question to settle first:
settingsRows.ts is currently PURE DATA and is imported by the node-side e2e process,
so adding behaviour there needs a deliberate call about where the accessor lives
(same module vs. a sibling).

Reviewer of the dual-presenter ticket raised this as a follow-up, not a blocker.
```
