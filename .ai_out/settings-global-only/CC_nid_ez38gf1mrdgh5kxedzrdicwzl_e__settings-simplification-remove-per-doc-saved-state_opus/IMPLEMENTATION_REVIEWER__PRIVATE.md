# IMPLEMENTATION_REVIEWER — PRIVATE state (nid_ez38gf1mrdgh5kxedzrdicwzl_e)

## Status: BOTH review rounds COMPLETE.
- PHASE 1 → `IMPLEMENTATION_REVIEW__PUBLIC.md`. Verdict: APPROVE, 1 BLOCKING (B1) + 4 SHOULD-FIX.
- PHASE 2 → `IMPLEMENTATION_REVIEW_PHASE2__PUBLIC.md`. Verdict: **APPROVE / ticket READY**,
  0 BLOCKING + 2 SHOULD-FIX (S1 stale ticket pointer, S2 "Depth defaults" copy) + 2 NIT.

---

# PHASE 2 round (this session)

## Gates I ran
- `npm test` → 82 files / **1083** tests, exit 0 (`.tmp/rev2-test.log`).
- `npm run check` → exit 0, both projects (`.tmp/rev2-check.log`).
- Ran both sequentially in ONE background bash call. ~1 min.
- `npm run test:e2e` NOT run (real Obsidian). Reviewed statically instead.

## PHASE 1 B1 is FIXED (verified, do not re-raise)
Commit `6c6c7f9`. `e2e/settingsBaseline.ts:87` now exports `ALL_SETTINGS_RESET_DESCRIPTION`
derived from `settingsResetPlan.ts:73`; `settingsResetVerify.e2e.ts` consumes it. Better than the
fix I asked for (derived, not re-typed).

## What I verified in the tree (evidence, for a re-check)
- **Residue grep clean.** `doc-data|DocData|centralDepth|per-doc|per-note|perDoc|settingsWriteScope|`
  `OwningViewPort|resolvePinnedDescriptors|ViewSettingsResolver|TraversalSettingsResolver|NOT_PERSISTABLE`
  over `src/ e2e/ docs-internal/ README.md CLAUDE.md`: every hit is a WHY-NOT, shipped-history note,
  or superseded banner. `_tickets/` and `docs-internal/research/` are archive — deliberately excluded.
- **Dangling-path scan** (useful trick, reuse it): extract `(src|e2e)/…\.(ts|tsx|css)` from each doc
  and `[ -e ]` each. Only intentional miss = `settingsWriteScope.ts` in the ticket being closed.
  **CAUGHT S1 only by eye**: `ticket-controls-optimistic-input-latency.md:10` writes
  `CentralDepthControls.tsx` WITHOUT the `src/view/` prefix, so the regex missed it.
- **settings.md restatement claim is TRUE**: `satisfies Record<keyof ViewSettings` → 0 hits in `src/`.
  Real guards exist: `ParsedViewFields` `persistedShapes.ts:135` (used `:143`);
  `Exclude<keyof …>` `SettingsSpec.ts:115-117` + orphan dir `:124-126`;
  `settingsSectionFields.ts:69-71`. `settings.md:81` names `ViewSettingsResolver.resolve()` only in
  "the bar USED TO name … that class is deleted" — honest history, not a live claim.
- **Global fan-out**: `ControlsActions.ts:72` unconditional `refreshAllViews()`;
  `VicinityGraphSettingTab.ts:850,867` → `refreshOpenViews()`; `main.ts:44` wires the port.
  README's "either surface refreshes every open graph" holds.
- **Sweep prunes pins only**: `SweepPlanner.ts:25`.
- **e2e fixture non-vacuity (the thing I was asked to check hardest)**: chain
  `sc_hub → sc_x → sc_x1 → sc_x2 → sc_x3`. `sc_x1` = 2 hops from hub; `sc_x2` = 3 from hub / 2 from
  `sc_x`. Default outgoing depth = 1 (`SettingsSpec.ts:162`). So at depth 2 ONLY a root at `sc_x`
  reaches `sc_x2`, and nothing links INTO `sc_x2` but `sc_x1`. Test 3 cannot pass vacuously.
  Test 2 inherits `sc_x` pinned from test 1 → its `data-tier=regular` assert is a real unpin proof.
- **Locators all exist**: `.vicinity-graph-depth-controls` `GlobalDepthControls.tsx:31`;
  `.vicinity-graph-stepper`/`__value`/`aria-label="Increase outgoing depth"` `DepthStepper.tsx:25,37,43`
  (label from `label.toLowerCase()`); Depth disclosure is `defaultOpen` `GraphToolbar.tsx:37`.
- **Deleted e2e coverage cost nothing**: `GraphToolbar.tsx` has no pinned disclosure at all, so both
  the `pinnedDisclosure()` tail and the absence test were vacuous-forever. Dropping the
  `hasNotText` filter made the panel exhaustiveness pin STRONGER (unfiltered, fixture-independent).
  `selectorGuard.test.ts` `ABSENCE_ASSERTION_PATTERN` still has many `toHaveCount(0)` users.
- **Pinned-central-lag KEEP-OPEN verdict re-verified myself**: `OrphanSweeper.ts:8` (15_000) and `:54`;
  `VicinityGraphBuilder.ts:42`; `PersistenceServices.ts:48`; `GraphRequestAssembler.ts:32,56`.
  Still reproducible. Agree: keep open.
- **CSS**: both halves of the justification are real (`--background-primary` repainted over an
  ancestor already painting it; double padding vs `.vicinity-graph-sizing__metrics` which has no
  wrapper). Deleted rules select attributes that no longer exist in the DOM. `__value` going
  unconditionally `--text-normal` is deliberate and honest.

## My two PHASE 2 findings, restated tersely
- **S1** `docs-internal/tickets/ticket-controls-optimistic-input-latency.md:10` → names deleted
  `CentralDepthControls.tsx`. Open ticket, so a future implementer reads it.
- **S2** `src/view/VicinityGraphSettingTab.ts:461` heads the card **"Depth defaults"** — "defaults"
  implies an override layer that no longer exists. SAME owner copy decision as the open
  `#QUESTION_FOR_HUMAN` about the panel summary, on the other surface. Told the orchestrator to fold
  them into ONE question, not decide twice. Note `settingsResetPlan.ts:131` already says the honest
  thing ("…used for every central note").

## Method notes for a future clone
- The bash wrapper prints ~19 lines of env noise per call. Budget for it; do not fight it.
- `git diff main...HEAD -- <dir>` per layer; docs diffs > ~25KB get spilled to a tool-results file —
  `Read` that file with `offset` past the noise header.
- The dangling-path scan above is cheap and caught real drift. Run it on `docs-internal/tickets/*.md`
  too, and remember bare filenames (no dir prefix) slip through — eyeball the grep output as well.
