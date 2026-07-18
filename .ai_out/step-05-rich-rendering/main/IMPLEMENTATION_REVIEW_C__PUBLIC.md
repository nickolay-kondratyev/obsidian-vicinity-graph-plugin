# IMPLEMENTATION_REVIEW_C__PUBLIC — step-05 Phase C (Playwright e2e harness)

Reviewed commit: `6dc9aa1`. Reviewer: IMPLEMENTATION_REVIEWER_C.

## Verdict: **READY**

0 BLOCKER / 0 MAJOR. Findings below are MINOR/NIT — none gate the phase; fold them into a
later iteration or follow-up tickets at the implementer's discretion.

## Independently verified gates (run by reviewer, not copied from claims)

| Gate | Result |
|---|---|
| `npm run test:e2e` run 1 (real Obsidian 1.12.7, headless ozone) | **18/18 passed, exit 0** |
| `npm run test:e2e` run 2 (idempotency) | **18/18 passed, exit 0** |
| Missing `OBSIDIAN_PATH` | **exit 1**, actionable message pointing at AppImage extract + env var |
| `npm test` | 451 passed / 43 files (main) + 69 / 6 (sublib), exit 0 |
| `npm run check` | exit 0 |

Anti-faking check: I confirmed via `pgrep` during the run that a real Obsidian process is
spawned with the harness's `--user-data-dir/.tmp/e2e/...` flags, and that it exits within
seconds of suite completion (SIGTERM latency, no zombies). Runs are genuine and fast because
of warm caches on this machine.

## Checklist verification

1. **Honesty/robustness** — PASS. Zero `waitForTimeout`; the only polling is a bounded,
   condition-based 250ms loop for the vault window (CDP has no covering event — WHY-documented,
   `e2e/obsidianHarness.ts:299-309`). All assertions are auto-retrying locators/`expect.poll`
   on DOM/app state. No screenshots, no LLM judgment (Q5 satisfied). No swallowed exceptions:
   every failure path throws with context (stderr dump on launch failure, page URLs on missing
   window). Launch failure kills the spawned process (`launch()` catch).
2. **Coverage vs exit criteria** — PASS. Tiers (exactly-one-main + zero pinned-central),
   frontmatter + trimmed titles, breadcrumb positive (`solo/`) and negative (root note),
   groups + labels + badge-absent negative, crowd `+2` group badge, corner `+6 hidden` overlay
   with per-folder `title` breakdown incl. `(vault root)` + overlay-absent negative, 3 edges all
   with `marker-end`, `×2` badge only on the duplicate edge, `app://` thumbnail + no-badge
   negative, 3 counted chips with exact `attachmentGroupLabel` aria-labels, arrowhead stroke ==
   computed `--text-faint` in BOTH themes and != `#b1b1b7` (named constant), click current-tab,
   ctrl/cmd-click new-tab (+1 markdown leaf). The "Consciously NOT asserted" list in
   IMPLEMENTATION_C__PUBLIC **matches the code exactly** — nothing silently skipped.
   Badge copy is imported from `src/view/badgeText.ts`/`attachmentIcons.ts`, never re-typed.
3. **Isolation/idempotency** — PASS. Fresh vault copy + fresh sandbox `--user-data-dir` per run
   under `.tmp/e2e/`; stale plugin `data.json` explicitly removed; e2e `crowd/` fixtures are
   written only into the COPY (committed `.dev-vault` and `scripts/setup-dev-vault.sh` fixtures
   untouched — verified the script's output vs the harness). Rerun passed identically.
4. **CDP approach** — PASS. `connectOverCDP` vs `_electron.launch` WHY-NOT is documented
   (Electron fuses ignore `--inspect=0`) and consistent with observed behavior;
   `--remote-debugging-port=0` = OS-assigned, collision-safe; endpoint parsed from stderr with
   timeout + exit + error handlers. Process cleanup on both success (`close()`) and launch
   failure (catch → kill). See MINOR-1 for the one gap.
5. **Separation** — PASS. `vitest.config.ts` includes only `src/**/*.test.{ts,tsx}`; e2e runs
   only via `test:e2e` (`setup:dev-vault` → `tsc -p e2e/tsconfig.json` → playwright).
   `@playwright/test` is a devDependency; no prod dep creep. e2e typechecks clean, emits nothing.
6. **No production code modified** — VERIFIED. `git show --stat 6dc9aa1` touches only `e2e/*`,
   `package.json`, `package-lock.json`, `README.md`, `.ai_out/*`.
7. **Quality** — PASS. Named constants throughout (timeouts, sidebar width, cap, counts,
   `RF_DEFAULT_ARROWHEAD_COLOR`), WHY/WHY-NOT comments on every non-obvious mechanic (fuses,
   `--no-sandbox`, runtime plugin enablement vs leveldb seeding, remount-for-fitView, sidebar
   detach rationale citing observed pointer-interception failures), repo logging convention
   (`path=[${...}]`) respected, TypeScript kept simple.

## MINOR findings

- **MINOR-1** `e2e/obsidianHarness.ts:128-132` — `close()` calls `await this.browser.close()`
  then `this.obsidianProcess.kill()` sequentially. If `browser.close()` rejects (e.g. CDP
  connection already dropped), the kill is skipped and the Obsidian process is orphaned for the
  rest of the CI job. Direction: wrap in try/finally so `kill()` always runs.
- **MINOR-2** `e2e/neighborhoodGraph.e2e.ts` — intra-file test-order coupling (e.g. line 191
  "note2 is now MAIN (previous test)"; truncation test assumes default cap survived earlier
  tests). This is a conscious, documented design (one Obsidian instance, `mode: "serial"` which
  skips the remainder on first failure, fresh vault per run), so I accept it for KISS; noting it
  so the tradeoff is on record — anyone appending tests must read the serial-state comment first.

## NITs (no action required)

- **NIT-1** `e2e/obsidianHarness.ts:113` — `OBSIDIAN_E2E_EXTRA_ARGS` split on single spaces;
  quoted values containing spaces are unsupported. Fine for Chromium flags; a doc-comment word
  ("space-separated flags, no quoting") would close it.
- **NIT-2** `e2e/obsidianHarness.ts:43` — duplicated `VIEW_TYPE_NEIGHBORHOOD_GRAPH` is
  WHY-documented and the right call under Phase C's no-production-change constraint. Follow-up
  idea: move the constant into an obsidian-free module (e.g. `src/view/constants.ts`) in a later
  step and import it here, deleting the duplication.
- **NIT-3** `e2e/neighborhoodGraph.e2e.ts:205` — the truncation test mutates the global nodeCap
  and runs last, so within-run state after it is non-default. Harmless today (fresh copy per
  run) — just keep cap-mutating tests last or reset if the file grows.
- `setTheme` toggles `theme-dark`/`theme-light` body classes directly rather than driving
  Obsidian's own toggle; that IS mechanically how Obsidian applies themes, and the assertion
  reads real computed styles, so I judge it genuinely state-based, not a fake.

## Documentation

README e2e section is accurate (verified every command in it, including the headless variant).
No CLAUDE.md updates required by this change.

(No `#QUESTION_FOR_HUMAN` items.)
