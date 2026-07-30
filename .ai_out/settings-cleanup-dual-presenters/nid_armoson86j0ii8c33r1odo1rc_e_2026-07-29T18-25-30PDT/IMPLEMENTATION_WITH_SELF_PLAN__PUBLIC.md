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
switches; a new row of an existing kind needs no presenter edit at all.

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

1. **FILED — `nid_uer0a6uxv9ff3sxo9a4je40gp_e`**: dead `.vicinity-graph-layout` CSS
   in `graph-view.css` (the removed layout-mode `<select>`), rendered nowhere.
   `selectorGuard` cannot see it — it guards the other direction.
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
