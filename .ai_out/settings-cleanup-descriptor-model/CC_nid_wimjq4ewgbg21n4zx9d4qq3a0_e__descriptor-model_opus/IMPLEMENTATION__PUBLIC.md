# IMPLEMENTATION — settings descriptor model (ticket 2, `nid_wimjq4ewgbg21n4zx9d4qq3a0_e`)

Status: **COMPLETE.** All 8 plan steps landed, one commit each.
`npm test` **1144 passed + 1 expected fail (86 files)**, `npm run check` **exit 0**.
**Zero pre-existing assertions edited.**

Plan followed as written. No `#QUESTION_FOR_HUMAN:` — but see §6 for two things
I deliberately left to TOP_LEVEL_AGENT.

---

## 1. Commits — one per plan step

| Step | Commit | Subject |
|---|---|---|
| 1 | `17a162c` | `test(view): RED — guard EngineDefaults.*Settings() as the single defaults source` |
| 2 | `784f8b1` | `fix(view): route the panel's force-layout restore through the shared reset plan` |
| 3 | `4574349` | `feat(engine): compile-force spec completeness and derive the sizing range keys` |
| 4 | `298ae22` | `feat(persistence): compile-force parse completeness and state the inherit rule once` |
| 5 | `bc942a5` | `feat(view): compile-force SIZING_METRICS completeness` |
| 6 | `aad1168` | `feat(view): declare which settings fields each settings section owns` |
| 7 | `d6335f2` | `refactor(view): derive every section reset plan from the section field map` |
| 8 | (this commit) | docs + follow-up tickets |

**Step 1 was committed RED on purpose** so the reviewer can reproduce the defect
by checking out `17a162c` and running `npm test`. The failure was:

```
FAIL  src/view/engineDefaultsSingleSource.test.ts
AssertionError: expected [ 'ForceLayoutSection.tsx' ] to deeply equal []
```

## 2. Files

**Added**
- `src/view/engineDefaultsSingleSource.test.ts` (step 1) — source-scan tripwire.
- `src/view/settingsSectionFields.ts` (step 6) — `SECTION_SETTINGS_FIELDS` + coverage guard.
- `src/view/settingsSectionFields.test.ts` (steps 6–7) — 4 map tests + 3 end-to-end coverage tests.

**Changed**
- `src/view/ForceLayoutSection.tsx` (step 2)
- `src/engine/SettingsSpec.ts`, `src/engine/constants.ts`, `src/engine/types.ts` (step 3)
- `src/persistence/persistedShapes.ts`, `src/persistence/persistedShapes.test.ts` (step 4, test file **additive only**)
- `src/view/sizingMetrics.ts` (step 5)
- `src/view/settingsResetPlan.ts` (step 7)
- `docs-internal/notes/settings.md`, `_tickets/settings-cleanup-dual-presenters.md` (step 8)

**Deleted** — nothing.

## 3. The five silent holes, and what closes each

| # | Hole | Closed by | Proof it fires (throwaway probe, not committed) |
|---|---|---|---|
| 1 | `parseViewOverride` could silently drop a field forever | `ParsedViewFields` mapped type, step 4 | `persistedShapes.ts(174,8): TS2741: Property 'newViewField' is missing … required in type 'ParsedViewFields'` |
| 2 | A field could be in no section reset | `SECTION_SETTINGS_FIELDS` + `_assertEverySettingsFieldSectioned`, step 6; plans derived, step 7 | `settingsSectionFields.ts(73,14): TS2322: Type 'true' is not assignable to type '"nodeCap"'` |
| 3 | `SIZING_METRICS` missing a metric was not a compile error | `as const satisfies` + `_assertEverySizingMetricListed`, step 5 | `sizingMetrics.ts(39,14): TS2322: Type 'true' is not assignable to type '"depth-decay"'` |
| 4 | A settings field could have no spec entry (no default, no bounds) | `_assertEverySettingsFieldSpecced` / `_assertNoOrphanSpecField`, step 3 | `SettingsSpec.ts(118,14): TS2322: … not assignable to type '"embedDepthOut"'` and `… '"ghostField"'` |
| 5 | `SizingRangeField` hand-typed ⇒ a new bounded field got no clamp | `Exclude<keyof SizingSpec, "metrics">`, step 3 | `constants.ts(182,14): TS2741: Property 'newBoundedField' is missing … 'Record<SizingRangeField, SettingsRange>'` |

Plus the live structural defect (#6 in the plan): the panel's force-layout
restore is now `planSettingsReset("force-layout", ctx)`. Depth parse coverage is
also guarded: `persistedShapes.ts(153,42): TS2345 … '{ readonly embedDepthOut: number | undefined; … }'`.

**Every probe was applied, compiled, and reverted; `git diff --stat` confirmed a
clean tree after each.** No probe is committed.

## 4. Verification

- `npm test`: 86 files, **1144 passed + 1 expected fail**. Baseline was 84 files,
  1131 + 1. Delta: +13 tests, +2 files, **0 edited assertions**.
- `npm run check`: exit 0 (`tsc -noEmit` for `src/` and for `e2e/`).
- **`src/view/settingsResetPlan.test.ts` is byte-identical to its pre-refactor
  state.** That is step 7's acceptance criterion and this refactor's correctness
  proof — it already pins every section's exact emitted command against a fully
  tuned context.
- New tests verified **non-vacuous**, not just green: stubbing the `performance`
  section out of `planSectionReset` makes the coverage test fail with
  `expected { nodeCap: 17, … } to deeply equal { nodeCap: 100, … }`; listing
  `nodeCap` in two sections produces **0** tsc errors and a failing unit test,
  which is exactly the division of labour claimed between the compile guard and
  the runtime test.

## 5. Deviations from the plan — two, both small

1. **Test 11 lives in `settingsSectionFields.test.ts`, not `settingsResetPlan.test.ts`**
   (and is three tests, one per family, rather than one). The plan filed it under
   step 7's file; my brief said `settingsResetPlan.test.ts` must pass **unedited**,
   and appending to it — however additive — would have weakened the "that file is
   byte-identical" proof. The property under test is the section MAP's
   completeness (`planSettingsReset` is only the observation mechanism), so the
   new file is a defensible home under SRP.
2. **`ForceLayoutSection`'s WHY comment does not name the factory in call form.**
   My first green attempt still failed: the scan matches raw source *including
   comments*, and my own doc comment contained `EngineDefaults.forceLayoutSettings()`.
   I rewrote the prose rather than teaching the scanner to strip comments —
   stripping risks a false NEGATIVE (a real call trailing a string containing
   `//`), and a guard that misses a call is worth less than nothing. The
   trade-off is now documented on `DEFAULTS_CALL` itself so the next person who
   trips it knows why and what to do.

**Nothing was rejected from the plan.** The three declines the plan itself
records (deriving `ViewSettings` from a runtime array; merging
`forceLayoutFieldMeta` + `nodePreviewPreferenceMeta`; DRY-ing
`EngineDefaults.forceLayoutSettings()` against `clampForceLayoutSettings()`) I
agree with and did not revisit.

## 6. Left to TOP_LEVEL_AGENT — please action

- **No `change_log` entry written.** The tool's own contract says *"AFTER_COMPLETION
  of TOP_LEVEL_AGENT work: … Sub-agents should NOT write change log."* The plan's
  step 8 assigns one; I am deferring to the tool contract rather than to the plan.
  Suggested: `--type refactor --impact 3 --dirs src/engine,src/persistence,src/view`,
  title "Compile-force settings completeness across spec, parse and reset".
- **Main ticket `nid_wimjq4ewgbg21n4zx9d4qq3a0_e` not closed**, nor the moot
  sub-ticket `nid_3k0a4zl6in0mj8lcjibkjq2dx_e` — the plan assigns the latter to
  TOP_LEVEL_AGENT and I left both together for the same reviewer pass.

**Follow-up tickets filed (my own work):**
- `nid_llfhrqo1ecg8tuxigo7bcrrrf_e` — collapse the duplicate
  `SETTINGS_SECTIONS` / `SECTION_RESET_SCOPES` and `SettingsSection` /
  `SettingsResetScope` names. `deps` → ticket 4 (`nid_armoson86j0ii8c33r1odo1rc_e`).
- Note added to ticket 4 recording that `NODE_PREVIEW_ROW_LABEL` /
  `NODE_PREVIEW_ROW_DESCRIPTION` belong in its row-copy table (and that
  `NODE_PREVIEW_OPTION_META` does **not**), plus a pointer to extend
  `SECTION_SETTINGS_FIELDS`'s column shape rather than invent a row union.

## 7. e2e impact assessment (`npm run test:e2e` NOT run — out of scope)

**Assessment: no e2e spec should be affected.** Basis:

- **No user-facing copy changed.** Every reset `label`, `description` and
  `confirmation` string in `settingsResetPlan.ts` is byte-identical; only the
  `plan` closures changed. `e2e/settingsBaseline.ts` derives its names from those
  same constants, and `e2e/settingsBaseline.test.ts` passes unedited under `npm test`.
- **No CSS class added, renamed or removed.** `e2e/selectorGuard.test.ts` passes
  unedited. The one renderer edit (`ForceLayoutSection`) touched an `onClick`
  handler only — class, `title` and button text are untouched.
- **No row added or removed**, so control counts (`MIN_NAMED_CONTROLS`) and the
  section card headings are unchanged.
- **`SECTION_RESET_SCOPES` keeps its name, order and tuple type**, which is what
  `e2e/settingsBaseline.ts` imports. `npm run check:e2e` is green.
- **No persisted shape changed and `PERSISTED_SHAPE_VERSION` is not bumped**, so
  no e2e vault data is invalidated and no release note about stored data is needed.

**The one thing worth a human eye:** `e2e/settingsDependentRows.e2e.ts:47-49`
indexes `SIZING_METRICS[0]`. Now that the list is a const tuple, that index is
non-nullable, so the `if (!METRIC_UNDER_TEST) throw` guard below it is
structurally unreachable. It still compiles and behaves identically; I left it
alone deliberately (D1: no e2e churn). If the release gate is run and this file
is being touched anyway, that dead branch can go.

**Behavioural claim for the panel's restore button** (the only runtime change in
this ticket), stated so it can be checked in a real Obsidian:

```
before: planSettingsWrite({kind:"global-force-layout", forceLayout: <defaults>}, ctx)
      -> { kind:"global-view", view: { ...ctx.globalView, forceLayout: <defaults> } }
after:  planSettingsReset("force-layout", ctx)
      -> [{ kind:"global-view", view: { ...ctx.globalView, forceLayout: <defaults> } }]
```

Identical command, and it now emits through a loop of length 1.

## 8. What a reviewer should look at hardest

1. **`planSectionReset`'s emission order** (`settingsResetPlan.ts`). Order is
   observable — `applyReset` awaits each command and each is a full `data.json`
   rewrite. It is byte-identical today only because every section owns fields of
   exactly one family. The invariant is documented in code; the day a section
   spans two families, re-check it.
2. **The two casts.** `restoreFields`'s `Mutable<T>` readonly-strip and
   `definedFieldsOnly`'s `as Partial<T>`. Both are documented at the site; both
   are safe by construction (every write is `T[K] = T[K]`; every surviving key
   came out of a `T`-keyed object). They are the only places type safety is
   asserted rather than proven.
3. **`_assertEveryResetScopePlaced` is now tautological.** Kept and annotated as
   such, naming the `Readonly<Record<SettingsResetScope, …>>` annotation that now
   carries the guarantee — which is strictly stronger, because it also
   compile-forces a reset spec for a newly added *section* (previously
   unguarded). Deleting it instead is a defensible alternative; I followed the
   plan's ruling that it should stay, live again if the two lists decouple.
4. **The source-scan allowlist** in `engineDefaultsSingleSource.test.ts` — three
   entries, each with a WHY, each machine-checked as still-live by the third
   test. Confirm you agree `GraphLayoutRunner` (parameter default) and
   `GraphViewController` (pre-load placeholder) are genuinely not user-visible
   defaults; those are the judgement calls.
