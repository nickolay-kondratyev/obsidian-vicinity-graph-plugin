# UI_IMPLEMENTATION_ITERATION__PUBLIC.md — settings-ux-improvements

## Iteration 1 (response to review verdict APPROVED-WITH-MINORS: 0 blocking / 1 minor / 3 nits)

Commit: `431e33e` — `test(settings-ux): iteration 1 — e2e truly opens Advanced-spacing
disclosure; truthful theme screenshots; release-checklist toggle re-verify note`.
No product source changes (none needed — all findings were test-evidence/process quality,
per the reviewer's own assessment).

| Finding | Disposition | What was done |
|---------|-------------|---------------|
| M1 (MINOR) — spec never actually opened the Advanced-spacing disclosure | **FIXED** | `e2e/settingsUxVisual.e2e.ts` now locates `details.vicinity-graph-forcelayout__advanced` by its own class (the summary-text `has:` locator also matched the ancestor Force-layout `<details>`, so `setOpen`'s `.first()` opened the wrong element), asserts it carries `open`, and asserts both advanced sliders ("Node spacing", "Group member spacing") are **visible** — closing the `toHaveCount`-counts-hidden gap. |
| N1 — no throttle on force-slider `input` (full persist+rebuild per drag tick) | **REJECTED** | Speculative complexity: exact parity with settings-tab behavior, controller is latest-wins, no jank observed by implementer or reviewer (who marked it "watch item, not a change request"). If it ever surfaces, throttle at the component level, never the write path (documented in PRIVATE.md). |
| N2 — ToggleSwitch relies on Obsidian's internal `checkbox-container` markup contract | **ACCEPTED** | One-line item added to `docs-internal/RELEASE_CHECKLIST.md` §1: visually re-verify the in-graph exclusion toggle on Obsidian version bumps. |
| N3 — "dark" screenshots were actually light (sandbox boots LIGHT) | **ACCEPTED** | Spec now sets the theme explicitly before each capture: `setTheme("dark")` → `settings-tab-cards-dark.png`, `setTheme("light")` → `settings-tab-cards-light.png`; ambiguous unsuffixed filename retired and stale artifact deleted. New dark capture visually verified genuinely dark. |

## Verification (all green, truthful)

- `npm run check` — pass (`.tmp/iter1-check.log`).
- `npm test` — 61 files, **730/730** pass (`.tmp/iter1-test.log`).
- `npm run test:e2e -- settingsUxVisual.e2e.ts controlsRestart.e2e.ts pinnedCentralScenario.e2e.ts`
  vs real headless Obsidian — **7/7 pass** (`.tmp/iter1-e2e.log`), including the tightened
  force-layout test proving the advanced sliders are genuinely revealed and user-reachable.
