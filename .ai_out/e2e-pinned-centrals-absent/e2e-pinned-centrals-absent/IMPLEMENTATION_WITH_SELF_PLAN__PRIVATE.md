# PRIVATE memory — ticket `nid_d9j4o9ecp93g5zhury5m1fb43_e`

## Status: DONE. Committed on `e2e-pinned-centrals-absent`. Not merged.

All acceptance criteria met, including the mutation experiment (ran for real on the
Playwright/real-Obsidian gate, captured, reverted, `git diff src/` empty).

## Plan (all steps done)

1. [x] Extract `PINNED_CENTRALS_SUMMARY_PATTERN` into `e2e/settingsBaseline.ts`.
2. [x] Point the exhaustiveness filter at it (semantics unchanged).
3. [x] Add the one-line `toHaveCount(0)` absence test to `e2e/settingsUxVisual.e2e.ts`.
4. [x] `npm test` (1010 pass) + `npm run check` (exit 0).
5. [x] `npm run test:e2e -- settingsUxVisual.e2e.ts` (17 pass).
6. [x] Mutate `GraphToolbar.tsx` → new test RED, exhaustiveness test still GREEN. Revert. Re-verify.
7. [x] PUBLIC + PRIVATE written, commit.

## Environment facts worth keeping

- `npm run test:e2e` WORKS in this container: headless, auto-downloads pinned
  Obsidian 1.12.7. `settingsUxVisual.e2e.ts` runs in ~4s after the build. A whole
  run of that spec + build fits well inside a 600s bash timeout.
- It stops at the FIRST failure (only 3 of 17 tests ran during the mutation run).
  So a mutation run does NOT tell you about tests after the failing one.
- Repo has NO prettier config and no prettier dependency → long lines are fine and
  nothing will reformat the one-line absence assertion. Do NOT add `// prettier-ignore`.
- `main.js` / `styles.css` are gitignored build artifacts; a mutation run leaves the
  mutated build on disk, so re-run the gate after reverting (I did).
- Verbose logs kept at `.tmp/e2e-baseline.log`, `.tmp/e2e-mutation.log`,
  `.tmp/e2e-reverted.log`, `.tmp/e2e-pinned.log`, `.tmp/vitest.log`, `.tmp/check.log`.

## Design notes / gotchas for a successor

- `selectorGuard.test.ts` exempts absence assertions only when
  `/toHaveCount\(\s*0\s*\)/` matches the SAME line as the `.vicinity-graph-*`
  literal. My assertion uses the `TOP_LEVEL_PANEL_SUMMARY_SELECTOR` constant, so
  the line carries no class literal at all — the guard never even looks. Still kept
  it on one line (cheap, and it survives an inline-the-constant refactor).
- `PINNED_CENTRALS_SUMMARY` (bare string) is still used by
  `controlsRestart.e2e.ts:81` and `pinnedCentralScenario.e2e.ts:96` for PRESENCE
  locators. Do NOT delete it. The two constants are a deliberate pair:
  bare = "find it", pattern = "it and nothing else".
- The new test MUST stay above any `clickPin(...)` in `settingsUxVisual.e2e.ts`
  (file is `mode: "serial"`, pins persist within the file). It currently sits right
  after the exhaustiveness test and before the exclusion test. That file pins nothing
  today — if someone adds a pinning test, order matters.
- The mutation to reproduce: `src/view/GraphToolbar.tsx`, `{pinned.length > 0 && (`
  → `{true && (`.

## Follow-ups deliberately NOT taken (out of scope, no ticket filed)

- `controlsRestart.e2e.ts` and `pinnedCentralScenario.e2e.ts` each define an
  IDENTICAL `pinnedDisclosure()` helper (duplication noted in EXPLORATION §2).
  Left alone: the ticket scoped this to one assertion, and merging the helpers means
  a new shared page-object seam. Candidate for a future DRY ticket if it grows a third copy.
