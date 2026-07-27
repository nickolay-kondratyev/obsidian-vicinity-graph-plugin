---
closed_iso: 2026-07-27T23:43:24Z
id: nid_7ni3rjx3bx6w2bdfvpp7wj0xb_e
title: "Settings tab: rapid double-toggle can persist the older value (writes are not serialized)"
status: closed
deps: []
links: []
created_iso: 2026-07-27T18:54:08Z
status_updated_iso: 2026-07-27T23:43:24Z
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


## Notes

**2026-07-27T23:43:24Z**

RESOLVED on branch settings-write-serialization (fix commit c1315ac).

Fix: new pure `src/view/settingsWriteQueue.ts` (single pre-caught promise tail, matching the repo idiom `tail.catch(() => undefined).then(task)` already used by PluginDataStore.writeChain and DebouncedSettingsWrites.draining). `VicinityGraphSettingTab` gained `writeQueue` + `enqueueWrite()`, and all 8 interaction write paths (both toggles, outline/depth/force-layout sliders, preview radio, both reset paths) are enqueued as a WHOLE task.

Key correction to this ticket as filed: `applyInteraction()` did NOT itself await `settlePendingWrites()` — that await lives at the two toggle call sites, and both read their store snapshot AFTER it. So queueing only `persist()` would NOT have fixed the bug; the serialized region has to start before the snapshot read, making `settle -> snapshot -> plan -> persist -> refresh` atomic per interaction. The force-layout slider read was moved inside the task for the same reason.

Debounced thunks deliberately stay OFF the queue: a queued task drains them via `settlePendingWrites()`, so enqueuing there would deadlock (task -> flush -> drain -> thunk chaining behind its own caller). Reviewer independently confirmed this is a real deadlock, not a rationalization, and that the residual timer-drain interleaving is benign (read -> `this.data = updated` is one uninterrupted synchronous stretch at all three read sites).

Test honesty: the ticket warned a naive double-click test cannot fail. The test uses an injected gate so the earlier task finishes LAST. Verified twice (implementer + reviewer independently) by stubbing `enqueue` to a pass-through: 2 failed | 2 passed, restored to all-green. Covers ordering, rejection isolation, and caller-surfacing of failures.

Verification: npm test 83 files / 1143 tests pass; npm run check exit 0. No e2e added — the pure-module unit test matches repo precedent (the tab has no vitest harness: node env, no jsdom, obsidian is types-only).

Follow-ups filed: nid_4zffe7mj5p1eabi9m6wfh06k0_e (DRY the 3 serial-chain sites), nid_8b97fdqznqsncc5kgya1p871w_e (narrow reset display() vs queued write gap, no data loss).
