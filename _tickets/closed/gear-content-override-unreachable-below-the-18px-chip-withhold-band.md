---
closed_iso: 2026-08-06T22:39:44Z
status_updated_iso: 2026-08-06T22:39:44Z
id: nid_gearcontentunreachable18pxband_e
title: 'view: gear Content override unreachable below the 18px chip-withhold band'
status: closed
deps: []
links: [nid_9hx6okamx3yt0rg9iad2f4151_e]
created_iso: '2026-08-06T21:10:00Z'
type: bug
priority: 4
assignee: CC_WITH-nickolaykondratyev
tags: [ui, decide]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
---
Follow-up from nid_9hx6okamx3yt0rg9iad2f4151_e (hover gear with per-node Content override).

## Problem

Both corner chips (pin top-left, gear top-right) share the `.vicinity-graph-node-chip`
withhold rung: at `@container (max-height: 18px) and (max-width: 18px)` they are
`display: none`. The pin's function stays reachable there via the node's right-click
menu (`NoteNode.onContextMenu` offers pin/unpin + Reset size). The gear's PRIMARY
function — the per-node Content override — has NO right-click equivalent, so in that
band it is unreachable. "Reset size" is duplicated into both menus, but the Content
choices live only on the gear.

This is why the withhold-band CSS comment was corrected from the (false, inherited
from the pin-only era) claim that "both chips stay reachable through the right-click
menu".

## Why it is only priority 4

A sub-18px-on-both-axes node renders essentially nothing to preview, so overriding
its content there is near-meaningless; the same doc can be overridden from any other
central where it is larger (the override is global by docid).

## Options (decide)

1. Accept as-is — document the limitation (done in graph-view.css) and close.
2. Add the Content override section to `NoteNode.onContextMenu` too, sharing the
   `planNodeContentMenu` builder with the gear, so the documented "reachable via
   right-click" invariant holds for BOTH chips. Watch section/ordering: the context
   menu currently sets no `section`, so mixing sectioned Content items with the
   unsectioned pin entry needs a consistent grouping decision.

## Resolution (2026-08-06) — Option 1, accept as-is

Decision by the human engineer: **KISS, accept the limitation, no code change.**

Key fact that settled it: the sub-18px-on-both-axes withhold band is NEVER reached
in normal operation. At the shipped 40px `minPx` a node's content box is ~22px — above
the 18px threshold — so every node keeps at least a compact chip. Only a DELIBERATE user
action lands a node in the band: a per-node drag-resize override on that node, or a
hand-shrunk global `minPx`. A user who has dragged a node down to a ~17px sliver has
explicitly said "I don't care about this node's content here", and the override is global
by docid so it stays settable from any larger view of the same doc. The unreachability is
self-inflicted and fully recoverable.

Option 2 (Content override in the right-click menu) was considered for its general
discoverability win — right-click is conventional and the pin already lives there — but
its cost (every node's right-click menu grows from 1–2 to 5–6 items) is not justified by
this priority-4 edge case, which nobody reaches by accident. Not pursued now; if the
discoverability angle is ever wanted, it is a fresh, band-independent UX ticket.

No code change. The behavior (both chips `display: none` in the band) and its
documentation already ship correctly: `src/view/graph-view.css` lines ~498–502 (the
withhold-band comment) and ~484–486 (only a hand-shrunk `minPx` or a drag-resize override
reaches the band). Closed.
