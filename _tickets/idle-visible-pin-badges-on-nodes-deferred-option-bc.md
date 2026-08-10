---
id: nid_am38wsuka3mksh9atugg1e3x6_e
title: "Idle-visible pin badges on nodes (deferred Option B/C)"
status: closed
deps: [nid_s88z29iparzxrtxhh6ooqfvrz_e]
links: [nid_s88z29iparzxrtxhh6ooqfvrz_e]
created_iso: 2026-08-10T19:40:14Z
status_updated_iso: 2026-08-10T19:40:14Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: [ui]
---

DEFERRED half of ticket nid_s88z29iparzxrtxhh6ooqfvrz_e ("make it more clear how the note is pinned"): human decided (2026-08-10) that hover-to-discover pin state is acceptable FOR NOW; only the pressed-in-on-hover treatment (Option A) proceeds on the parent ticket.

When picked up: make a PINNED chip never hide — while the node is idle it renders as a chrome-less accent icon badge (lucide `pin` = global, `map-pin` = local), regaining chrome + the pressed-in treatment on hover (Option C in the design analysis recorded in the parent ticket body, _tickets/make-it-more-clear-how-the-note-is-pinned.md).

Key files: src/view/NoteNode.tsx (PinButton), src/view/graph-view.css (.vicinity-graph-node-chip), src/view/nodePinAction.ts.

Deps: the Option A implementation must land first — it defines the aria-pressed styling hook the idle-badge selector builds on.

--------------------------------------------------------------------------------
For now closing as lower priority and due to UX concerns (it would make the pin move around as we hover over the node or be placed oddly by itself when the node is not hovered)