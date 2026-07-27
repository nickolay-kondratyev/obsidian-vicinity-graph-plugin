---
id: nid_7ni3rjx3bx6w2bdfvpp7wj0xb_e
title: "Settings tab: rapid double-toggle can persist the older value (writes are not serialized)"
status: open
deps: []
links: []
created_iso: 2026-07-27T18:54:08Z
status_updated_iso: 2026-07-27T18:54:08Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [settings]
---

Every settings-tab control writes through `VicinityGraphSettingTab.applyInteraction()` (src/view/VicinityGraphSettingTab.ts), which awaits `settlePendingWrites()` then `persist()` then `refreshOpenViews()`. Nothing serializes those handlers.

Two clicks on the SAME toggle inside one save round-trip therefore start two independent async handlers, and whichever FINISHES last wins the store — which need not be the last one CLICKED. The checkbox in the DOM shows the last click, so the store and the visible control can end up disagreeing until the tab is re-displayed.

This is PRE-EXISTING and tab-wide (sliders, steppers and both dependent-row toggles alike), not introduced by ticket nid_9k11zke41l6ze3p7n7suuo4v2_e. Before that ticket the exclusion toggle happened to hide it, because its handler ended in a full `display()` that re-seeded the checkbox FROM the store, so the two at least agreed with each other.

After the fix, `showExclusionPatterns()` reads the store, so the patterns row always agrees with the store; only the checkbox itself can lag.

## Design

Likely 80/20: give the tab a single write queue (chain each `applyInteraction` onto the previous promise) so writes land in click order. That is one small private field in the tab and removes the whole class of interleavings — no per-control bookkeeping.

Alternative rejected as heavier: re-seed each control from the store after its own write (re-introduces the focus-stealing repaint this ticket family exists to remove).

Note a deterministic test needs a way to delay one persist; consider a seam on `persist()` or an e2e hook rather than timing luck. Do NOT write a double-click test that cannot fail — handlers with identically shaped await chains resolve FIFO in practice, so a naive one passes either way.

## Acceptance Criteria

GIVEN two toggles of the same settings control within one save round-trip
WHEN both handlers have completed
THEN the persisted value equals the value of the LAST click, and the control on screen shows it.

