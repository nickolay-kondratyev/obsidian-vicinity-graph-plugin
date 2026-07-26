# PRIVATE working notes — IMPLEMENTATION_REVIEWER (iteration 1)

## State
Review complete. Verdict READY. 0 BLOCKING / 2 SHOULD-FIX / 4 NIT.
PUBLIC written to `IMPLEMENTATION_REVIEW__PUBLIC.md`.

## What I actually ran (vs trusted)
- RAN: `npm run test:e2e -- settingsUxVisual.e2e.ts` → 15 passed, EXIT=0, log `.tmp/rev-3c.log`.
  New test reported at `:401`, following tests `:422` and `:438` green.
- RAN: `git diff main...HEAD -- src/` → EMPTY (3b probe fully reverted). Confirmed
  `setDynamicTooltip()` at `src/view/VicinityGraphSettingTab.ts:484`, WHY doc 456-468.
- TRUSTED: 3a, 3b, 3d. Logs `.tmp/3a.log`, `.tmp/3b.log`, `.tmp/3c.log`, `.tmp/3d-*.log`
  exist on disk with self-consistent content; 3b's printed locator byte-matches committed source.
- Suspicious-looking "15 passed (3.3s)" reproduced identically in MY run → harness reports
  totals excluding the `beforeAll` Obsidian boot. Cleared; NOT a faked log.

## Teeth analysis (conclusion: genuine)
Both arms match RENDERED TEXT, so `value` attribute / aria-label / title cannot satisfy.
Inline arm scoped to `.setting-item-control`; name+desc are in sibling `.setting-item-info`;
`getByText(..., {exact:true})` → row-name digits cannot satisfy. `.tooltip` arm anchored `/^2$/`.
`inputValue()` used only to derive the expectation → assertion is value-TIED (wrong value also fails).

## Findings issued
- SF-1: add `await page.mouse.move(0, 0)` before `slider.hover()` (line ~415). Reasons:
  (a) `.tooltip` arm is document-wide + post-hover-only → stale tooltip from an earlier serial
  test could in principle false-green; (b) hover may be a no-op if mouse already at target.
  Does NOT reintroduce the 1.13 pre-hover-assertion problem (action, not assertion).
- SF-2: `src/view/VicinityGraphSettingTab.ts:462-467` WHY doc has no `@see` pointer to the new
  test. Maintainer reads src, not e2e. Comment-only; or file a ticket if src is off-limits now.
- N-1 unescaped regex interpolation (safe today, integer value; breaks for decimal-step sliders).
- N-2 hover/modal state leaks out (benign; following tests close the modal by design).
- N-3 on >=1.13 the "WHEN hovered" name becomes nominal (documented, accepted).
- N-4 PRIVATE impl notes say lines 380-404, actual 401-420.

## Deliberately NOT raised
- Extraction of `openSettingsTab()` — per-file duplication is the stated convention.
- Single-slider coverage — all 10 go through one `addLabeledSlider`; same shape as the
  existing accessible-name test. Implementer already disclosed it.
- Version-gate alternative — implementer's rejection rationale (no verified runtime version
  expression exists in the repo; an unverified gate IS the false-green being fixed) is sound.

## Follow-ups for TOP_LEVEL
- Ticket `nid_14phm98g7w64oparxz5wvfqwh_e` still OPEN → close on merge.
- No `change_log` entry in the diff; branch convention (commit 2631465) expects one.

## If re-invoked (iteration 2)
Check only: SF-1 applied (mouse reset before hover, with WHY comment), SF-2 applied or ticketed,
and that the whole-file e2e is still 15/15. Nothing else needs re-verification.
