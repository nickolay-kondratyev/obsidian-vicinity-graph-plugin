# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE (rehydration notes)

Ticket `nid_armoson86j0ii8c33r1odo1rc_e` (dual presenters). Branch
`nid_armoson86j0ii8c33r1odo1rc_e_2026-07-29T18-25-30PDT`.

## Plan (as decided, 2026-07-29)

**Goal**: ONE declared row model in `src/view/settingsRows.ts`; the Obsidian tab and
the React panel become presenters over it.

Steps:
1. `src/view/settingsRows.ts` (pure — no obsidian/react): `SETTINGS_GROUPS`
   (heading/description/panel hints per section), `SETTINGS_ROWS` (section →
   ordered BLOCKS → ordered ROWS), `SettingsRowControl` union (1:1 with the
   `SettingsInteraction` arms), `SettingsRowNames` (the ONE a11y convention),
   `SettingsRowDependency` + `isSettingsRowDisabled`.
2. Move `NODE_PREVIEW_ROW_LABEL`/`_ROW_DESCRIPTION` out of
   `nodePreviewPreferenceMeta.ts` into the Preview row. `NODE_PREVIEW_OPTION_META`
   stays.
3. Rewrite `VicinityGraphSettingTab.display()` to iterate
   `SETTINGS_SECTIONS` → blocks → rows with an EXHAUSTIVE switch on
   `row.control.kind`. Delete `showExclusionPatterns` + its slot.
4. Rewrite the panel: `GraphToolbar` iterates the same sections;
   `SettingsRowView.tsx` holds the panel's exhaustive switch. Delete
   `GlobalDepthControls`/`SizingSection`/`ForceLayoutSection`/`NodeContentsSection`/
   `NodeExclusionSection` (absorbed).
5. Parity + BDD unit tests; e2e updates; docs; `SECTION_RESET_SCOPES` collapse.

## Decisions worth remembering

- The row model is a SEPARATE module from `settingsSectionFields.ts` (which keeps
  its per-family reset COLUMNS untouched). No `{family,key}` row union was
  invented: each `SettingsRowControl` arm carries its own TYPED field
  (`Direction`, `SizeMetricId`, `SizingNumberField`, `keyof ForceLayoutSettings`).
- Panel section ORDER unified to `SETTINGS_SECTIONS` (exclusion moves from 2nd to
  5th) and the panel gains a Performance disclosure. Both are e2e-visible.
- `disabledWhen` is a NAMED dependency (`"exclusion-enabled"`) + pure evaluator,
  not a closure — so it is data a test can enumerate.
- The sizing-metric WEIGHT input stays imperatively disabled by its own toggle:
  it is a second control on ONE row, and `disabledWhen` is row-level.
- CSS: panel slider/number row classes generalised
  (`vicinity-graph-forcelayout__field|head|label|value` → `vicinity-graph-slider-row*`,
  `vicinity-graph-sizing__field` → `vicinity-graph-number-row`) so outline-depth
  and node-cap can reuse them. `e2e/settingsUxVisual.e2e.ts` selector updated in
  the SAME commit (`selectorGuard.test.ts` requires it).

## Gotchas hit
- `engineDefaultsSingleSource.test.ts` scans raw source INCLUDING comments for
  `EngineDefaults.*Settings(` outside its allowlist — never write that call form
  in a new `src/view` doc comment.
- `nameToggle` must target the inner `<input>`; `toggleEl` is the wrapping label.
- `setDynamicTooltip()` must stay while `minAppVersion` < 1.13.
- Radio group `name` stays per-surface (tab constant vs `useId()`).

## Final state (2026-07-30)

DONE. Commits on the branch: `65e36fe` (code), `58e84fa` (docs), `28f34fc` (nit +
follow-up ticket). `npm test` 87/1137 green, `npm run check` 0, `npm run build` 0.
Full account in `IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md`.

Deviations from the plan above: the shared model kept a SEPARATE module from
`settingsSectionFields.ts` (rationale in PUBLIC §1) and grew a `SettingsRowBlock`
level so the two below-card groupings (advanced spacing, sizing metrics vs bounds)
stayed declarative and the existing CSS wrappers survived.

## Iteration 1 (2026-07-30) — review response

Commit `ae7569e`. READY for re-review. `npm test` 87/**1139**, `check` 0, `build` 0
(logs `.tmp/it1_*.log`). Full per-finding record in PUBLIC § "Iteration 1".

Two things a successor must not undo:
1. `unhandledRowControl(control: never)` in `settingsRows.ts`, called from BOTH
   presenters' `default` arm. The tab's `addRow` returns `void`, so WITHOUT that
   `default` its switch is not exhaustiveness-checked at all — that was the round-1
   BLOCKING. Probe: add a 10th `SettingsRowControl` arm ⇒ TS2345 in both files.
2. `SettingsRow` is a UNION, not an interface: `disabledWhen` is accepted only on
   `DEPENDENCY_AWARE_CONTROL_KINDS` (today `exclusion-patterns`) because that is all
   the presenters honour. Do NOT flatten it back into one interface with an optional
   flag unless you also make every kind honour the verdict on both surfaces.

Tickets I could NOT file (agent may not create/close tickets) are written verbatim in
PUBLIC under "TICKETS FOR TOP_LEVEL_AGENT TO FILE": one new `decide` UX ticket, close
`nid_uer0a6uxv9ff3sxo9a4je40gp_e` + `nid_klkdpmx6axf90y4xj8khwrlf2_e` +
`nid_que9qloigra7ku2boh83qizz0_e`, re-point `nid_hatwq2jlkhno5t6awcz0q6t9q_e`, and one
new follow-up for the last per-kind duplication.

Where to look first if something is red:
- `npm run test:e2e` was NOT run. Highest-risk specs are the four listed in PUBLIC
  under "e2e specs updated", plus `settingsUxVisual.e2e.ts`'s panel-disclosure
  count/order test (now 6 entries in `SETTINGS_SECTIONS` order).
- Visual risk not verifiable here: the panel's number rows now show the tab's longer
  labels at ~260px (`Minimum node size (px)`, `Exclude notes from the graph`) and may
  wrap. `.vicinity-graph-number-row` / `.vicinity-graph-exclusion__toggle-row` are
  where to tune it.
