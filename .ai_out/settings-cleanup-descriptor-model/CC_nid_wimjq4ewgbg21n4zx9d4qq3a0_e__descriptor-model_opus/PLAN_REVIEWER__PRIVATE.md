# PLAN_REVIEWER — private working memory

Round 1 complete, 2026-07-29. Output: `DETAILED_PLAN_REVIEW__PUBLIC.md`.
Verdict issued: **PLAN_ITERATION_REQUIRED** (F2/F3/F4). Q-A: decline sustained.
Q-B: keep tripwire, generalised.

## How I verified (rebuild this if rehydrating)

Probe lives at `.tmp/planprobe/` — **throwaway, may be gone**. Recipe:

```bash
R=/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
mkdir -p $R/.tmp/planprobe
cp -r $R/src $R/.tmp/planprobe/src
cp -r $R/e2e $R/.tmp/planprobe/e2e
# tsconfig.json copied verbatim from repo root into .tmp/planprobe/,
# with "exclude": ["src/manifest.test.ts"]  (the copy cannot resolve ../manifest.json)
npx tsc -p $R/.tmp/planprobe/tsconfig.json
npx tsc -noEmit -p $R/.tmp/planprobe/e2e/tsconfig.json
# vitest.probe.config.ts: include [".tmp/planprobe/src/**/*.test.{ts,tsx}", ".tmp/planprobe/e2e/**/*.test.ts"]
npx vitest run -c $R/.tmp/planprobe/vitest.probe.config.ts
```

`.tmp/planprobe/src.good` held the plan-applied-and-fixed snapshot; I restored
from it between injection probes.

Applied all of §4.1–§4.6 mechanically via python string replacement. Baseline
(unmodified copy) was green, so every error attributable.

## Results (all reproduced, do not re-litigate)

| Check | Result |
|---|---|
| Plan as written, `tsc` | **13 errors** — §4.4 circular `SettingsResetScope` (TS2456 + TS7022) cascading into `VicinityGraphSettingTab.ts` ×4 and `settingsResetPlan.test.ts` ×5 |
| Fix `SettingsResetScope = SettingsSection \| "all"` | `tsc` src green, e2e green |
| Unit suite, plan applied | 1129 passed, 1 expected-fail, **0 test edits**; only `manifest.test.ts` fails (probe artifact) |
| Inject `embedDepthOut` on `ViewSettings` | 4 guards fire naming it: `persistedShapes.ts(153,8) TS2741 … ParsedViewFields`; `settingsSectionFields.ts(41,14) TS2322 … '"embedDepthOut"'`; `SettingsSpec.ts(322,14) TS2322`; plus `ViewSettingsResolver`/`constants` return-type errors |
| Inject `"tag-count"` on `SizeMetricId` | `sizingMetrics.ts(25,14) TS2322 … '"tag-count"'` |
| Inject bounded `labelPx` on `SizingSpec` | `constants.ts(175,14) TS2741 … 'labelPx' missing` (hole #5) |
| Inject `embedDepthOut` on `DepthSettings` | spec + section guards fire TS2322; parse guard fires **TS2345** (not TS2741) at `parseDepthOverride` call site — still names the field |
| Runtime inherit probe (5 BDD tests I wrote) | pinned `0` survives; absent → absent key; unusable → override dropped; full round-trip keeps all 5 keys; depth zero-pin unaffected |
| Option A `Extract<(typeof LIST)[number], {family:"view"}>["key"]` guard | **compiles and fires** → `TS2322: Type 'true' is not assignable to type '"forceLayout"'`. Plan's §2.2 "fatal objection" is false. |

Also verified by reading source, not prose:
- `settingsResetPlan.test.ts:269` `label === "Restore defaults"` still compiles
  (R2 correctly designed around — `SETTINGS_RESET_SCOPES` keeps its annotation).
- No React test infra: no `*.test.tsx`, no testing-library/jsdom/happy-dom in
  `package.json`. Q-B ruling rests on this.
- `EngineDefaults.*Settings()` readers in `src/view/`: `settingsResetPlan.ts`
  (4 sites), `GraphViewController.ts:53-55`, `GraphLayoutRunner.ts:26`,
  `ForceLayoutSection.tsx:57`. Basis for F4.
- `docs-internal/architecture-map.md` does not enumerate view modules.
- `SettingsSpec.test.ts` `EverySpecField`/`SpecLimitsBaseline` guard
  spec→baseline; the plan's new guards are settings→spec and spec→settings. Not
  redundant.
- `DepthSettings` and `NodeExclusionSettings` each have exactly 2 fields, both
  listed in the section map → derived merge ≡ old whole-object write. This is
  why the reset baselines stay green.

## Inline edits I made to DETAILED_PLANNING__PUBLIC.md

1. §4.4 `SettingsResetScope` → `SettingsSection | "all"` + WHY-NOT with error codes.
2. §4.1 explicit `import type { SizingSpec } from "./SettingsSpec";` (isolatedModules).
3. §5 Step 8 architecture-map = no edit needed.

Nothing else touched. `src/` and `e2e/` untouched (read-only respected).

## If a round 2 arrives — what to check

- Did §2.2 get rewritten onto the **consumer-side** argument (runtime
  `readonly (keyof ViewSettings)[]` for `restoreFields`; a hand-written
  `d is …` predicate can lie)? Reject any rewrite that keeps the "runtime filter
  is the only way" claim.
- Did §2/§0 stop saying "three per-family tables"? What ships is ONE
  family-keyed section table + one 3-arm union alias + two mapped types.
- Did Step 1's tripwire generalise to `EngineDefaults.*Settings()` with a
  3-entry allowlist (settingsResetPlan / GraphLayoutRunner / GraphViewController)?
- m2 (`_assertEveryResetScopePlaced` tautology annotated), m3 (drop redundant
  test 3), m4 (WHY on the `SECTION_RESET_SCOPES` alias + follow-up note),
  m5 (TS2345 clause) — optional, do not block on these.
- Re-run the probe recipe against the iterated plan before signing off.

---

# Round 2 — iteration confirmation (fresh instance, 2026-07-29)

Verdict: **PLAN_APPROVED_FOR_IMPLEMENTATION.** Appended to
`DETAILED_PLAN_REVIEW__PUBLIC.md` as "## Round 2 — iteration confirmation".

## Bottom line for a rehydrating successor

Round 1's end-to-end verification **still applies** — I diffed the plan and the
production-code sections (§4.1/§4.2/§4.5/§4.6) are byte-identical; §4.3/§4.4
changed only in comments. Do NOT re-run the probe recipe; it buys nothing.

## Where round 1 was wrong (important — do not re-assert it)

Round 1's F2 remedy claimed a flat descriptor list needs a hand-written,
unverified type predicate to produce `readonly (keyof ViewSettings)[]`.
**That is false on this repo.** Reproduced at `.tmp/r2probe/` (throwaway),
`tsc 5.9.3`, repo flags, real `src/engine/types.ts`:

- `.filter((d) => d.family === "view").map((d) => d.key)` assigns to
  `readonly (keyof ViewSettings)[]` — **exit 0**, no cast, no annotation
  (TS ≥ 5.5 inferred type predicates).
- Wrong predicate (`d.family !== "exclusion"`) → `TS2322 … '"outgoingDepth"' is
  not assignable to 'keyof ViewSettings'`. It cannot lie silently.
- `Extract<…>` guard with a field dropped → `TS2322: Type 'true' is not
  assignable to type '"forceLayout"'` (round 1's own probe, re-confirmed).

Recipe if needed again: single .ts file importing `../../src/engine/types`,
`npx tsc --noEmit --strict --noImplicitReturns --noUncheckedIndexedAccess
--isolatedModules --target ES2021 --module ESNext --moduleResolution node
--skipLibCheck --lib ES2021,DOM <file>`.

The planner's substituted arguments (layering dilemma; `cascade` unread) are the
ones that hold. I verified their premises: `architecture-map.md:7-13` layering,
`SettingsSpec.ts:83-85` already family-partitioned, `ViewSettingsResolver` /
`TraversalSettingsResolver` cascades are code, no `NodeExclusionSettings`
resolver exists. Known soft spot, non-blocking: the dilemma calls itself
exhaustive but `src/shared/` is a legal third home (today only path/link/file
utilities; no persistence imports it).

## F4 scan — measured myself

```
src/view: 105 files → 65 non-test, 40 test
non-test callers = ForceLayoutSection.tsx (RED) + the 3 allowlist entries
                   (GraphLayoutRunner.ts, GraphViewController.ts, settingsResetPlan.ts)
test files calling = 12 (48 sites)   [repo-wide: 25]
```

Plan said "14 view test files" — wrong; corrected inline to 12. Exclusion of
`*.test.ts(x)` is correct: production offenders are non-test by definition, and a
fixture calling the real factory is DRY-correct, not the hazard.

## Inline edits I made to DETAILED_PLANNING__PUBLIC.md this round

1. §4.4 — closed an unterminated ```ts fence introduced by the m2 annotation
   (doc had 39 fences, odd; every fence after §4.4 was inverted). Now 40.
2. §5 Step 1 — "14 view test files" → 12, with a marked correction note.

`src/` and `e2e/` untouched. Probes in `.tmp/r2probe/`, throwaway.

## If a round 3 somehow arrives

There should not be one. Nothing is open. If the planner touches §4.1/§4.2/
§4.5/§4.6 or the `SettingsResetScope` line, round 1's verification no longer
transfers and the probe recipe above §"How I verified" must be re-run.
