# IMPLEMENTATION_WITH_SELF_PLAN__PRIVATE — working notes

Status: **COMPLETE**. All plan steps done, all verification green (including
real-Obsidian e2e). Committed as `a24113a` + `3c20d03` on
`settings-e2e-baseline-dry`. Nothing left in the working tree.

## Plan (executed, all checked)

- [x] Read EXPLORATION_PUBLIC.md; re-verify line numbers (all still accurate).
- [x] Create `e2e/settingsBaseline.ts`.
- [x] Create `e2e/settingsBaseline.test.ts` (the literal pin — required by the
      "no assertion weakened" hard constraint).
- [x] Edit `settingsResetVerify` (3 edits), `settingsResetReview` (4), `settingsUxVisual` (6).
- [x] `npm run check`, `npx tsc -p e2e/tsconfig.json`, `npm test`, `npm run test:e2e`.
- [x] Prove the compile-time exhaustiveness guard bites (delete-a-key experiment).
- [x] File out-of-scope ticket.

## Facts worth keeping

- **`npm run test:e2e` WORKS in this container.** It accepts a Playwright grep
  arg after `--`, e.g. `npm run test:e2e -- settingsUxVisual`. Runs headless
  against a pinned Obsidian in ~4-6s per spec file. Do not assume it is
  unavailable. Logs redirected to `.tmp/e2e.log` / `.tmp/e2e2.log`.
- `npm run check` only covers the root tsconfig; e2e needs the separate
  `npx tsc -p e2e/tsconfig.json` (which `scripts/run-e2e.sh:39` also runs).
- Obsidian's `Setting.setHeading()` renders `.setting-item-heading` on the
  setting row; the text lives in the nested `.setting-item-name`. Confirmed by a
  passing real-Obsidian assertion, not by reading typings.
- `expect(locator, "message")` (Playwright's second arg) works and `.not` chains
  off it — used to keep per-entry diagnostics in the disclosure loop.
- `readonly string[]` is accepted by Playwright's `toHaveText` / `toHaveCount`
  args — no `[...spread]` copy needed. Verified by tsc.
- `SECTION_RESET_SCOPES` is `as const satisfies readonly SettingsResetScope[]`, so
  `(typeof SECTION_RESET_SCOPES)[number]` is the precise 6-member union — which is
  what makes `Record<SectionResetScope, string>` an exhaustiveness check.

## Judgement calls (rationale in PUBLIC.md, summarised)

1. Left `card("Performance")`-style selector literals alone (readability > DRY
   here; they fail loudly, not silently).
2. Added a heading DOM assertion rather than leaving the heading table unused.
   This was the one runtime-semantics change; it passed in real Obsidian.
3. Renamed one test title to drop the literal "six".
4. Pulled the `"Restore all Vicinity Graph settings"` / `…?` sites into the module
   too — the exploration classifies them as part of the reset-NAME family.

## Round 1 (review iteration) — DONE

- S-1 accepted: `check:e2e` script added, `check` chains it, `scripts/run-e2e.sh`'s
  own `tsc -p e2e/tsconfig.json` line REMOVED (both branches already run
  `npm run build` → `check`). CLAUDE.md Commands line updated.
- S-2 + N-2 accepted, plus the `EVERY_…` ordering test: `settingsBaseline.test.ts`
  went 6 tests → 2. Retained criterion: **only pin values derived from `src`.**
- N-3 rejected in writing (cannot derive without a `SettingsWriteContext`).
- N-1 → ticket `nid_vqw34wdpmb5qzn52cy6qugqgd_e`.
- Pre-existing full-suite red verified on a `main` worktree (13 passed / 1 failed,
  same failure) → ticket `nid_yccejkvl0ccqc77olsgg5deka_e`.
- Numbers: `npm run check` 0; `npm test` 988 passed; settings e2e 34 passed.
- **Worktree trick worth reusing**: `git worktree add .worktree/main-e2e main`,
  `ln -s <repo>/node_modules <wt>/node_modules`,
  `OBSIDIAN_PATH=<repo>/.tmp/obsidian/obsidian-1.12.7/obsidian npm --prefix <wt> run test:e2e -- <grep>`
  — no reinstall, no re-download. Remove the symlink BEFORE `git worktree remove`.

## If someone reopens this

- The two surviving vitest pins in `settingsBaseline.test.ts` are deliberate
  duplication of **src-derived** copy. Do NOT "DRY them away" by importing the
  derived consts and comparing them to themselves — that is exactly the weakening
  the ticket's hard constraint forbids. Equally, do NOT re-add literal pins for the
  hand-written tables (headings, disclosure flags): those were deleted in round 1
  because a literal asserting a literal one file over has no authority.
- `CONTROLS_PANEL_DISCLOSURES` intentionally omits `Pinned centrals (n)`
  (conditional on state) and the nested `Advanced spacing` (asserted separately
  in the force-layout test via `details.vicinity-graph-forcelayout__advanced`,
  which must stay class-based — a summary-text locator matches the ancestor).
- Follow-up ticket: `nid_g4iae40tww9abtwrexdrvic0y_e`.
