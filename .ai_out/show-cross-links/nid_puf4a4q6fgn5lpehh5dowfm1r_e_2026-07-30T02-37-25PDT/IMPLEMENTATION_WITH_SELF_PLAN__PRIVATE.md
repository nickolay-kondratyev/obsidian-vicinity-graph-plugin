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

## ITERATION 2 (review incorporation, after commit `c388a7c`)

Acted on `IMPLEMENTATION_REVIEW__PUBLIC.md`. Report:
`IMPLEMENTATION_ITERATION__PUBLIC.md`. Still NOT committed.

- **The real defect the reviewer found**: `CrossLinkSweep` REPLACED the walked set and rebuilt
  it from `getOutgoingLinks`, but incoming-channel walked edges come from `getIncomingLinks`.
  Two independent authorities in `ObsidianLinkProvider` ⇒ ON could DROP an edge. FIXED by
  seeding the accumulator with `truncation.visibleEdges` (`CrossLinkSweepInput.walkedVisibleEdges`),
  so ON = walked ∪ induced by construction. Verified safe: `visibleEdges` is already filtered to
  both-endpoints-visible (`GraphTruncator.ts:51`), and `EdgeAccumulator` dedupes.
- **Reproducing that class of bug in tests**: `FakeLinkProvider` derives incoming BY INVERSION,
  so it can never diverge. Needed a local `OutgoingBlindProvider` decorator in
  `VicinityEngine.test.ts` (delegates everything, returns `[]` from
  `getOutgoingReferences` for one path). Reuse this shape for any future
  outgoing-vs-incoming disagreement test.
- **Trap in the ON test helper**: `crossLinkBuild()` spread `overrides` AFTER `globalView`, so
  any test passing `globalView` silently turned the toggle OFF. Now merges overrides and forces
  `showCrossLinks: true` last. Check this before adding ON cases.
- Rejected the reviewer's "assert unsorted edge order" idea (deleted the vacuous determinism
  test instead): `GraphStructureDiff` compares edge ids as a `Set`, so order is not load-bearing.
- Docs touched: `CrossLinkSweep` class doc (superset WHY + kind-blindness WHY + cost bound),
  `VicinityEngine.visibleEdges` doc, `high-level-plan.md:128`. README needed no change.
- Green: `npm test` 97 files / 1308 tests, `npm run check` exit 0.

## What is NOT done
- `npm run test:e2e` (real Obsidian release gate) not run — no e2e spec exercises the new
  toggle. A follow-up could add one (settings-tab toggle → edge appears), but the ticket
  did not ask for it.
