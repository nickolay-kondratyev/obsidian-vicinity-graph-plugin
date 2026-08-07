---
closed_iso: 2026-08-06T22:49:06Z
id: nid_qveuch88qov6rr7pr2y7a1vki_e
title: Custom sizing - add ability to drop custom size
status: closed
deps: [nid_9hx6okamx3yt0rg9iad2f4151_e]
links: []
tags: []
created_iso: '2026-08-05T16:38:59Z'
status_updated_iso: 2026-08-06T22:49:06Z
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Right now once we custom size a node we do not have a way to drop the custom size.

We should add ability to drop the custom size when the node has custom size, 
It we should get an icon that pops up when the node has custom size and when we are hovering over the node we would see this icon IF the node sizing has been overriden. Clicking on this icon would reset the node sizing to default (remove the override of node sizing that is was set by dragging the node), after reset of the size we would not see the node icon anymore since it wouldn't be actionable. We will also want to have a hover over the icon to explain what it does and when its shown to educate the user.


I am thinking we will want to put this functionality under the gear icon of the node. 
The gear icon of the node will have multiple different options under it, this included as one of the options.

## Notes

**2026-08-06T22:49:06Z**

RESOLVED (2026-08-06).

Scope reality: the core ability to DROP a custom (dragged) size was already
shipped by the dependency ticket nid_9hx6okamx3yt0rg9iad2f4151_e — the node's
hover gear (and right-click) menu hosts a "Reset size" entry that appears ONLY
while a size override exists, clears it via ControlsActions.resetNodeSize, and is
covered by unit/jsdom/e2e tests. So the reset-under-gear design the ticket asked
for was in place.

This ticket delivered the one remaining requirement: the EDUCATIONAL hover
explaining what the reset does and (implicitly) when it appears. "Custom size" (a
box set by dragging a node's edges) is a term the UI names nowhere else, so the
menu item now teaches it.

Implementation:
- NodeMenuEntry gained an optional `description` (viewPorts.ts).
- planResetSizeAction now returns that copy: "Clears the custom size you set by
  dragging; the note returns to its computed size." (nodeResize.ts).
- NoteNode passes it on both the gear and context-menu reset entries.
- ObsidianGraphUi renders it as a muted sub-line via setTitle(DocumentFragment) —
  the supported path, no reach into the MenuItem's private DOM — styled by
  .vicinity-graph-menu-item__description (graph-view.css, body-level: Obsidian
  renders its menu outside the view container).

Tests (all green): nodeResize.test.ts + NoteNode.component.test.tsx assert both
menus carry the sub-line; e2e/nodeResize.e2e.ts asserts it renders in a REAL
Obsidian menu. Full gate: npm run check + npm test (1708) + nodeResize e2e (16).
