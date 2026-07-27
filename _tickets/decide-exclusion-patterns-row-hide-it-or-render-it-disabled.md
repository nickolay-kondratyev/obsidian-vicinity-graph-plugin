---
id: nid_qp56jugz8en8wkgjirwcb269p_e
title: "[decide] Exclusion patterns row: hide it, or render it disabled?"
status: open
deps: []
links: []
created_iso: 2026-07-27T18:39:36Z
status_updated_iso: 2026-07-27T18:39:36Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [settings, ux]
---

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

