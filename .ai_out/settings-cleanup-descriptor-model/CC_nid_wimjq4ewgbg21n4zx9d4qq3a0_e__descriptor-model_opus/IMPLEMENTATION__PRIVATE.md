# IMPLEMENTATION — PRIVATE working memory

Branch: `CC_nid_wimjq4ewgbg21n4zx9d4qq3a0_e__descriptor-model_opus`
Plan: `DETAILED_PLANNING__PUBLIC.md` (8 steps). Follow it in order.

## Baseline (before any change)

- `npm test`: 84 files, 1131 passed + 1 expected fail. `npm run check`: exit 0.
- Scan simulation matched the plan exactly: 65 non-test view modules, offenders
  `["ForceLayoutSection.tsx"]`, 3 live allowlist entries, 12 view test files
  calling the factories.

## Progress log

- **Step 1 DONE** — `17a162c` `test(view): RED — guard EngineDefaults.*Settings() as the single defaults source`
  - New `src/view/engineDefaultsSingleSource.test.ts`.
  - **Confirmed RED**: `AssertionError: expected [ 'ForceLayoutSection.tsx' ] to deeply equal []`.
  - Committed red deliberately so the reviewer can reproduce the failure by checkout.
- **Step 2 DONE** — `784f8b1` `fix(view): route the panel's force-layout restore through the shared reset plan`
  - `src/view/ForceLayoutSection.tsx`: dropped the `EngineDefaults` import, added
    `planSettingsReset` import, `restoreDefaults()` async loop, `onClick={() => void restoreDefaults()}`.
  - **SURPRISE**: first green attempt still failed — the WHY doc comment I wrote
    contained the literal call form, and the scan matches raw source (comments
    included). Fixed by rewording prose to "the engine's defaults factory" and
    documenting the conservative-by-design choice on `DEFAULTS_CALL`. Did NOT
    add comment-stripping: that risks a false negative (real call trailing a
    string containing `//`), which is the failure mode the guard exists to stop.
  - `npm test` 85 files / 1134 passed + 1 expected fail; `npm run check` exit 0.
  - Zero existing assertions edited.

- **Step 3 DONE** — `4574349` engine guards.
  - `SettingsSpec.ts` +`_assertEverySettingsFieldSpecced` / `_assertNoOrphanSpecField`,
    `constants.ts` `SizingRangeField = Exclude<keyof SizingSpec, "metrics">` (+ separate
    `import type { SizingSpec }` for `isolatedModules`), `types.ts`
    `DepthOverride = Partial<DepthSettings>`.
  - Probes (patch → `npx tsc -noEmit` → restore from `.tmp/*.bak`) confirm all three fire:
    `SettingsSpec.ts(118,14) TS2322 Type 'true' is not assignable to type '"embedDepthOut"'`,
    `… '"ghostField"'`, `constants.ts(182,14) TS2741 'newBoundedField' missing`.
  - 1134 passed, check clean.
- **Step 4 DONE** — `298ae22` persistence.
  - `definedFieldsOnly<T>` + `ParsedViewFields`; `parseDepthOverride` uses the
    inline `definedFieldsOnly<DepthSettings>` guard. `definedOnly` KEPT for
    `parseDocData` sub-objects.
  - 3 additive tests in a new `describe("PersistedShapes view override presence semantics")`.
  - Probes: `persistedShapes.ts(174,8) TS2741 'newViewField' missing … 'ParsedViewFields'`
    and `(153,42) TS2345 … '{ readonly embedDepthOut: number | undefined; … }'`. Exactly
    the two error codes plan R1 predicted.
  - 1137 passed, check clean.
- **Step 5 DONE** — `bc942a5` `SIZING_METRICS` `as const satisfies` + guard.
  - Probe: dropping `depth-decay` → `sizingMetrics.ts(39,14) TS2322 … '"depth-decay"'`.
  - `sizingMetrics.test.ts` unedited and green. `e2e/settingsDependentRows.e2e.ts`
    dead `if (!METRIC_UNDER_TEST)` branch left alone on purpose (still compiles).
  - 1137 passed, check clean.

- **Step 6 DONE** — `aad1168` `src/view/settingsSectionFields.ts` + `.test.ts`.
  - Probes: dropping `nodeCap` from `performance` → `settingsSectionFields.ts(73,14)
    TS2322 … '"nodeCap"'`; listing `nodeCap` TWICE → 0 tsc errors + failing unit
    test. That split is the documented division of labour between guard and test.
- **Step 7 DONE** — `d6335f2` reset plans derived.
  - `settingsResetPlan.ts`: `restoreFields<T>`, `planSectionReset`, six entries
    rewired, `SettingsResetScope = SettingsSection | "all"`,
    `SECTION_RESET_SCOPES = SETTINGS_SECTIONS`, `_assertEveryResetScopePlaced`
    annotated tautological, `all` scope left bespoke.
  - **`settingsResetPlan.test.ts` byte-identical and green** — the proof held.
  - Test 11 went into `settingsSectionFields.test.ts` (3 tests, one per family)
    rather than `settingsResetPlan.test.ts`, to keep that file unedited. Recorded
    as deviation 1 in `IMPLEMENTATION__PUBLIC.md`.
  - Non-vacuity probe: stubbing the `performance` section → `expected { nodeCap: 17, … }
    to deeply equal { nodeCap: 100, … }`.
- **Step 8 DONE** — docs + tickets.
  - `docs-internal/notes/settings.md`: holes 1–2 struck through as CLOSED, hole 3
    left open (ticket 4/5), new section for holes 4–6, new "cost of adding one
    field AFTER ticket 2" section, D2 deferral recorded under depth naming.
  - `docs-internal/architecture-map.md` NOT edited — it does not enumerate
    individual view modules (verified by PLAN_REVIEWER, re-confirmed).
  - Filed `nid_llfhrqo1ecg8tuxigo7bcrrrf_e` (collapse duplicate names), `deps` →
    ticket 4 `nid_armoson86j0ii8c33r1odo1rc_e`. Added the row-copy pointer note
    to ticket 4.
  - **NOT done on purpose**: no `change_log` entry (tool contract: sub-agents
    must not), main ticket not closed, moot sub-ticket
    `nid_3k0a4zl6in0mj8lcjibkjq2dx_e` not closed. Both flagged for
    TOP_LEVEL_AGENT in `IMPLEMENTATION__PUBLIC.md` §6.

## Final state

- `npm test` 86 files / 1144 passed + 1 expected fail. `npm run check` exit 0.
- Baseline was 84 / 1131 + 1 ⇒ +13 tests, +2 files, **0 edited assertions**.
- `npm run test:e2e` NOT run (out of scope). Impact assessment in
  `IMPLEMENTATION__PUBLIC.md` §7 — expected zero impact; one now-dead branch at
  `e2e/settingsDependentRows.e2e.ts:47-49` left alone.

## If a future instance must resume

Everything is committed. There is no partial work. The only open items are the
two TOP_LEVEL_AGENT hand-offs above.

## Probe recipe (reuse for verification)

```
cp src/engine/types.ts .tmp/types.bak
python3 -c '...patch...'
npx tsc -noEmit > .tmp/probe.txt 2>&1; grep <file> .tmp/probe.txt
cp .tmp/types.bak src/engine/types.ts   # ALWAYS restore, then `git diff --stat` to confirm
```

## Invariants I must not break

- `src/view/settingsResetPlan.test.ts` passes UNEDITED (the refactor's own proof).
- No copy changes, no CSS class renames, `!== undefined` presence semantics.
- If an existing assertion needs editing: STOP, report in `IMPLEMENTATION__PUBLIC.md`.
