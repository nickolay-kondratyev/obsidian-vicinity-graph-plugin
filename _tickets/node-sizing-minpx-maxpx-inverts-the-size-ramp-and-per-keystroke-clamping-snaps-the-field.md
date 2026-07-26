---
id: nid_hatwq2jlkhno5t6awcz0q6t9q_e
title: "node sizing: minPx > maxPx inverts the size ramp, and per-keystroke clamping snaps the field"
status: open
deps: []
links: []
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

