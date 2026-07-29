# DETAILED PLAN REVIEW — settings descriptor model (ticket 2, `nid_wimjq4ewgbg21n4zx9d4qq3a0_e`)

Reviewer: PLAN_REVIEWER. Reviewed: `DETAILED_PLANNING__PUBLIC.md` (as authored,
before my two inline fixes — see §7).

## 0. How this review was done — I built the plan and compiled it

I did **not** review from prose. I copied `src/` and `e2e/` into
`.tmp/planprobe/`, mechanically applied **every** code change the plan specifies
(§4.1–§4.6), and ran the repo's real toolchain against it:

| Gate | Command | Result |
|---|---|---|
| Baseline (unmodified copy) | `tsc -p .tmp/planprobe/tsconfig.json` | green |
| Plan applied, `src/` | same | **green** (after the §4.4 fix, F1) |
| Plan applied, `e2e/` | `tsc -noEmit -p .tmp/planprobe/e2e/tsconfig.json` | **green** |
| Plan applied, unit suite | `vitest run` over probe `src/**` + `e2e/**/*.test.ts` | **1129 passed, 1 expected-fail, 0 edits to any existing test** |

(The only failing file is `.tmp/planprobe/src/manifest.test.ts`, which cannot
resolve `../manifest.json` from the copy location — a probe artifact, not a
finding.)

I then injected throwaway fields to prove each guard **fails to compile and
names the field**, and wrote a throwaway runtime test to prove the inherit
invariant survives `definedFieldsOnly`.

Verdict up front: **the plan's substance is correct and verified.** One line of
it does not compile; the D3 justification rests on a factual error; one test
artifact is arbitrarily scoped. Details below.

---

## 1. Critical issues (BLOCKING)

### F1 — BLOCKING (fixed inline by me) — §4.4's `SettingsResetScope` does not compile

**Claim under review** (§4.4):

```ts
export type SettingsResetScope = SettingsSection | typeof ALL_SETTINGS_RESET_SCOPE;
```

**Evidence — reproduced verbatim** (`tsc` with the repo's own `tsconfig.json`,
plan fully applied):

```
src/view/settingsResetPlan.ts(25,13): error TS2456: Type alias 'SettingsResetScope' circularly references itself.
src/view/settingsResetPlan.ts(195,14): error TS7022: 'ALL_SETTINGS_RESET_SCOPE' implicitly has type 'any' because it does not have a type annotation and is referenced directly or indirectly in its own initializer.
src/view/settingsResetPlan.ts(206,9): error TS2532: Object is possibly 'undefined'.
src/view/settingsResetPlan.ts(219,9): error TS2532: Object is possibly 'undefined'.
src/view/VicinityGraphSettingTab.ts(263,11): error TS2339: Property 'label' does not exist on type 'SettingsResetScopeSpec | undefined'.
src/view/VicinityGraphSettingTab.ts(263,18): error TS2339: Property 'description' does not exist on type 'SettingsResetScopeSpec | undefined'.
src/view/VicinityGraphSettingTab.ts(305,11): error TS2339: Property 'label' does not exist on type 'SettingsResetScopeSpec | undefined'.
src/view/VicinityGraphSettingTab.ts(305,18): error TS2339: Property 'description' does not exist on type 'SettingsResetScopeSpec | undefined'.
src/view/settingsResetPlan.test.ts(273,10): error TS18048: 'SETTINGS_RESET_SCOPES.all' is possibly 'undefined'.
src/view/settingsResetPlan.test.ts(281,10): error TS18048: 'SETTINGS_RESET_SCOPES.all' is possibly 'undefined'.
src/view/settingsResetPlan.test.ts(285,10): error TS18048: 'SETTINGS_RESET_SCOPES.all' is possibly 'undefined'.
src/view/settingsResetPlan.test.ts(298,3):  error TS2532: Object is possibly 'undefined'.
src/view/settingsResetPlan.test.ts(306,50): error TS18048: 'SETTINGS_RESET_SCOPES.all' is possibly 'undefined'.
```

Cause: `ALL_SETTINGS_RESET_SCOPE` is declared at `settingsResetPlan.ts:189` as
`"all" satisfies SettingsResetScope`. Defining `SettingsResetScope` in terms of
`typeof ALL_SETTINGS_RESET_SCOPE` closes a cycle. `SettingsResetScope` degrades
to `any`, `SETTINGS_RESET_SCOPES` loses its key contract, and
`noUncheckedIndexedAccess` then makes every lookup `| undefined`.

**Impact — this is the finding that matters, not the type error itself.** Five of
the thirteen cascaded errors land in **`settingsResetPlan.test.ts`, a
pre-existing behaviour-capturing test file**. An implementer following §6's
"never edit an existing test" rule would hit a wall; an implementer *not*
following it would "fix" the test and silently destroy the plan's own
correctness proof.

**Recommended fix (verified):**

```ts
export type SettingsResetScope = SettingsSection | "all";
```

Everything else stays. With this one line changed, `tsc` on `src/` **and** on
`e2e/` is green and all 1129 tests pass unedited. `ALL_SETTINGS_RESET_SCOPE`'s
own `satisfies SettingsResetScope` still ties the literal to the union, so
nothing is lost.

**I applied this fix inline to `DETAILED_PLANNING__PUBLIC.md` §4.4** with the
reproduced error codes as a WHY-NOT comment, so the next reader cannot
re-introduce it. It is recorded here as BLOCKING because that is what it was in
the plan as submitted.

---

## 2. Major concerns

### F2 — MAJOR — the D3 justification rests on a false premise

§2.2 rejects Option A (one unified descriptor list) with what it calls a "fatal
objection":

> `parseViewOverride`'s guard has to be keyed by `keyof ViewSettings`. From a
> flat heterogeneous array you get there only via
> `SETTINGS_FIELDS.filter(d => d.family === "view")` — a *runtime predicate*.

**This is not true, and I reproduced the counterexample.** The narrowing is
available purely at the type level via `Extract`:

```ts
const SETTINGS_FIELDS = [
	{ family: "view", key: "nodeCap" },
	// … forceLayout deliberately MISSING …
	{ family: "depth", key: "outgoingDepth" },
] as const satisfies readonly SettingsFieldDescriptor[];

type ListedViewField = Extract<(typeof SETTINGS_FIELDS)[number], { family: "view" }>["key"];
type UnlistedViewField = Exclude<keyof ViewSettings, ListedViewField>;
export const _assertEveryViewFieldListed: UnlistedViewField extends never ? true : UnlistedViewField = true;
```

`tsc --strict --noUncheckedIndexedAccess` says:

```
.tmp/optA/probe.ts(20,14): error TS2322: Type 'true' is not assignable to type '"forceLayout"'.
```

Identical guard, identical error legibility, from a flat unified list. So Option
A **can** produce the completeness guard the ticket asks for.

**Why I still endorse Option B** — for the reason the plan should have given:

- The guard is not the binding constraint; the **consumer** is. `planSectionReset`
  needs a *runtime* `readonly (keyof ViewSettings)[]` to hand to
  `restoreFields<ViewSettings>`. Getting one out of a flat array requires either a
  hand-written type predicate (`(d): d is Extract<…, {family:"view"}> => d.family === "view"`)
  — which TypeScript does **not** verify and which therefore *can* lie — or an
  outright cast. Option B hands the array over pre-typed. That is a real and
  sufficient objection.
- Second, the section axis is orthogonal to the family axis. A flat list would
  carry both `family` and `section` per row and the reset planner would still be
  grouping at runtime.
- Third, three genuinely different override types / persistence commands / cascades
  (§2.1) make the `cascade` strategy field a three-instance abstraction — YAGNI, as
  the plan says.

**Recommendation:** rewrite §2.2's objection to the consumer-side argument above,
and state explicitly that the type-level guard *is* reachable from Option A (with
the `Extract` snippet), so the record is honest. The **decision stands** — only
the reasoning must change. This matters because D3 asked PLANNER for a
*justification* and PLAN_REVIEWER for a critique of it; a justification built on
a false premise is not one.

### F3 — MAJOR — §2.1/§2.3 describe an architecture the plan does not build

The plan's headline is "**three per-family tables**". What §4.3/§4.1/§4.2
actually deliver is:

| Artifact | Shape |
|---|---|
| `SECTION_SETTINGS_FIELDS` | **ONE** table, family-keyed via `SectionSettingsFields { view; depth; exclusion }` |
| `UnspeccedSettingsField` | **ONE** type alias, three `Exclude<>` arms |
| `UnsectionedSettingsField` | **ONE** type alias, three `Exclude<>` arms |
| Parse guards | two mapped types (`ParsedViewFields` + the inline `DepthSettings` one) — exclusion has no override so there is no third |

There is no third table anywhere. `SectionSettingsFields` **is** a family-keyed
record — i.e. the plan already built the unified structure with per-family key
columns, which is strictly the best of both options and better than what §2
argues for.

**Impact:** the discrepancy will mislead ticket 4/5 planners reading §2 for the
shape they must extend. **Recommendation:** retitle the D3 decision to what it
is — *"one section table with per-family key columns; key spaces stay keyed by
their own `keyof`, never flattened into a heterogeneous union"* — and let §2.3's
DRY/SRP argument follow from that. No code change.

### F4 — MAJOR — the Step 1 tripwire's coverage is arbitrary

§5 Step 1 scans `src/view/` for direct reads of `EngineDefaults.forceLayoutSettings()`.
But `src/view/` reads three sibling defaults factories with the **identical**
"second opinion on what a default is" hazard:

```
src/view/settingsResetPlan.ts:84    EngineDefaults.depthSettings()
src/view/settingsResetPlan.ts:91    EngineDefaults.sizingSettings()
src/view/settingsResetPlan.ts:125   EngineDefaults.nodeExclusionSettings()
src/view/GraphViewController.ts:53-55  depthSettings() / viewSettings() / nodeExclusionSettings()
src/view/GraphLayoutRunner.ts:26    forceLayoutSettings()  (parameter default)
```

Guarding one of four is worse than guarding none (it reads as "the others are
fine") or all. Generalising costs one extra allowlist entry.

**Recommendation:** scan for **`EngineDefaults.*Settings()`** under `src/view/`,
allowlisting three modules with a WHY each:
`settingsResetPlan.ts` (THE reset plan — the single source),
`GraphLayoutRunner.ts:26` (parameter default for a rendering fallback, not a
settings write), `GraphViewController.ts:53-55` (pre-load placeholder state
before persistence answers). Same cost, 4x the coverage, and it is exactly the
guard ticket 4 will need when the panel gains restore buttons for the other five
sections.

---

## 3. Rulings the plan asked for

### Q-A (§7.2) — merging `forceLayoutFieldMeta.ts` + `nodePreviewPreferenceMeta.ts` — **DECLINE SUSTAINED**

I read both files and I agree with PLANNER, on the evidence:

- `FORCE_LAYOUT_FIELD_META` is `Readonly<Record<keyof ForceLayoutSettings, …>>`
  (`forceLayoutFieldMeta.ts:16`) — seven **leaf** keys beneath *one* atomic
  `ViewSettings` field. `NODE_PREVIEW_OPTION_META` is
  `Readonly<Record<NodePreviewPreference, …>>` (`nodePreviewPreferenceMeta.ts:40`)
  — **enum values**, not fields at all. Neither key space is `keyof ViewSettings`.
- There is no `keyof ViewSettings`-keyed row-copy table for them to fold into,
  and there cannot be one in this ticket: `sizing` is 1 field / 8 rows and
  `forceLayout` is 1 field / 7 rows. "The row space is not the field space" is
  correct.
- Both are **already** compile-exhaustive — the `Record<>` annotations above,
  plus `_assertEveryForceLayoutFieldGrouped` (`forceLayoutFieldMeta.ts:74`).
  D1's fold-in exists to make shared view tables single-source and guarded;
  these two already are. Merging the files changes the file count and nothing
  else, at the cost of three unrelated key spaces in one module (SRP).

One nuance for the record: `NODE_PREVIEW_ROW_LABEL` /
`NODE_PREVIEW_ROW_DESCRIPTION` (`nodePreviewPreferenceMeta.ts:16,23`) **are** row
copy for a `keyof ViewSettings` field and *will* belong in ticket 4's row table.
Note that in the Step 8 handoff so ticket 4 finds them.

### Q-B (§5 Step 1) — keep the source-scan tripwire? — **KEEP**, subject to F4

Verified there is no cheaper honest alternative: the repo has **no React
component-test infrastructure** — no `*.test.tsx` under `src/view/`, and no
`@testing-library/*`, `jsdom` or `happy-dom` in `package.json`. A behavioural
test of `ForceLayoutSection`'s restore button is therefore not cheaply
available. Source-scan guards are an established idiom here with four
precedents (`src/engine/importGuard.test.ts`,
`src/view/thumbnailDensityThreshold.test.ts`,
`src/adapters/CanvasFallbackParser.test.ts`, `e2e/selectorGuard.test.ts`). Keep
it — generalised per F4.

---

## 4. Verified claims — what actually reproduces

### The three named silent holes: all close, all **fail to compile**, all **name the field**

Injecting `readonly embedDepthOut: number` into `ViewSettings` and `"tag-count"`
into `SizeMetricId`, with no other edit, plan applied:

```
src/persistence/persistedShapes.ts(153,8):  error TS2741: Property 'embedDepthOut' is missing in type
    '{ nodeCap: number | undefined; outlineMaxDepth: number | undefined; nodePreviewPreference: … }'
    but required in type 'ParsedViewFields'.                      ← hole #1 (parseViewOverride)
src/view/settingsSectionFields.ts(41,14):   error TS2322: Type 'true' is not assignable to type '"embedDepthOut"'.
                                                                  ← hole #2 (reset-scope coverage)
src/view/sizingMetrics.ts(25,14):           error TS2322: Type 'true' is not assignable to type '"tag-count"'.
                                                                  ← hole #3 (SIZING_METRICS)
src/engine/SettingsSpec.ts(322,14):         error TS2322: Type 'true' is not assignable to type '"embedDepthOut"'.
                                                                  ← hole #4 (spec completeness)
```

And injecting a bounded `labelPx` into `SizingSpec`:

```
src/engine/constants.ts(175,14): error TS2741: Property 'labelPx' is missing in type
  'Readonly<Record<"metricWeight" | "depthDecayK" | "minPx" | "maxPx", SettingsRange>>'
  but required in type 'Readonly<Record<SizingRangeField, SettingsRange>>'.   ← hole #5
```

R1 and R6 in §8 reproduce **exactly as written**. All five holes: closed at
compile time, each naming the offending key.

Also confirmed for the ticket-6 path (a new **`DepthSettings`** field): the spec
guard and the section guard both fire as `TS2322 … "embedDepthOut"`, and the
parse guard fires at `parseDepthOverride`'s call site as
`TS2345: Argument of type '{ outgoingDepth: number | undefined; incomingDepth: number | undefined; }'
is not assignable to parameter of type '{ …; readonly embedDepthOut: number | undefined; }'`.
Different error code than R1 predicts (TS2345, not TS2741) but the field is
still named. Cosmetic — noted in §5.

### The inherit invariant: **preserved**

`definedFieldsOnly` produces a `Partial<T>` structurally identical to today's
`definedOnly` spreads. Runtime probe against the plan's actual code, all passing:

| Behaviour | Result |
|---|---|
| `{ nodeCap: 0 }` persisted → parsed override | `{ nodeCap: 0 }` — **the pinned zero survives** |
| `{ nodeCap: 7 }` persisted → `Object.keys(override)` | `["nodeCap"]` — absent fields are **absent keys**, not `undefined` values |
| `{ nodeCap: "x" }` (nothing usable) → `docData.view` | `undefined` — override dropped, `nonEmpty` still works |
| every `ViewSettings` field persisted → keys | all 5 survive |
| `{ outgoingDepth: 0 }` → depth override | `{ outgoingDepth: 0 }` — depth zero-pin unaffected |

`!== undefined` now exists in exactly one function, as §9 A8 requires. Key
insertion order is unchanged (object-literal order == `Object.keys` order).
`definedFieldsOnly<DepthSettings>` returns `Partial<DepthSettings>`, which *is*
`DepthOverride` after Step 3 — R8's ordering constraint (Step 4 must not land
before Step 3) is real and correctly stated.

### Zero blast radius: **verified, and stronger than claimed**

Full `npm test` equivalent over the probe: **1129 passed / 1 expected-fail, zero
edits to any existing test file.** `npm run check` equivalent green for both
`src/` and `e2e/`. Specifically confirmed:

- `settingsResetPlan.test.ts` — all 30 assertions green unedited, including the
  literal `TUNED_CTX` per-scope command baselines. The derived
  `planSectionReset` output is structurally identical to every hand-written plan
  it replaces (`DepthSettings` and `NodeExclusionSettings` each have exactly the
  2 fields listed, so the merge collapses to the whole-object write).
- **R2 was correctly anticipated.** `settingsResetPlan.test.ts:269`
  (`label === "Restore defaults"`) still compiles because `SETTINGS_RESET_SCOPES`
  keeps its `Readonly<Record<…, SettingsResetScopeSpec>>` annotation and the
  literal tuples live only in the new table. Keeping the section map a separate
  table was the right call for exactly the reason §8 gives.
- `e2e/settingsBaseline.ts` and `e2e/selectorGuard.test.ts` green — the
  `SECTION_RESET_SCOPES` re-export preserves both the name and the tuple type
  those depend on.
- `src/engine/importGuard.test.ts` green — zero new engine imports; no label,
  description or section string added under `src/engine/`.

### An extra guard the plan gains but does not claim

With `SettingsResetScope` derived from `SETTINGS_SECTIONS`, the existing
`SETTINGS_RESET_SCOPES: Readonly<Record<SettingsResetScope, …>>` annotation now
compile-forces a reset spec for every **new section**. Today a new *scope* was
guarded (by `_assertEveryResetScopePlaced`) but a new *section* was not. Worth
stating in §9 — it is a genuine win.

### Layering, purity, scope

- Placement is correct. A "section" is a settings-tab card; it belongs in
  `src/view/`. The parse guard is a *type* over an engine-owned key space
  declared where the parser lives — no runtime representation, no new edge.
  `view → adapters → engine` intact.
- D1 respected: no renderer rewrite. The one `ForceLayoutSection.tsx` edit swaps
  a defaults source and touches no markup, class or text. Command produced before
  and after is byte-identical (`planSettingsWrite`'s `global-force-layout` case at
  `settingsWritePlan.ts:108-109` yields the same object as `restoreFields(ctx.globalView, defaults, ["forceLayout"])`).
- D2 respected: no depth rename; §7.1 hands the deferral to ticket 6 explicitly.
- Chain tickets 3/4/5/6 correctly left alone, with the deferrals enumerated.
- New spec guards do **not** duplicate the existing `EverySpecField<TSpec>` /
  `SpecLimitsBaseline<TSpec>` guards in `SettingsSpec.test.ts` — those run
  spec→baseline; the new ones run settings→spec and spec→settings, both
  previously unguarded. `_assertNoOrphanSpecField` has a demonstrated failure
  mode (ticket 1 just deleted two orphan spec fields). Keep both.

### Step sequencing

Compiles between steps — verified by running `tsc` after each of my step
applications:

- Step 3 alone (engine guards + `DepthOverride := Partial<DepthSettings>`, with
  `persistedShapes.ts` still on the old `definedOnly` spreads): green.
- Step 6 alone (new unconsumed module): green.
- Step 2 before Step 7 (`ForceLayoutSection` → `planSettingsReset` while the
  reset plans are still hand-written): green, and behaviourally identical.
- Steps are independently verifiable. R8's Step 3→Step 4 dependency is the only
  hard ordering constraint and it is stated.

---

## 5. Minor suggestions

- **m1 — `SizingSpec` import (§4.1).** "becomes a type-only import from
  `./SettingsSpec`, which `constants.ts` already imports from" understates it:
  the existing import is a *value* import of `SETTINGS_SPEC`, and
  `isolatedModules` requires the type to arrive via its own `import type`
  statement (or an inline `type` modifier). **Fixed inline.**
- **m2 — `_assertEveryResetScopePlaced` becomes provably tautological.** Once
  `SettingsResetScope = SettingsSection | "all"` and
  `SECTION_RESET_SCOPES = SETTINGS_SECTIONS`, `UnplacedScope` is `never` by
  construction. The plan keeps it on the grounds that "removing a guard needs a
  reason better than 'it can no longer fail'". Fair — but a guard that *cannot*
  fail while reading as protection is a POLS violation and the kind of quiet
  untruth CLAUDE.md warns about. Keep it if you like, but **annotate it in code**
  as tautological-by-construction and name what replaced it (the
  `Record<SettingsResetScope, …>` annotation on `SETTINGS_RESET_SCOPES`).
- **m3 — Step 2's new test 3 is redundant.** "the force-layout scope declares no
  confirmation" is already asserted, for every non-exclusion section scope, at
  `settingsResetPlan.test.ts:241-246`. Adding a second, weaker assertion of the
  same fact is test-level duplication. Drop test 3; cite the existing test in the
  §4.6 WHY-NOT comment instead (which the plan already does).
- **m4 — two exported names for one tuple.** `SETTINGS_SECTIONS` +
  `SECTION_RESET_SCOPES`, and `SettingsSection` + `SettingsResetScope`, now
  overlap. Justified *here* — the alias is what preserves the zero-edit proof
  across `settingsResetPlan.test.ts` and `e2e/settingsBaseline.ts` — but it is a
  clean-break debt. Give the re-export a WHY comment and note the collapse as a
  ticket-4/5 follow-up rather than leaving it to be rediscovered.
- **m5 — §8 R1's error code.** Accurate for a new `ViewSettings` field (TS2741).
  A new `DepthSettings` field surfaces as TS2345 at `parseDepthOverride`'s call
  site instead. Both name the field; worth one clause so nobody thinks the guard
  misfired.
- **m6 — Step 8's architecture-map line.** Checked: the map does not enumerate
  view modules. **Fixed inline** to say so, so implementation does not go looking.

---

## 6. Strengths (specific)

- **The verification discipline is real, not claimed.** Every §8 mechanism I
  re-tested behaved as documented. R2, R3, R4, R6, R7, R11, R13 all hold. This
  is the rare plan where the risk table is load-bearing rather than decorative.
- **The zero-blast-radius framing is the right correctness proof** and it holds:
  1129 assertions unedited. §6's escalation rule ("if you edit an assertion,
  stop") is exactly the right instruction to hand IMPLEMENTATION.
- **Rejecting Option C (parse rules into the engine) is the best call in the
  plan.** "engine owns what a valid *value* is; persistence owns what a valid
  *JSON shape* is, and what to do with a mangled one" is a clean, defensible
  seam, and the type-only guard gets the safety at zero layering cost.
- **Keeping `all` bespoke (R10)** — a belt-and-braces scope derived from the
  thing it exists to be independent of would be worthless. Correctly reasoned,
  with the WHY-NOT going into the code.
- **Two extra holes found during planning** (spec completeness, `SizingRangeField`)
  and closed for ~6 lines. Hole #4 is genuinely the root of the family and
  nobody had named it before.
- **Honest about "no red-first test exists."** The plan refuses to manufacture a
  fake failing test and says so plainly. That is the correct call under
  CLAUDE.md, and it is stated rather than glossed.
- **§7.3's refusal to DRY `EngineDefaults.forceLayoutSettings()` against
  `clampForceLayoutSettings()`** is right: both are return-type-forced, so this
  is duplication but not *silent* duplication, and collapsing them costs an
  `Object.fromEntries(...) as ForceLayoutSettings`. Trading a compile guarantee
  for brevity is the wrong direction in a ticket whose thesis is compile-time
  guards.
- **§7.4's refusal to genericise the `_assertEvery…` idiom** is right for the
  reason given, and my probes confirm it: the error message naming the missing
  key literally *is* the feature.

## 7. Inline edits I made to `DETAILED_PLANNING__PUBLIC.md`

1. §4.4 — replaced the circular `SettingsResetScope` definition with
   `SettingsSection | "all"`, plus a WHY-NOT comment carrying the reproduced
   TS2456/TS7022 codes (F1).
2. §4.1 — spelled out the `import type { SizingSpec } from "./SettingsSpec";`
   statement `isolatedModules` requires (m1).
3. §5 Step 8 — recorded that `architecture-map.md` needs no edit (m6).

No approach, architecture or scope change was made inline.

---

## 8. Verdict

Findings requiring PLANNER action before implementation: **F2** (rewrite the D3
justification onto the sound argument), **F3** (retitle the D3 decision to match
what §4 builds), **F4** (generalise the Step 1 tripwire to all four
`EngineDefaults.*Settings()` factories). F1 is fixed inline. m1–m6 are optional.

None of these change the design. The design is correct, verified end-to-end
against the real compiler and the real test suite, and I recommend building it.
What needs another pass is the *record* — D3's justification is a deliverable the
owner asked for, and it currently rests on a claim that does not reproduce.

**PLAN_ITERATION_REQUIRED**

- **Q-A ruling: DECLINE SUSTAINED.** Do not merge `forceLayoutFieldMeta.ts` and
  `nodePreviewPreferenceMeta.ts`. Both are already single-source and
  compile-exhaustive over key spaces that are not `keyof ViewSettings`; merging
  them is file-count theatre and an SRP regression ticket 4 would have to undo.
  Add a Step 8 note pointing ticket 4 at `NODE_PREVIEW_ROW_LABEL` /
  `NODE_PREVIEW_ROW_DESCRIPTION` as the row copy that *does* belong to a
  `keyof ViewSettings` field.
- **Q-B ruling: KEEP the tripwire**, generalised per F4. No React component-test
  infrastructure exists in this repo, so there is no cheaper honest red-first
  test; source-scan guards have four precedents here.
