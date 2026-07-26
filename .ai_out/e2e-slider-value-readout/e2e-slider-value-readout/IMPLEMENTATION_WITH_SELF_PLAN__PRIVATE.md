# PRIVATE working notes — e2e slider value readout

## Plan
Goal: one e2e test in `e2e/settingsUxVisual.e2e.ts` that fails on 1.12.7 if `setDynamicTooltip()`
is dropped from `addLabeledSlider`.

Strategy chosen: **(a) mechanism-agnostic, TEXT-only, after hover.**
- Locate the "Outline depth" row (non-advanced, always visible) via `.setting-item` `has` the
  `input[aria-label="Outline depth"]`.
- Read current value with `inputValue()`.
- Readout locator = `.tooltip` filtered to /^value$/  **OR**  exact text inside the row's
  `.setting-item-control`.
- Assert visible AFTER hover only.

Trap avoidance:
- text-based matching → the `<input value=...>` attribute cannot satisfy it (inputValue is not text).
- scoped to `.setting-item-control` (name/desc live in `.setting-item-info`) + exact/anchored match →
  a digit in the row name/desc cannot satisfy it.

No pre-hover "absent" assertion: on >=1.13 the inline readout is present before hover → that would be
a false RED after a minAppVersion bump. Teeth do not need it (on 1.12.7 without setDynamicTooltip the
value text exists nowhere).

Version gate rejected: no verified runtime version expression exists in the repo (exploration §5 says
both candidates are unverified) and a gate would need a second, untestable 1.13 branch.

## Steps
1. Insert test after the preview-pill test (line 378), before line 380 (serial mode).
2. 3a run new test alone.
3. 3b remove `.setDynamicTooltip()` → must fail → restore → green again.
4. 3c whole file. 3d `npm run check`, `npm test`.
5. Commit.

## Progress
- [x] plan
- [x] test inserted (e2e/settingsUxVisual.e2e.ts — WHY block from 380, test 401-426)
- [x] 3a PASS
- [x] 3b FAIL-without-fix confirmed, line restored, green again
- [x] 3c whole file 15/15
- [x] 3d check + npm test green
- [x] commit

## Iteration 1 (review response)
- SF-1 incorporated: `page.mouse.move(0, 0)` before `slider.hover()`. Rejected the optional
  pre-hover ABSENT assertion (union's inline arm exists pre-hover on >=1.13 → false RED; a
  .tooltip-only negative races teardown).
- SF-2 incorporated: `@see e2e/...` line in the `addLabeledSlider` doc block (comment-only).
- N-1 incorporated (regex-escape the interpolated value). N-2 rejected (leading reset is the
  stronger contract; trailing would duplicate it). N-3 rejected/no-op (already documented).
  N-4 fixed above.
- **GOTCHA for the next probe**: `git checkout <file>` to restore the deleted
  `.setDynamicTooltip()` ALSO wiped the uncommitted SF-2 comment in the same file. Caught via
  `grep -n "@see e2e"` and re-applied. Restore surgically next time.
- Re-verify: (a) 15/15 EXIT=0 `.tmp/it1-a.log`; (b) probe FAIL EXIT=1 `.tmp/it1-b.log`
  ("element(s) not found", both arms), restored → 15/15 `.tmp/it1-b-restored.log`;
  (c) CHECK_EXIT=0, TEST_EXIT=0, 966 tests.
- [x] committed, tree clean.
