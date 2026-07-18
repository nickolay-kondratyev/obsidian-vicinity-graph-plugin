# IMPLEMENTATION_REVIEWER_C__PRIVATE — clone memory

Reviewed commit `6dc9aa1` (Phase C Playwright e2e harness). Verdict: **READY**, 0 blockers, 0 majors.

## What I verified myself (2026-07-18)
- `npm test`: 451/43 files (main) + 69/6 (sublib), exit 0. Log: `.tmp/reviewC-npm-test.log`.
- `npm run check`: exit 0. Log: `.tmp/reviewC-check.log`.
- `npm run test:e2e` with `OBSIDIAN_PATH=$PWD/.tmp/squashfs-root/obsidian` and
  `OBSIDIAN_E2E_EXTRA_ARGS="--ozone-platform=headless --disable-gpu"`:
  **run 1 = 18/18 exit 0** (`.tmp/reviewC-e2e-run1.log`), **run 2 = 18/18 exit 0**
  (`.tmp/reviewC-e2e-run2.log`) — idempotent. Run 2 wall time 3.9s TOTAL (warm caches, fast box);
  I confirmed a REAL Obsidian process was spawned with the harness flags (pgrep during run) —
  runs are genuine, not faked. Obsidian process exits within seconds of suite end
  (SIGTERM latency, not a zombie; pgrep clean shortly after).
- Missing OBSIDIAN_PATH: exit 1 with actionable message (`.tmp/reviewC-e2e-nopath.log`).
- Diff scope: only `e2e/*`, `package.json`, `package-lock.json`, `README.md`, `.ai_out/*` —
  no production/test source touched. Confirmed via `git show --stat 6dc9aa1`.
- No `waitForTimeout` anywhere; only two `setTimeout` uses in harness: a launch timeout timer
  and a 250ms bounded condition poll for the vault window (both WHY-documented).
- `vitest.config.ts` include = `src/**/*.test.{ts,tsx}` → e2e can never leak into `npm test`.
- e2e tsc emits nothing into `e2e/` (root tsconfig noEmit inherited).
- Skip list in IMPLEMENTATION_C__PUBLIC matches reality (no hover/menu/drag/density/empty-state/
  positive +N-thumbnail tests present in the spec file).
- Coverage vs mission checklist: tiers, breadcrumb, group +N, corner overlay w/ title breakdown,
  arrowheads themed light+dark + never #b1b1b7 (named const RF_DEFAULT_ARROWHEAD_COLOR),
  edge ×N with data-count, icon-strip counts + aria-label from attachmentGroupLabel,
  thumbnail app:// src, view mount + node counts (3/11/3), click + ctrl-click. All present.
- Badge copy imported from `src/view/badgeText.ts` / `attachmentIcons.ts` — no re-typed strings.

## Findings recorded in PUBLIC (all MINOR/NIT)
- MINOR-1: `close()` (obsidianHarness.ts:128-132) — if `browser.close()` rejects, `kill()` skipped → orphan. try/finally.
- MINOR-2: documented test-order coupling in serial file (by design; serial mode skips rest on failure). Accepted.
- NIT-1: `OBSIDIAN_E2E_EXTRA_ARGS` naive split(" ").
- NIT-2: duplicated VIEW_TYPE constant (WHY-documented; right call under no-prod-change constraint; follow-up = move constant to pure module).
- NIT-3: truncation test leaves nodeCap=2 as final state (within-run hazard only for future appended tests).
- setTheme via body classes = mechanically how Obsidian applies themes; judged acceptable state-based.

## Open questions
None. No #QUESTION_FOR_HUMAN.
