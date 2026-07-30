# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE (ticket nid_puf4a4q6fgn5lpehh5dowfm1r_e)

## Goal
"Show cross links" — global boolean, default OFF. ON ⇒ post-truncation induced subgraph
(every link whose source AND target are visible), rendered identically to walked edges.

## Plan (checklist)
1. [ ] Engine: `ViewSettings.showCrossLinks`, `SETTINGS_SPEC.globalView.showCrossLinks`,
       `EngineDefaults.viewSettings()`.
2. [ ] Engine: new `src/engine/CrossLinkSweep.ts` (induced pair collection, SRP — EdgeCounts
       keeps owning multiplicity only). `VicinityEngine.build` picks walked vs induced.
3. [ ] Engine doc: `EdgeCounts.ts` header describes the toggle, not a fixed rule;
       node-selection-is-unaffected comment lives on the sweep + the engine branch.
4. [ ] Persistence: `parseViewFields` boolean branch (mapped-type guard forces it).
5. [ ] View: interaction arm, accessor, control kind `show-cross-links`, NEW settings
       section `edges`, reset scope, both presenters, coverage-test leaf mapping,
       e2e `SUMMARY_ALSO_MATCHES_AN_ANCESTOR` entry.
6. [ ] Defaults tripwire: `settingsProductDefaults.test.ts` gains `globalView.showCrossLinks: false`.
7. [ ] `npm test`, `npm run check` (output → `.tmp/`).

## Key decisions
- Cascade dropped (global-only) — top-level agent's call, ticket text is stale.
- NEW settings section `edges` (heading "Edges") rather than shoehorning the row into
  "Node contents"/"Depth": those headings would lie. Precedent: `performance` is a
  one-row card. Costs: `SETTINGS_SECTIONS`, `SECTION_SETTINGS_FIELDS`, `SETTINGS_GROUPS`,
  `SETTINGS_RESET_SCOPES` (+ its noun must appear in `ALL_SCOPE_DESCRIPTION`, pinned by
  `settingsResetPlan.test.ts`), `e2e/settingsBaseline.ts` record.
- Sweep is a SEPARATE class from `EdgeCounts` (one reason to change each).

## Test commands
```bash
mkdir -p .tmp && npm test > .tmp/test.log 2>&1; tail -40 .tmp/test.log
mkdir -p .tmp && npm run check > .tmp/check.log 2>&1; tail -40 .tmp/check.log
```

## Status
DONE. All 7 plan steps complete; `npm test` 1304/1304 green, `npm run check` clean.
Ticket noted + closed via `ticket close`. NOT committed (top-level agent commits), no
`change_log` entry (sub-agents must not write one).

## Gotchas hit (for a clone)
- Adding a control kind reddens FIVE switches beyond the two presenters:
  `settingsRowSpecCoverage.test.ts` (`specLeafIdFor`), `settingsRowAccessors.test.ts`
  (`probesFor`), `settingsWriteFailureNotice.ts` (`controlFor` AND `controlKey`),
  `settingsWriteFailureNotice.test.ts` (`interactionsFor`). Vitest surfaces them as
  "unhandled settings row control=[…]" SUITE errors, not test failures.
- Adding a `ViewSettings` field reddens `tsc` (not vitest) in
  `src/view/settingsSectionFields.test.ts` and `src/view/testFixtures/graphFixtures.ts`
  (hand-built `ViewSettings` literals), plus `persistedShapes.test.ts`'s
  `NON_DEFAULT_VIEW` at runtime.
- Adding a SECTION additionally needs: `SETTINGS_RESET_SCOPES` entry, the section noun in
  `ALL_SCOPE_DESCRIPTION` (pinned by `settingsResetPlan.test.ts`),
  `e2e/settingsBaseline.ts`'s `SUMMARY_ALSO_MATCHES_AN_ANCESTOR`, and the literal list in
  `e2e/settingsBaseline.test.ts`.

## What is NOT done
- `npm run test:e2e` (real Obsidian release gate) not run — no e2e spec exercises the new
  toggle. A follow-up could add one (settings-tab toggle → edge appears), but the ticket
  did not ask for it.
