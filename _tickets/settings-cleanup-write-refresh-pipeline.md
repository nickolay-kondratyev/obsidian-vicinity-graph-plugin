---
id: nid_m5hxe4eo9jgt7cfic7s2o3uvi_e
title: "Settings cleanup — write pipeline: one settings write/refresh pipeline (single serial chain, reset drains it, one fan-out rule)"
status: open
deps: [nid_wimjq4ewgbg21n4zx9d4qq3a0_e]
links: [nid_4zffe7mj5p1eabi9m6wfh06k0_e, nid_8b97fdqznqsncc5kgya1p871w_e]
created_iso: 2026-07-29T17:29:52Z
status_updated_iso: 2026-07-29T17:29:52Z
type: task
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [settings, settings-cleanup, persistence, architecture]
---

Overarching context, ordering rationale and standing owner decisions: docs-internal/notes/settings.md (grouping tag: settings-cleanup, step 3 of the chain).

Part of the settings cleanup approved by the owner on 2026-07-29. Builds on the descriptor-model ticket (nid_wimjq4ewgbg21n4zx9d4qq3a0_e).

PROBLEM: the settings write path is three hand-rolled serial promise chains plus ad-hoc refresh, which produces four separate open bugs that are really ONE subsystem defect:
- nid_8b97fdqznqsncc5kgya1p871w_e -- reset display() rebuilds AHEAD of a queued write
- nid_4zffe7mj5p1eabi9m6wfh06k0_e -- three hand-rolled serial promise chains (store / debounce / write queue) want one SerialPromiseChain helper in src/shared/
- docs-internal/tickets/ticket-per-doc-write-leaves-sibling-views-stale.md -- a per-doc write does not refresh sibling views showing the same doc
- docs-internal/tickets/ticket-controls-optimistic-input-latency.md -- panel controls write from a STALE snapshot, so a sizing edit can clobber sibling fields

GOAL:
1. ONE serial chain abstraction in src/shared/ (per the layering rule: no obsidian/react imports).
2. Writes always built from FRESHLY READ globals, never from a captured snapshot -- this is what stops sibling-field clobbering.
3. Reset DRAINS the queue before rebuilding, instead of racing it.
4. ONE refresh fan-out rule that covers per-doc writes AND sibling views on the same doc.
5. Controls stay optimistic locally so typing does not feel laggy, while the persisted write is serialised.

These four tickets should be closed as merged into this ticket once it lands; do not fix them piecemeal, the whole point is that they share a cause.

