---
closed_iso: 2026-07-30T01:17:51Z
id: nid_8b97fdqznqsncc5kgya1p871w_e
title: "Settings reset: display() rebuilds controls ahead of a write queued behind it"
status: closed
deps: [nid_m5hxe4eo9jgt7cfic7s2o3uvi_e]
links: [nid_4zffe7mj5p1eabi9m6wfh06k0_e, nid_m5hxe4eo9jgt7cfic7s2o3uvi_e]
created_iso: 2026-07-27T23:43:06Z
status_updated_iso: 2026-07-30T01:17:51Z
type: bug
priority: 4
assignee: CC_WITH-nickolaykondratyev
tags: [settings, settings-cleanup]
---

Overarching context and chain ordering for the settings cleanup: docs-internal/notes/settings.md (grouping tag: settings-cleanup).
Narrow residual gap found while reviewing nid_7ni3rjx3bx6w2bdfvpp7wj0xb_e (the settings write queue).

`VicinityGraphSettingTab.applyReset()` (src/view/VicinityGraphSettingTab.ts) ends its queued task with a full `this.display()`, which tears down and rebuilds every control. If the user clicks a control in the same tick that a reset is still finishing, that click enqueues behind the reset, but `display()` has already replaced the DOM node the click came from — so the write lands on the store while the freshly-rebuilt control shows the post-reset value.

No data loss: the store is still internally consistent and correct in click order (the write queue guarantees that). The only symptom is a transient store/screen disagreement until the tab is re-displayed — the same class of symptom the write-queue ticket fixed for the common path, but reachable only through reset.

Reported as NON-BLOCKING by IMPLEMENTATION_REVIEWER; see .ai_out/settings-write-serialization/settings-write-serialization/IMPLEMENTATION_REVIEW__PUBLIC.md.

## Design

Low priority — requires a click landing inside the reset round-trip, and self-heals on re-display.

Options to weigh:
1. Have `display()` itself run as (or drain) the write queue so no interaction can be queued across a rebuild.
2. Disable the tab controls for the duration of a reset (honest, but a visible flicker).
3. Accept and document — reset is a deliberate, low-frequency action.

Prefer whichever is simplest; do NOT re-introduce per-control re-seeding after every write (explicitly rejected by nid_7ni3rjx3bx6w2bdfvpp7wj0xb_e — it brings back the focus-stealing repaint that nid_9k11zke41l6ze3p7n7suuo4v2_e removed).

Note the tab has no vitest harness (node env, no jsdom, `obsidian` is types-only), so verification is either an extracted pure module or a Playwright e2e in the e2e/settingsResetVerify.e2e.ts style.

## Acceptance Criteria

GIVEN a settings reset in flight
WHEN the user clicks a control before the reset finishes
THEN the store and the on-screen control agree once both settle.


## Notes

**2026-07-30T01:17:50Z**

RESOLVED by nid_m5hxe4eo9jgt7cfic7s2o3uvi_e (write/refresh pipeline), commits 7588c2b..5520cfa.

Reset no longer races a queued write. The ordering is extracted into src/view/settingsResetSequence.ts: it flushes the pending debounce window, writes the section defaults, DRAINS the shared SerialPromiseChain, and only then calls display(). display() is no longer called from inside a queued task. Each step gets its own tolerating() slot, so a FAILED (or rejecting) defaults write or flush still drains before the rebuild -- the failure mode that made the original bug survive a naive fix. Covered by src/view/settingsResetSequence.test.ts (red-then-green on the failure ordering).
