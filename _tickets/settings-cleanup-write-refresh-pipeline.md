---
id: nid_m5hxe4eo9jgt7cfic7s2o3uvi_e
title: "Settings cleanup \u2014 write pipeline: one settings write/refresh pipeline\
  \ (single serial chain, reset drains it, one fan-out rule)"
status: in_progress
deps: [nid_wimjq4ewgbg21n4zx9d4qq3a0_e, nid_ez38gf1mrdgh5kxedzrdicwzl_e]
links: [nid_4zffe7mj5p1eabi9m6wfh06k0_e, nid_8b97fdqznqsncc5kgya1p871w_e, nid_7fq9y51mbucmduzf9z31hmwmq_e, nid_7qot0m6nuxxmd5z0yb9jylsd6_e]
  nid_ez38gf1mrdgh5kxedzrdicwzl_e]
created_iso: '2026-07-29T17:29:52Z'
status_updated_iso: '2026-07-30T00:05:15Z'
type: task
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [settings, settings-cleanup, persistence, architecture]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
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


## Notes

**2026-07-29T22:11:13Z**

SCOPE CHANGE (owner, 2026-07-29): per-doc saved state is being removed BEFORE this ticket — see nid_ez38gf1mrdgh5kxedzrdicwzl_e (now a dep). Adjust this ticket accordingly:
- GOAL 4 shrinks: the ONE refresh fan-out rule no longer needs to cover per-doc writes or sibling-views-on-same-doc. All writes are global and fan out to all views. docs-internal/tickets/ticket-per-doc-write-leaves-sibling-views-stale.md is now closed by the simplification ticket, NOT by this one.
- GOALs 1,2,3,5 unchanged (serial chain helper, fresh-read writes, reset drains queue, optimistic controls) — those bugs are global-path bugs.
- Tickets merged into this one are now: nid_8b97fdqznqsncc5kgya1p871w_e, nid_4zffe7mj5p1eabi9m6wfh06k0_e, ticket-controls-optimistic-input-latency.md.
- Update any specs/docs describing the write path if they still mention per-doc write scope.
