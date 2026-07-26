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
- [x] test inserted (e2e/settingsUxVisual.e2e.ts:380-404)
- [x] 3a PASS
- [x] 3b FAIL-without-fix confirmed, line restored, green again
- [x] 3c whole file 15/15
- [x] 3d check + npm test green
- [x] commit
