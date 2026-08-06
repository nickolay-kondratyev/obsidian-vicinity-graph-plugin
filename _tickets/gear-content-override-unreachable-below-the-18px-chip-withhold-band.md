---
status_updated_iso: '2026-08-06T22:30:11Z'
id: nid_gearcontentunreachable18pxband_e
title: 'view: gear Content override unreachable below the 18px chip-withhold band'
status: in_progress
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
