---
id: nid_hatwq2jlkhno5t6awcz0q6t9q_e
title: "[decide] node sizing: minPx > maxPx inverts the size ramp, and per-keystroke clamping snaps the field"
status: open
deps: []
links: [nid_9jiira82snkh7bgy8zv060c9r_e]
created_iso: 2026-07-26T01:21:48Z
status_updated_iso: 2026-07-26T01:21:48Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [sizing, settings, ux]
---

Two follow-ups raised in the iteration-1 implementation review of branch `sizing-nonfinite-clamp` (see `.ai_out/node-sizing-nonfinite/sizing-nonfinite-clamp/IMPLEMENTATION_REVIEW__PUBLIC.md`, NIT section). Neither is a regression; both predate that branch.

1. `minPx <= maxPx` is unenforced. `src/engine/constants.ts` `clampSizingSettings` clamps `minPx` and `maxPx` into the SAME `[1, 400]` interval, so clamping can never create an inversion — but a user can still type `minPx = 400`, `maxPx = 40`. `src/engine/NodeSizer.ts` then computes `sizePx = minPx + score * (maxPx - minPx)`, giving a finite but INVERTED ramp (higher score -> smaller node). Geometry stays finite, so nothing downstream breaks; it is a confusing UX only.

2. Per-keystroke clamping snaps the controlled React field. `src/view/SizingSection.tsx` writes on every `onChange`, and `planSettingsWrite` clamps, so typing `500` into Max px lands on `400` mid-stroke and the caret jumps. Clamp-on-blur (or accepting out-of-range text locally and clamping on commit) would be nicer. Same trade-off applies to `src/view/VicinityGraphSettingTab.ts` `addSizingNumber`.

## Acceptance Criteria

- Either minPx/maxPx cannot be stored inverted, or the inversion is visibly rejected in the UI.
- Typing a multi-digit out-of-range value no longer snaps the field mid-keystroke.
- `npm run check` and `npm test` green.


## Notes

**2026-07-26T15:30:38Z**

[decide] Needs a human UX call before implementation: (a) inverted minPx>maxPx — silently normalize (auto-swap / clamp maxPx up) vs. visibly reject with validation UI; (b) commit timing — clamp-on-blur vs. accept out-of-range text locally and clamp on commit. Both choices apply to TWO surfaces (src/view/SizingSection.tsx and src/view/VicinityGraphSettingTab.ts addSizingNumber) and must be consistent. Verified still open: src/engine/constants.ts clampSizingSettings clamps minPx/maxPx independently.

**2026-07-27T18:00:15Z**

Partially answered by branch `settings-debounce-validation` (settings TAB only):

- Item 1: the settings tab now VISIBLY REJECTS an inverted pair (`src/view/sizingRowWrite.ts` + `src/view/settingsValidation.ts` `describeSizingRejection`) — inline message, `aria-invalid`, not persisted, and re-checked again at flush time. The ENGINE-level guard is still absent and is tracked separately as nid_9jiira82snkh7bgy8zv060c9r_e (which needs the same human call: swap vs. clamp vs. reject). `src/view/SizingSection.tsx` (the in-view mirror) is UNCHANGED and can still store an inverted pair.
- Item 2: the tab no longer writes per keystroke (debounced, `src/view/settingsDebounce.ts`), and an out-of-range typed value now states what will be stored instead of silently differing. That field is uncontrolled, so it does not snap. `src/view/SizingSection.tsx` still snaps — that half of the item is untouched and still needs the decision above.
