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

## If someone reopens this

- The vitest pin in `settingsBaseline.test.ts` is deliberate duplication. Do NOT
  "DRY it away" by importing the derived consts and comparing them to themselves
  — that is exactly the weakening the ticket's hard constraint forbids.
- `CONTROLS_PANEL_DISCLOSURES` intentionally omits `Pinned centrals (n)`
  (conditional on state) and the nested `Advanced spacing` (asserted separately
  in the force-layout test via `details.vicinity-graph-forcelayout__advanced`,
  which must stay class-based — a summary-text locator matches the ancestor).
- Follow-up ticket: `nid_g4iae40tww9abtwrexdrvic0y_e`.
