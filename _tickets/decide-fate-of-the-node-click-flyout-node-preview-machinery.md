---
id: nid_k0yntdzrpfhh1hyx3af6bjkdf_e
title: Decide fate of the node-click flyout (node preview) machinery
status: in_progress
deps: []
links: []
created_iso: '2026-08-01T00:46:12Z'
status_updated_iso: '2026-08-01T05:12:37Z'
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Plain node click now FOCUSES the node (ticket nid_lfcyfbrggrusyv8xn1aroc7h1_e) instead of opening the node-scoped preview flyout. That leaves the NODE preview path with no UI trigger:

- `GraphViewController.openNodePreview()` (+ its behavior tests)
- `LinkPreviewModels.node` / `NodePreviewModel` and the drawer's node-model rendering
- `LinkOccurrenceProvider.outgoingOccurrences` / `backlinkOccurrences` (only consumed by the node preview)

The EDGE preview (edge click -> drawer) is still live and unaffected.

Human decision needed — options:
HUMAN DECISION: REMOVE the node-preview machinery outright (clean break, no dead code).
