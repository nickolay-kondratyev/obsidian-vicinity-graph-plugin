# UI_IMPLEMENTATION_REVIEW__PUBLIC.md — settings-ux-improvements

Reviewer: UI_IMPLEMENTATION_REVIEWER (hands-on QA vs REAL Obsidian 1.12.7, headless, commit `b2fd51a`).

## Verdict: **APPROVED-WITH-MINORS**

0 blocking, 1 minor, 3 nits. All four human requirements verified behaviorally with an
**independent** reviewer-authored e2e spec (7/7 pass) plus the implementer's spec and both
toolbar regression specs (7/7 pass). All findings are in test-evidence quality, not in the
product — no source change required to ship.

## How this was validated (not a code-reading review)

- Ran implementer + regression suites: `settingsUxVisual.e2e.ts`, `controlsRestart.e2e.ts`,
  `pinnedCentralScenario.e2e.ts` → **7/7 pass** (`.tmp/e2e-run1.log`).
- Wrote an independent reviewer spec (`.tmp/review-e2e/settingsUxReview.e2e.ts`, 7 tests) adding
  checks the implementer's spec does NOT have: exclusion toggle actually removes/restores rendered
  nodes; moving a force slider actually moves rendered node positions (live relayout); depth
  stepper + sizing writes still work inside their new disclosures; keyboard focus + Enter on
  disclosure summaries; settings-tab toggle write path after the card refactor → **7/7 pass**
  (`.tmp/review-e2e-run2.log`).
- Separate true-dark-theme run (`.tmp/review-e2e/darkTheme.e2e.ts`) → **1/1 pass** — the sandbox
  boots LIGHT, so previous "dark" screenshots were mislabeled (see N3).
- Fresh screenshots: `.out/settings-ux-review/` (index below).

## Convergence criteria — pass/fail

| # | Requirement (CLARIFICATION) | Status | Evidence |
|---|---|---|---|
| 1 | Settings tab: 5 sections framed as cards, theme-var CSS actually reaches settings DOM, light+dark, controls still write | **PASS** — 5 `.vicinity-graph-settings-section` cards, computed border `solid 1px`, headings all present; exclusion toggle re-renders tab + persists | `10-settings-cards-dark.png` (light-boot), `11-settings-cards-light.png`, `14-settings-cards-true-dark.png`, `12-settings-exclusion-enabled.png` |
| 2 | In-graph force layout: collapsible, 6 sliders (4 main + 2 advanced) + Restore defaults, live re-layout | **PASS** — 6 labelled range inputs (labels match settings tab exactly via shared meta table); dragging Repel 300→1000 visibly re-laid-out nodes (position transforms asserted changed); Restore round-trips persisted values to `EngineDefaults` and the slider follows | `06-forcelayout-open.png`, `07-forcelayout-tuned-relayout.png`, `08-forcelayout-restored.png` |
| 3 | Exclusion = Obsidian-style switch; ON → patterns + count; OFF → just off; toggling filters | **PASS** — real `checkbox-container mod-small`/`is-enabled` switch (pixel-native in light AND dark); ON shows read-only `crowd/` chip + "edited in plugin settings" hint + count badge `4` in the summary (visible while collapsed); the 4 crowd nodes actually leave the graph and return on OFF | `03-exclusion-off.png`, `04-exclusion-on-patterns.png`, `05-exclusion-collapsed-badge.png`, `13-panel-dark.png` |
| 4 | ALL panel sections collapsible; Depth open by default, others collapsed | **PASS** — Depth `open`, Node exclusion / Node sizing / Force layout collapsed on fresh mount | `01-panel-defaults.png` |
| — | Regressions: pinned centrals, sizing, depth steppers, restart persistence | **PASS** — pinned specs 2/2; sizing metric toggle persists through its disclosure; depth stepper steps + resets; controlsRestart restart round-trip green | `02-depth-stepped.png`, `09-sizing-open.png`, `.tmp/e2e-run1.log` |
| — | A11y basics | **PASS** — summaries keyboard-focusable, Enter toggles open/close; all 6 sliders `aria-label`ed (Playwright `getByLabel` resolves them); switch input `aria-label="Exclude notes"`; pattern list `aria-label`ed | reviewer spec test 2 |

## Findings

| ID | Severity | Finding | Evidence |
|----|----------|---------|----------|
| M1 | MINOR | **Implementer e2e selector silently tests less than claimed.** `e2e/settingsUxVisual.e2e.ts:90` — `setOpen(disclosure("Advanced spacing"), true)`: the `has:` locator ALSO matches the ancestor Force-layout `<details>` (it contains the advanced summary), and `setOpen` takes `.first()` = the outer one, so the nested Advanced-spacing disclosure is never actually opened. The `toHaveCount(6)` assertion still passes because count includes hidden elements — so the spec never proves the 2 advanced sliders are user-reachable. Proof: my first run reused this locator pattern and `toBeVisible("Node spacing")` failed with "unexpected value hidden" (`.tmp/review-e2e-run.log`); fixed by targeting `details.vicinity-graph-forcelayout__advanced`. Product itself is fine (re-verified visible + operable). Suggest a follow-up ticket to tighten the spec. | `.tmp/review-e2e-run.log`; e2e/settingsUxVisual.e2e.ts:90 |
| N1 | NIT | Every slider `input` event does a full persist + rebuild + relayout (no debounce/throttle in `ForceLayoutSection.tsx:141`). Parity with the settings tab's existing behavior and latest-wins in the controller keeps it correct; on very large vaults a drag could feel janky and the controlled `value` (fed back via async snapshot) could momentarily fight the thumb. Not observed as a problem on the dev vault. Watch item, not a change request. | src/view/ForceLayoutSection.tsx:136-142 |
| N2 | NIT | `ToggleSwitch.tsx` relies on Obsidian's internal `checkbox-container`/`is-enabled` markup contract (no plugin CSS fallback). Verified pixel-native on 1.12.7 light + dark; the trade-off is documented in the component doc. Re-check on major Obsidian upgrades (release checklist candidate). | src/view/ToggleSwitch.tsx:23 |
| N3 | NIT | Implementer's "dark" screenshot evidence was mislabeled: the e2e sandbox boots the LIGHT theme, so `.out/settings-ux/settings-tab-cards.png` (taken before `setTheme("light")`) is light too — dark mode had zero visual evidence. I captured genuine dark renders and they are correct (cards, disclosures, switch, pattern chips, slider readouts all themed). No product issue. | `.out/settings-ux-review/13-panel-dark.png`, `14-settings-cards-true-dark.png` |

Code-quality review of `git show b2fd51a` beyond the above: clean. Shared `Disclosure` correctly
uses constant-prop `open` so user toggling survives re-renders (doc-commented); copy single-sourced
in `forceLayoutFieldMeta.ts` with compile-time exhaustiveness + partition unit test; all new CSS is
theme-variable-only and scoped (`.vicinity-graph-settings`, `.vicinity-graph-forcelayout__*`);
esbuild CSS list is explicit and ordered; layering untouched (no engine changes). No DRY/POLS
violations found.

## Screenshot index (`.out/settings-ux-review/`, fresh, reviewer-taken)

| # | File | Shows |
|---|------|-------|
| 1 | 01-panel-defaults.png | Panel fresh mount: Depth open, exclusion/sizing/force-layout collapsed |
| 2 | 02-depth-stepped.png | Depth stepper incremented inside its disclosure |
| 3 | 03-exclusion-off.png | Switch OFF: just the off switch, crowd nodes present |
| 4 | 04-exclusion-on-patterns.png | Switch ON: pattern chip `crowd/`, hint, count badge 4, crowd nodes gone |
| 5 | 05-exclusion-collapsed-badge.png | Collapsed exclusion summary still shows count badge |
| 6 | 06-forcelayout-open.png | 6 sliders w/ labels + value readouts, nested Advanced spacing open |
| 7 | 07-forcelayout-tuned-relayout.png | Repel at max → nodes re-laid-out live |
| 8 | 08-forcelayout-restored.png | Restore defaults: values + layout back, button visible |
| 9 | 09-sizing-open.png | Sizing section functional inside disclosure |
| 10 | 10/11-settings-cards-\*.png | Settings cards, light theme (fullPage) |
| 11 | 12-settings-exclusion-enabled.png | Settings-tab toggle ON → textarea re-render |
| 12 | 13-panel-dark.png / 14-settings-cards-true-dark.png | Genuine dark theme: panel + cards |

## #QUESTION_FOR_HUMAN:

None.
