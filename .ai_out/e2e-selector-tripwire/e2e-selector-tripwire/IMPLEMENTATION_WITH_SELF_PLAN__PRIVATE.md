# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE working notes

## Plan

**Goal**: `npm test` goes red when a `.vicinity-graph-*` class asserted under `e2e/`
exists nowhere under `src/view/**`.

**Steps** (all DONE)
1. [x] Write `e2e/selectorGuard.test.ts` (prior art: `e2e/vaultTarget.test.ts`,
       `src/engine/importGuard.test.ts` — plain `node:fs`, offenders array, BDD).
2. [x] Run `npm test` → expect GREEN (only known absent class is the exempt
       `toHaveCount(0)` breadcrumb guard).
3. [x] Mutation: rename a real class in a `src/view/*.tsx`, run `npm test`, capture
       verbatim RED output, revert, re-run GREEN.
4. [x] `npm run check` green.
5. [x] Commit; write PUBLIC.md.

**Testing**: the new file IS the test; plus a matcher `describe` block unit-testing
extraction/exemption against synthetic snippets (importGuard precedent).

**Files touched**: `e2e/selectorGuard.test.ts` (new). Nothing else in src/ or e2e/.

## Key facts carried from EXPLORATION_PUBLIC.md
- Dot asymmetry: e2e selector strings carry the leading `.`; `className=`/`cls:`
  literals in src do NOT. Extract with dot on the e2e side, strip it, compare bare.
- 76 distinct tokens under `src/view/**` (.tsx/.ts/.css). `VicinityGraphSettingTab.ts`
  is a `.ts` producer via Obsidian `{ cls: "..." }` — must scan `.ts` too.
- Only token asserted in e2e but absent from src: `vicinity-graph-node__breadcrumb`
  at `e2e/vicinityGraph.e2e.ts:178`, an intentional `toHaveCount(0)` absence guard.
- Every `toHaveCount(0)` in the repo is a single-line `expect(<locator-chain>).toHaveCount(0)`.
- `vitest.config.ts` include has `e2e/**/*.test.ts`; `e2e/tsconfig.json` include is
  `./**/*.ts` → new file needs NO config edits.
- No `vicinity-graph-${...}` interpolation anywhere in e2e → static scan is sound.

## Decisions
- **Scope = all `e2e/**/*.ts` minus self.** Helper files (`obsidianHarness.ts`,
  `settingsTabPage.ts`) hold live selector literals; narrowing to `*.e2e.ts` would let
  centralizing a selector into a helper silently disable the guard.
- **Absence exemption = line-level `toHaveCount(0)`.** Failure modes: a split
  absence assertion fails LOUD (false positive with an actionable message), never
  silent; over-exemption only for a presence class sharing a line with an absence
  assertion. Documented in the file. No new convention imposed.
- **src side = all of `src/view/**` recursively** (`.tsx`/`.ts`/`.css`), including
  `testFixtures/` (contains zero tokens today) — keeps the guard's claim exactly
  "the class appears somewhere under src/view", no exceptions to explain.

## Outcome / rehydration notes
- Delivered `e2e/selectorGuard.test.ts`. Commits `b9c0d91`, `c17ca2e` on `e2e-selector-tripwire`.
- `npm test` 1003 passed / 75 files; `npm run check` exit 0. Mutation AC verified RED then GREEN.
- **Design change vs plan**: `.css` is NOT a producer. Mutation showed a surviving CSS
  rule masks a `.tsx` rename, defeating the ticket's own AC. All 39 e2e-asserted classes
  exist in render code, so `.tsx`/`.ts`-only is strictly stronger at zero false-positive cost.
- **Gotcha for any future `e2e/*.ts`**: `vaultTarget.test.ts` requires `import * as fs from "node:fs"`.
  Bare-member fs imports turn it red. (importGuard.test.ts lives in src/ so it is not subject to this.)
- Mutation recipe used: replace `vicinity-graph-node__title` -> `__heading` in
  `src/view/NoteNode.tsx`; revert with `git checkout -- src/view/`.
