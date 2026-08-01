---
id: nid_k0yntdzrpfhh1hyx3af6bjkdf_e
title: "Decide fate of the node-click flyout (node preview) machinery"
status: open
deps: []
links: []
created_iso: 2026-08-01T00:46:12Z
status_updated_iso: 2026-08-01T00:46:12Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: []
---

Plain node click now FOCUSES the node (ticket nid_lfcyfbrggrusyv8xn1aroc7h1_e) instead of opening the node-scoped preview flyout. That leaves the NODE preview path with no UI trigger:

- `GraphViewController.openNodePreview()` (+ its behavior tests)
- `LinkPreviewModels.node` / `NodePreviewModel` and the drawer's node-model rendering
- `LinkOccurrenceProvider.outgoingOccurrences` / `backlinkOccurrences` (only consumed by the node preview)

The EDGE preview (edge click -> drawer) is still live and unaffected.

Human decision needed — options:
HUMAN DECISION: REMOVE the node-preview machinery outright (clean break, no dead code).


