# UI_IMPLEMENTATION_REVIEW__PRIVATE.md — settings-ux-improvements (reviewer memory)

For a future clone of UI_IMPLEMENTATION_REVIEWER. State as of review of commit `b2fd51a`
on branch `settings-ux-improvements` (2026-07-24). Verdict delivered: **APPROVED-WITH-MINORS**
(0 blocking / 1 minor / 3 nits) in `UI_IMPLEMENTATION_REVIEW__PUBLIC.md` (same dir).

## What I did (reproducible)

1. Read CLARIFICATION__PUBLIC / UI_IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC / EXPLORATION_PUBLIC.
   Did NOT read implementer PRIVATE (role hygiene).
2. Diff review: `git show b2fd51a -- src/ esbuild.config.mjs` (saved `.tmp/review-diff.txt`).
3. Ran `npm run test:e2e -- settingsUxVisual.e2e.ts controlsRestart.e2e.ts pinnedCentralScenario.e2e.ts`
   → 7/7 pass (`.tmp/e2e-run1.log`). run-e2e.sh auto-downloads pinned Obsidian 1.12.7 when
   OBSIDIAN_PATH unset and auto-adds `--ozone-platform=headless --disable-gpu` when no display.
4. Wrote my OWN spec + config under `.tmp/review-e2e/` (allowed: read-only applies to src/e2e/build
   config; .tmp is mine). Run it with:
   `export OBSIDIAN_PATH="$(bash scripts/setup-obsidian-bin.sh)"; export OBSIDIAN_E2E_EXTRA_ARGS="--ozone-platform=headless --disable-gpu"; npx playwright test --config .tmp/review-e2e/playwright.config.ts`
   Files: `.tmp/review-e2e/settingsUxReview.e2e.ts` (7 tests), `.tmp/review-e2e/darkTheme.e2e.ts` (1 test),
   `.tmp/review-e2e/playwright.config.ts` (testDir ".", relative screenshot paths resolve vs repo-root cwd).
   Do NOT run two playwright configs concurrently — harness uses fixed `.tmp/e2e/` vault/sandbox dirs.
5. Fresh screenshots → `.out/settings-ux-review/` (01..14). Visually inspected all key ones.

## Key technical facts learned (save future me time)

- **Harness**: `e2e/obsidianHarness.ts` — `ObsidianHarness.launch()`, `openGraphView()`,
  `openFile("note1.md")`, `setTheme()`, `readGlobalView()`, `PLUGIN_ID`. Sandbox Obsidian boots
  **LIGHT** theme (not dark!) — any "default = dark" screenshot label is wrong.
- **Vault graph for exclusion testing**: crowd/c1..c4 all link to note1 → open note1, seed
  `saveNodeExclusion({enabled:false, patterns:["crowd/"]})` + `refreshOpenViews()`, then click
  `.checkbox-container` → 4 crowd nodes leave DOM; badge `.vicinity-graph-exclusion__count` = "4".
- **Locator trap (root cause of implementer M1 finding)**: `.vicinity-graph-disclosure` with
  `has: summary hasText "Advanced spacing"` matches BOTH the nested advanced details AND its
  ancestor Force-layout details (document order puts ancestor first). Implementer's
  `settingsUxVisual.e2e.ts:90` therefore never opens the advanced disclosure; their
  `toHaveCount(6)` passes anyway (counts hidden nodes). Correct selector:
  `details.vicinity-graph-forcelayout__advanced`. My first run failed exactly there
  (`.tmp/review-e2e-run.log`) — that failure was MY selector copying their pattern, not a product bug.
- **Driving React range sliders**: native value setter + `dispatchEvent(new Event("input",{bubbles:true}))`
  (React 18 onChange listens to input; direct `.fill()` doesn't work on range).
- **Live-relayout assertion**: fingerprint `.react-flow__node` `style.transform` map before/after;
  expect.poll until some transform differs. Worked robustly.
- **Settings modal**: `app.setting.open(); app.setting.openTabById(PLUGIN_ID)`. Cards =
  `.vicinity-graph-settings-section` (5). Border check: computed `borderTopStyle/Width` = `solid 1px`.
  fullPage screenshot does NOT capture all 5 cards (modal scrolls internally) — rely on DOM asserts.
- **Keyboard a11y**: `summary.focus()` + `page.keyboard.press("Enter")` toggles details — verified.

## Findings recap + what I deliberately did NOT flag

- M1 (implementer spec advanced-disclosure selector) — suggest follow-up ticket to fix
  `e2e/settingsUxVisual.e2e.ts` (I could not touch it: read-only mandate).
- N1 per-input full rebuild writes (ForceLayoutSection) — parity with settings tab, latest-wins
  controller; fine on dev vault; possible jank on huge vaults. Didn't escalate: pre-existing pattern.
- N2 ToggleSwitch depends on Obsidian `checkbox-container` markup contract — works on 1.12.7,
  documented trade-off; release-checklist watch item.
- N3 implementer's "dark" screenshots were light (sandbox boots light). I captured genuine dark
  (13/14) — renders correctly, so evidence-only nit.
- NOT flagged: index keys in read-only pattern list (justified in comment); sizing metric plain
  checkboxes not being switches (out of scope — only exclusion was required to be a switch);
  Disclosure constant-`open`-prop pattern (correct: React never rewrites unchanged prop, user
  toggling survives — verified behaviorally by defaults test running after prior tests toggled).

## If iteration happens

Re-run both suites (steps 3+4 above) after any fix; the only expected change is the implementer
spec's advanced-disclosure selector. All product convergence criteria already PASS — do not demand
product changes without new evidence.
