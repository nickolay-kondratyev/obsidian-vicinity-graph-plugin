---
id: nid_hatwq2jlkhno5t6awcz0q6t9q_e
title: "node sizing: minPx > maxPx inverts the size ramp, and per-keystroke clamping snaps the field"
status: open
deps: [nid_armoson86j0ii8c33r1odo1rc_e]
links: [nid_9jiira82snkh7bgy8zv060c9r_e, nid_9uzrvqv0k5qgckgdaqtgr41ky_e]
created_iso: 2026-07-26T01:21:48Z
status_updated_iso: 2026-07-26T01:21:48Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [sizing, settings, ux, settings-cleanup]
---

Overarching context and chain ordering for the settings cleanup: docs-internal/notes/settings.md (grouping tag: settings-cleanup).
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

**2026-07-29T17:28:48Z**

DECISION (owner, 2026-07-29): RAISE maxPx TO minPx at the engine choke point + blur-commit the panel.

This ticket now OWNS the whole sizing-bounds invariant. nid_9jiira82snkh7bgy8zv060c9r_e (the engine
half) is MERGED INTO THIS ONE and closed -- they were the same invariant at two different doors.

RULE: when minPx > maxPx, raise maxPx to minPx. Enforce it in clampSizingSettings -- the SINGLE
choke point already run by NodeSizer.compute, parseSizing (load) and planSettingsWrite -- so one
added line closes all three doors at once.

WHY this rule over swap / reset-to-defaults:
- Never shrinks nodes unexpectedly (swap would silently make the user's Min/Max labels disagree with
  what they typed; reset-to-defaults discards a deliberately-typed value).
- The UI still REJECTS first, so this engine rule is only a hand-edited-JSON backstop. It never has
  to be explained to a user, which is exactly why a slightly-lossy rule is acceptable here.

UI HALF: src/view/SizingSection.tsx is fully controlled and writes on EVERY onChange -- that is the
field-snapping. Make the fields uncontrolled/blur-committed and reuse describeSizingRejection so the
panel refuses the write the same way the tab does. The settings tab already fixed its half via
settingsDebounce.ts + an uncontrolled field; this is bringing the panel to parity.

BEHAVIOUR-CAPTURING TEST TO UPDATE (explicit alignment given here, do not skip it silently):
src/engine/NodeSizer.test.ts:359 currently PINS the inverted ramp as accepted behaviour. It must be
rewritten to assert the raise-max rule. Call this out in the PR.

**2026-07-30T02:28:50Z**

FILE RENAMES (nid_armoson86j0ii8c33r1odo1rc_e): every reference to
src/view/SizingSection.tsx in this ticket is now src/view/SettingsRowView.tsx -
specifically SizingNumberRow (min/max/k) and the shared NumberRow it renders. The
settings-tab half is unchanged (VicinityGraphSettingTab.addSizingNumber).

SCOPE GREW BY ONE ROW: the panel now also has a Node cap row (NodeCapRow, same
NumberRow shape) and it has the SAME open problem, in a sharper form - it refuses an
out-of-spec keystroke on a CONTROLLED input, so the field cannot be backspaced to
blank on the way to a new number (select-and-retype works). Documented at the call
site. The [decide] question is unchanged and now covers this row too.

**2026-07-30T08:09:32Z**

IMPLEMENTED (not closed -- top-level agent closes).

ENGINE: src/engine/constants.ts clampSizingSettings now raises maxPx to the CLAMPED minPx.
One line, three doors (NodeSizer.compute, parseSizing on load, planSettingsWrite).

UI: src/view/SettingsRowView.tsx NumberRow is now uncontrolled + blur-committed (Enter
blurs into the same handler), split into NumberRow (owns the optimistic stored value)
and NumberField (owns the text + the refusal, remounted via key={shown} to reseed).
SizingNumberRow feeds it a SizingRowWrite -- the SAME object the settings tab judges
with -- so the panel refuses an inverted pair with the same describeSizingRejection
copy, aria-invalid and aria-describedby. NodeCapRow feeds NO_CROSS_FIELD_RULE and is
fixed by the same change; its KNOWN-LIMIT call-site comment is gone.

NEW pure seam: src/view/numberRowCommit.ts (+ colocated BDD test) -- nothing in npm test
renders React, so the blur decision lives outside the component.

DELIBERATE DIFFERENCE from the tab: the panel shows REFUSALS only, not the tab's
'Stored as N - the allowed range is ...' notice. The panel reseeds its field from the
store on an accepted commit, so a capped value is stated by the field itself; the tab
keeps the typed text and therefore needs the sentence.

NodeSizer.test.ts's inverted-ramp test was rewritten per the 2026-07-29 alignment.
Two spec-walking tripwires also moved, in the open: settingsSpecPersistence now names
the ONE declared cross-field repair (minPx moves maxPx, pinned separately by a new
persistedShapes test), and settingsRowAccessors' round-trip probe writes at the range
CEILING instead of the floor.

FOLLOW-UP FILED: nid_9uzrvqv0k5qgckgdaqtgr41ky_e -- the per-metric WEIGHT input in
SizingMetricRow has its own markup and is still controlled/per-keystroke.

npm run check green; npm test 1265 passed.

**2026-07-30T08:38:29Z**

CORRECTION to the iteration-1 note (round-2 review, non-blocking item).

That note claimed the panel's number field "always ends up showing the STORED number — by the store echo after a write, and by the reseed after a non-write". The second half was over-claimed: a WRITE is no guarantee that the row moves. A field already sitting at a NODE_SIZE_PX_BOUNDS bound (1 / 400) and typed past it is accepted (`rejected: false` + a cap notice the panel discards), the optimistic `settlesAt` lands back on the stored number so nothing echoes, and the old rule (reseed only when the commit wrote nothing AND said nothing) left the box holding an unstored number with no message. Same for text that merely respells the stored value (`007`).

Fixed rather than softened: `NumberRowCommit.reseedsFromStore` is now `this.refusal === undefined` — reseed after EVERY commit the panel did not refuse. No regression on the ordinary accepted write: `NumberRow`'s `key={shown}` already replaces the whole field on a store echo, so the extra remount request lands on an already-replaced component; a refused commit still keeps the typed text, which is what its reason is about. Started RED in src/view/numberRowCommit.test.ts (2 failing), and the doc comment in src/view/numberRowCommit.ts now states the rule as implemented.
