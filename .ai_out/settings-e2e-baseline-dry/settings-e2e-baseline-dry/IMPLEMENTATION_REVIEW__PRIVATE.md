# IMPLEMENTATION_REVIEW__PRIVATE — working notes

## Evidence gathered (rehydration anchors)

- Diff scope: only `e2e/settingsBaseline.{ts,test.ts}` (new), the 3 settings
  specs, one new `_tickets/` file. **Zero `src/` changes.** Confirmed via
  `git diff main...HEAD --name-only`.
- `src/view/settingsResetPlan.ts:179-186` — `SECTION_RESET_SCOPES` = 6, order
  depth-defaults, node-sizing, node-contents, force-layout, node-exclusion,
  performance. Matches `VicinityGraphSettingTab.display()` (lines 126-133:
  renderDepthDefaults, renderSizing, renderNodeContents, renderForceLayout,
  renderExclusion, renderPerformance). Order claim verified.
- Exactly 6 `setHeading()` in `src/view/` (grep) → the new
  `.setting-item-heading .setting-item-name` `toHaveText` cannot over/under-match.
- Exhaustiveness proof: built a throwaway `.tmp/exhaust/` with a 7-scope stub
  `settingsResetPlan` + the real `settingsBaseline.ts`; `tsc` emitted
  `TS2741 Property '"edge-routing"' is missing`. Scratch dir deleted afterwards.
- Root `tsconfig.json` include = `src/**` only; `package.json` scripts have no
  `tsc -p e2e/tsconfig.json`; no `.github/workflows/`. → basis for S-1.
- `vitest.config` include = `["src/**/*.test.{ts,tsx}", "e2e/**/*.test.ts"]` →
  `settingsBaseline.test.ts` really does run under `npm test` (6 tests, verified
  standalone). This is the runtime net that softens S-1 from BLOCKING.
- `vaultTarget.test.ts` scans every `e2e/*.ts` except itself; the two new files
  contain no `fs.` token and no `"node:fs` line → both scans vacuously pass.
- Anchor diff (`grep -o "ap_[a-zA-Z0-9_]*"`) identical on all three specs.
- Test-title diff on all three specs: identical sets, identical order, one
  rename in settingsUxVisual (disclosed by the implementer).

## Judgement calls

- Did NOT flag the reset-name derivation as self-fulfilling: the literal pin in
  `settingsBaseline.test.ts:41-54` is genuinely independent (hand-typed, would
  fail on a src rename). This is the crux of the brief's item 1 and it is
  handled correctly.
- DID flag the *heading* literal test (S-2): both sides hand-written in `e2e/`,
  zero independent authority, and it re-introduces a second copy — a real DRY
  hit against the ticket's own goal, not a nitpick.
- N-1 (panel exhaustiveness) deliberately kept as a suggestion, not a change
  request: the pre-change code had no such pin either, so demanding it would be
  scope creep.
- The e2e red is unambiguously pre-existing (branch touches no src, reproduces
  with `-- vicinityGraph` alone). Reported plainly rather than blamed on the
  branch. Implementer's 34/34 claim independently confirmed.

## Not done

- Did not check out `main` to re-run `vicinityGraph.e2e.ts` there. Isolation
  reproduction + zero-src-diff was judged sufficient; if someone wants belt and
  braces, `git stash` is not needed — just `git checkout main && npm run
  test:e2e -- vicinityGraph`.

## Round 2 (restarted reviewer) — evidence

- Delta commit `817cd23`: `package.json` (`check`/`check:e2e`), `scripts/run-e2e.sh`
  (tsc line → WHY-NOT comment), `CLAUDE.md` Commands line, `e2e/settingsBaseline.ts`
  comment-only, `e2e/settingsBaseline.test.ts` 6→2 tests, 2 new `_tickets/`.
  **No spec file touched** → all round-1 spec verdicts carry over untouched.
- run-e2e.sh traced line by line: only forks are L16 (OBSIDIAN_PATH), L25 (display),
  L33 (VICINITY_E2E_VAULT). No early exit. Vault branch → `npm run build`; else branch
  → `setup-dev-vault.sh:377` `npm run build` (exits 1 on failure). Claim TRUE.
- `git show main:e2e/settingsBaseline.test.ts` → not in main. `git diff main...HEAD
  --stat` over `*.test.ts` excluding that file → EMPTY. Deletion concern closed hard.
- Timings: `npm run check` 2.3s vs bare `tsc -noEmit` 1.4s → check:e2e ≈ 0.9s. `dev`
  script does NOT call check, so watch loop unaffected.
- Re-ran: check 0, `npm test` 988/74 files, `test:e2e -- settingsUxVisual settingsReset`
  34 passed exit 0. Logs `.tmp/r2_check.txt`, `.tmp/r2_test.txt`, `.tmp/r2_e2e_settings.log`.
- Did NOT re-prove the TS2741 guard by mutating a key (review-only mandate); it is the
  same `tsc -p e2e/tsconfig.json` invocation round 1 proved, now merely chained from
  `check`. Mechanically sound.
- New docs staleness found by grepping `npm run check|tsc -p|run-e2e`: README:215
  Scripts table (SHOULD-FIX), docs-internal/notes/e2e-obsidian-docker-setup.md:80
  (NIT), run-e2e.sh header L7 (NIT).

## Verdict
SIGNAL READINESS. 0 blocking. Only R2-1 (README one-liner) is worth a fix before merge.
