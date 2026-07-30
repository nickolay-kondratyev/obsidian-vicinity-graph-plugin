# IMPLEMENTATION_REVIEW — PUBLIC

Ticket nid_x6hgehsu5il1d1shuraz3ufqy_e, commit `3468387`. Reviewer ran everything itself; no
source file was left modified (all mutation experiments reverted with `git checkout`).

## Verdict

**READY** — 0 BLOCKING, 2 SHOULD-FIX (one is a comment/coverage honesty fix the implementer
already flagged and priced, one is a doc-level gap on a pre-existing test), 3 NITs.

The change is a real improvement: the structural tests have genuine teeth, the walk is
single-source, and the one production line is a defensible consistency fix.

## Independently measured facts

- `npm run check` → exit 0, clean (`.tmp/review-check.log`).
- `npm test` → exit 0, **91 test files / 1164 tests passed** — matches the claim exactly
  (baseline claim 87/1139).
- No `e2e/` file touched by the commit (`git show 3468387 --stat -- e2e/` is empty) → the
  OUT-OF-SCOPE line (G) was respected.

## A. Teeth verification (the most important check) — PASSED

Added `phantomKnob: { default: 3, min: 1, max: 9, step: 1 }` to
`SETTINGS_SPEC.globalView` (nothing else) and ran the suite:

```
Test Files  4 failed | 87 passed (91)
9 failed tests, each naming the field:
  src/engine/SettingsSpec.test.ts            ... EngineDefaults projection  → "phantomKnob: expected=[3] got=[undefined]"
  src/engine/settingsSpecBounds.test.ts      ... "exactly one table claims to enforce it" → "phantomKnob"
  src/persistence/settingsSpecPersistence.test.ts (5) round-trip / absent / garbage / sibling / empty data.json
  src/view/settingsResetSpecCoverage.test.ts (2) tab-wide reset ("phantomKnob: still [undefined]"), "exactly one section owns it" ("owned by []")
```

Reverted; the tree is exactly as found. The implementer's claim (9 tests / 4 files, each
naming the field) is accurate to the test name and to the failure message.

## B. Coverage completeness — adequate, no silent shrink

Per leaf: parse + round-trip + absent→default + garbage→default + sibling-safety
(`src/persistence/settingsSpecPersistence.test.ts:53-118`), reset-to-declared-default and
per-section blast radius (`src/view/settingsResetSpecCoverage.test.ts:64-106`), bounds
below-min / above-max / NaN→default derived from the leaf's own declaration
(`src/engine/settingsSpecBounds.test.ts:124-149`). Bounds numbers are read off the descriptor,
never restated.

Checked every place the list could quietly shrink:

- the only `.filter()` that shrinks the walk is `SETTINGS_FIELD_LEAVES`
  (`src/engine/testFixtures/settingsSpecLeaves.ts:113`), and its exception list is
  double-guarded — the id must be a real spec leaf and no settings field may carry it
  (`src/engine/SettingsSpec.test.ts:81-94`).
- `alternateLeafValue` returns `undefined` for an unmodelled type and `alternateSettingsRoot`
  **throws** naming the leaf (`settingsSpecLeaves.ts:230-240`), so an unmodelled new field is
  loud, not skipped.
- `FAR_OUTSIDE_ANY_RANGE = 1e6` fails loudly (not silently) if a future max exceeds it.
- the `metricWeight` bounds-only exception is honest: `clampSizingSettings`
  (`src/engine/constants.ts:217-221`) really does clamp every metric's `weight` through
  `clampSizingNumber("metricWeight", …)`, which is what the enforcer table claims.

## Findings

1. **[SHOULD-FIX]** `src/engine/forceLayoutSettings.test.ts:9-22` and
   `src/engine/settingsProductDefaults.test.ts:14-21` — the stated justification for dropping
   the 7 force-layout default literals ("the layout-quality suites run AT these defaults and
   fail on a real placement regression") is only **partly true**, and I measured which part.
   Mutating the spec defaults and running the full suite:
   - `repelStrength 300→60`, `collidePaddingPx 50→0`, `elkNodeSpacingPx 20→115`,
     `linkGapPx 40→240` → **5 failures across 3 files** (`D3ForceLayout.test.ts`,
     `d3ForceStranding.test.ts`, `groupPacking.test.ts`). Claim holds. Good.
   - `centerPullStrength 0.05→0.15` (the max) **and** `linkStrengthFactor 1→4` (the max) →
     **91 files / 1164 tests still green**. Nothing notices.
   - `edgeRoutingClearancePx 11→14` → **91/1164 still green**. Nothing notices.

   So three of the seven force-layout defaults now have ZERO tripwire — a change to any of
   them (accidental or from a bad merge) ships silently, which is exactly what the ticket
   forbids ("structural tests must not erase the ability to notice an unintended default
   change"). Concrete fix, as the implementer already priced it: add
   `centerPullStrength`, `linkStrengthFactor` and `edgeRoutingClearancePx` (or all seven) to
   `settingsProductDefaults.test.ts` — one line each. Minimum acceptable alternative: correct
   the two header comments to name the three fields that are NOT covered by measured geometry,
   so the stated rationale stops overselling. Nothing else from the removed assertions was
   lost: the NaN case is re-expressed generically (`settingsSpecBounds.test.ts:143`) and the
   anti-collapse invariant was preserved (see NIT 3).

2. **[SHOULD-FIX]** `src/view/settingsRowParity.test.ts:67-100` — the Goal-2 judgement ("no
   churn needed") is *mostly* right, and the test does fail under mutation (I confirmed the
   design; the implementer confirmed by renaming `case "node-cap":`). But the precise residual
   hole is bigger than the file's header admits: the test asserts every **control KIND** has a
   `case "<kind>":` substring in each presenter and that the section walkers mention
   `SETTINGS_GROUPS` / `SETTINGS_SECTIONS`. It does **not** assert that every
   `EVERY_SETTINGS_ROW` row reaches both surfaces — `EVERY_SETTINGS_ROW` is used only for the
   vacuity length check at line 98. Consequences: a per-row skip in either presenter
   (`if (row.id === "node-cap") return <></>;` inside the switch, or a `.filter()` over a
   group's rows in `GraphToolbar.tsx`) keeps all four assertions green; and because the scan is
   textual, a `case` label sitting in dead or commented-out code also satisfies it. Not
   blocking (row-level parity genuinely needs a render harness =
   `nid_7qot0m6nuxxmd5z0yb9jylsd6_e`), but the gap should be written down **on that ticket**
   ("row-level parity is currently inferred from kind-level dispatch") rather than only in a
   test comment, so the next reader does not over-trust the guard.

3. **[NIT]** `src/engine/settingsSpecBounds.test.ts:171-179` — the anti-collapse invariant
   (`centerPullStrength.max < linkStrengthFactor.min`) was relocated here from
   `forceLayoutSettings.test.ts`. Behavior is preserved (good), but it is a force-layout DOMAIN
   invariant living in the generic bounds-walk file; SRP says its home is
   `forceLayoutSettings.test.ts`, which is also where a future "simplify these ranges" edit
   lands.

4. **[NIT]** `src/engine/testFixtures/settingsSpecLeaves.ts:211-215` — the string branch of
   `alternateLeafValue` hard-assumes the only string leaf is `nodePreviewPreference`. A second
   string-valued field with a different domain would produce an invalid alternate and fail in
   the round-trip test rather than in the fixture, i.e. loud but misattributed. The comment says
   as much; a one-line `throw` keyed on the leaf id would name the real cause. Low value.

5. **[NIT]** The new follow-up ticket lives in `_tickets/` (consistent with the parent ticket
   and the `ticket` CLI), while `CLAUDE.md` still points at `docs-internal/tickets/` for
   follow-ups. Pre-existing inconsistency, worth one line in `CLAUDE.md` at some point — not
   this ticket's job.

## D. The one production change — genuine, and covered

`src/engine/constants.ts:52-55`: `clampOutlineMaxDepth` now routes through `clampIntoRange`.
Verdict: a legitimate consistency fix, not a smuggled behavior change.

- Finite behavior is byte-identical (`clampIntoRange` is the same `Math.min`/`Math.max` pair
  plus a NaN branch; the outer `Math.round` is retained).
- It IS covered against regression: `settingsSpecBounds.test.ts:143` asserts NaN→declared
  default for every enforced bounded leaf, `globalView.outlineMaxDepth` included, and the
  three outline-specific cases (rounding, 0→min, max+1→max) are still pinned at lines 157-169.
- No caller depends on the old NaN propagation: `persistedShapes.ts:142-147` filters through
  `numberOrUndefined` before clamping, `VicinityGraphSettingTab.ts:729` is a slider. Note
  `SettingsRowView.tsx:334` passes it as `settlesAt` for the outline-depth control, where a
  typed/blank value can plausibly produce `NaN` — so this is arguably a small live improvement,
  not merely cosmetic. Calling it "not a live bug fix" is the conservative framing; fine.

## Follow-up ticket `nid_5meu9s38sbrv1703na77of4m7_e` — correct call, not dodging

Clamping `nodeCap` on load would have silently contradicted a behavior-capturing test
(`persistedShapes.test.ts`, "a stored nodeCap zero survives — falsy is a real value, not an
absence"), which CLAUDE.md forbids changing without human alignment. The ticket states the
facts, both options, and the test rewrite each option implies, carries the `decide` tag, and is
referenced from `BOUNDS_ENFORCED_OUTSIDE_THE_ENGINE` so the gap is visible at the code. Right
call.

## F/G. Quality + scope

BDD `WHEN … THEN …` throughout, one behavior per test, failures aggregate into `toEqual([])`
lists that name every offending field (much better than first-failure). No duplicated walk
logic — one module, imported by engine/persistence/view suites. Layering respected: the fixture
is pure, engine-layer, imports only the spec and `EngineDefaults` factories; the view/
persistence suites import downward only. Strict-TS idioms hold (`noUncheckedIndexedAccess`
handled at `settingsSpecLeaves.ts:155-159`). No magic numbers outside named constants
(`FAR_OUTSIDE_ANY_RANGE`, `GARBAGE_VALUE`, `ALTERNATE_EXCLUSION_PATTERNS`). No `ap_XXX_E`
anchor touched. No e2e touched.

## Documentation Updates Needed

- `docs-internal/notes/settings.md` — the "step 5 landed" line is still missing (implementer
  deliberately left it to TOP_LEVEL_AGENT; make sure it actually happens with the ticket close).
- `nid_7qot0m6nuxxmd5z0yb9jylsd6_e` — add the row-level-parity gap from finding 2.
- If finding 1 is resolved by comment-only correction, say in the release note which
  force-layout defaults are unguarded by tests.
