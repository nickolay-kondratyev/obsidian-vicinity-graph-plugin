---
closed_iso: 2026-08-01T05:23:01Z
id: nid_k0yntdzrpfhh1hyx3af6bjkdf_e
title: Decide fate of the node-click flyout (node preview) machinery
status: closed
deps: []
links: []
created_iso: '2026-08-01T00:46:12Z'
status_updated_iso: 2026-08-01T05:23:01Z
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

## Resolution (2026-08-01, commit 28bac6a)

Removed the node-preview machinery outright per the HUMAN DECISION:

- `GraphViewController.openNodePreview()` and its private `renderedOutlineOf()` helper, plus their behavior tests.
- `NodePreviewModel` / `NodePreviewInputs` / `BacklinkGroupModel` / `LinkPreviewModels.node`. With one variant left, the `LinkPreviewModel` union and the `kind` discriminant were dropped — the drawer/store/port surface is now typed `EdgePreviewModel`.
- `LinkPreviewContent`'s node branch (Outline/Links/Backlinks sections, `OutlineList`, `BacklinkGroups`) and the node-only outline CSS in `link-preview.css`. The drawer title is edge-only.
- `LinkOccurrenceProvider` narrowed to `occurrencesBetween` only. Outgoing-occurrence extraction survives as the Obsidian adapter's PRIVATE engine of that query (position/snippet/canvas/frontmatter coverage now runs through `occurrencesBetween` tests); results no longer leak `targetPath`.
- `BacklinksAdapter.backlinkOccurrenceOffsets` / `extractOccurrenceOffsets` and the `backlinkOffsets` fixture support in `FakeObsidianPorts` — the node preview was the only consumer. `backlinkSourcePaths` (used by `ObsidianLinkProvider` / `main.ts`) is untouched.

NOT touched (verified distinct features): the EDGE preview drawer (still live), and the ON-NODE preview (`nodePreviewPreference` outline/thumbnail slot — `nodePreviewChoice.ts` etc.).

Verified: `npm test` (1462 passed), `npm run check`, `npm run build`, `npm run test:e2e -- vicinityGraph.e2e.ts` (21 passed).
