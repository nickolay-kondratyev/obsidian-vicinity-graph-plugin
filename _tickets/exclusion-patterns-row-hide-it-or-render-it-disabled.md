---
closed_iso: 2026-07-30T02:29:24Z
id: nid_qp56jugz8en8wkgjirwcb269p_e
title: "Exclusion patterns row: hide it, or render it disabled?"
status: closed
deps: [nid_armoson86j0ii8c33r1odo1rc_e]
links: [nid_1rslube8at5xj60ji4jeve0b0_e, nid_armoson86j0ii8c33r1odo1rc_e, nid_klkdpmx6axf90y4xj8khwrlf2_e, nid_que9qloigra7ku2boh83qizz0_e]
created_iso: 2026-07-27T18:39:36Z
status_updated_iso: 2026-07-30T02:29:24Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [settings, ux, settings-cleanup]
---

Overarching context and chain ordering for the settings cleanup: docs-internal/notes/settings.md (grouping tag: settings-cleanup).
The settings tab (`src/view/VicinityGraphSettingTab.ts`, `renderExclusion` / `showExclusionPatterns`) HIDES the "Exclusion patterns" textarea row whenever the "Exclude notes from the graph" toggle is off. That behaviour predates the row-refresh fix in ticket nid_9k11zke41l6ze3p7n7suuo4v2_e, which only changed HOW the row is swapped (one slot, no full `display()` rebuild) and deliberately kept the hide/show semantics.

Obsidian's own settings guidance (see the `obsidian-settings` skill, "Progressive disclosure") argues the other way:
- "Prefer conditional `disabled` over `visible: false` when a control is irrelevant-right-now but real: it keeps the model discoverable and searchable."
- From Obsidian 1.13, a hidden row is ALSO dropped from global settings search.
- Hiding a single control is "cost without benefit"; the disclosure threshold in that guidance is >=3 rows.

Against changing it: the stored patterns are genuinely inert while the toggle is off, and a visible-but-dead textarea can read as "these still apply". The row also carries live per-keystroke regex feedback that would be odd on a disabled control.

This is a UX call, not a mechanics one — hence [decide].

## Design

If the decision is "render it disabled": `showExclusionPatterns` becomes a `setDisabled` flip on the already-built row (mirroring what the sizing-metric toggle now does to its weight input), and `src/view/VicinityGraphSettingTab.ts` no longer needs the slot div.

DOM contract to re-check first — these currently assume the row is ABSENT while disabled:
- `e2e/settingsResetVerify.e2e.ts:64` and `:100` assert `card("Node exclusion").locator("textarea")` count 0 / value.
- `e2e/settingsUxVisual.e2e.ts` MIN_NAMED_CONTROLS (20) and the ANY_UNNAMED_CONTROL guard; its accessible-name test explicitly enables exclusion first so the textarea exists.
- `e2e/settingsDependentRows.e2e.ts` asserts the row appears/disappears across the toggle.

## Acceptance Criteria

A decision is recorded (comment in `renderExclusion` / this ticket), and if the answer is "disabled": the row renders always, disabled while the toggle is off, with the e2e specs above updated to match and `npm run test:e2e` green.


## Notes

**2026-07-29T17:28:25Z**

DECISION (owner, 2026-07-29): ALWAYS RENDER, DISABLED when the toggle is off.

Use setDisabled(!enabled) -- the identical pattern already lives one section away in the same file
(VicinityGraphSettingTab.ts:530,552, the sizing weight inputs), so this buys consistency for free.
Delete the slot indirection and the "stale repaint" hazard that showExclusionPatterns documents.

JUSTIFICATION IS CODE DELETION, NOT DISCOVERABILITY -- correcting an earlier overstatement in this
ticket: the "Enable exclusion patterns" TOGGLE is always rendered, so searching "exclusion" finds
that row either way. Only the textarea's own name/description is lost to settings search while off.
That is a minor loss; the decision rests on removing the slot + repaint dance.

Also note: the ticket body's claim "from Obsidian 1.13 a hidden row is dropped from global settings
search" is UNVERIFIED -- the pinned typings do not expose the search indexer, and minAppVersion is
1.12.4, so 1.13 search is above our floor regardless. Do not cite it as a reason.

COSTS: update e2e/settingsResetVerify.e2e.ts:64,100, settingsUxVisual.e2e.ts MIN_NAMED_CONTROLS, and
settingsDependentRows.e2e.ts. Replace the WHY-NOT comment at VicinityGraphSettingTab.ts:~403 that
points at this ticket.

In the new descriptor model (see docs-internal/notes/settings.md) this becomes a declarative disabledWhen
flag rather than hand-written branching -- prefer landing it that way if the descriptor-model ticket (nid_wimjq4ewgbg21n4zx9d4qq3a0_e) lands
first.

**2026-07-30T02:29:24Z**

DONE by nid_armoson86j0ii8c33r1odo1rc_e, per the owner decision recorded here (always
render, DISABLED). Implemented declaratively as disabledWhen: "exclusion-enabled" on
the row in src/view/settingsRows.ts - the hand-written showExclusionPatterns branch,
its slot div and its WHY-NOT comment are deleted from
src/view/VicinityGraphSettingTab.ts. disabledWhen is compile-restricted to
DEPENDENCY_AWARE_CONTROL_KINDS so it cannot be declared on a kind no presenter honours.
The three e2e specs named here were updated but NOT executed (needs real Obsidian) -
tracked by nid_9wed7bqboqb83aghmt1sctv90_e.
