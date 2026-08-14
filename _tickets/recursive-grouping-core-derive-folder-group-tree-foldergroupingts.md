---
session_ids: [{"a": "claude", "type": "execution", "id": "0ce1bb94-737d-4af0-93c5-8c49e250a75d"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
id: nid_unqqausmhnujjixitr6kieflq_e
title: "Recursive grouping core: derive folder-group TREE (folderGrouping.ts)"
status: in_progress
deps: [nid_xko67wo2z4awg5gdrm1xx1chz_e]
links: []
created_iso: 2026-08-14T00:18:08Z
status_updated_iso: 2026-08-14T00:53:12Z
type: feature
priority: 3
assignee: nickolaykondratyev
tags: []
---

Part of recursive folder grouping. Full design + signed-off decisions: plan ticket nid_xko67wo2z4awg5gdrm1xx1chz_e (closed).

Rewrite the pure derivation in src/view/folderGrouping.ts from flat FolderGroup[] to a TREE:
- A folder QUALIFIES as a group iff >=2 visible notes are its DESCENDANTS (not just direct children). Vault root never groups.
- Each note is assigned to its NEAREST qualifying ancestor folder.
- Each qualifying group nests under ITS nearest qualifying ancestor group (arbitrary depth).
- Redundant-chain collapse: a qualifying folder whose visible content is exactly ONE child group and nothing else is skipped; the surviving group carries the collapsed chain (e.g. label path A/B/C). Expose both leaf folder name and collapsed-chain path on the group model.
- Expose lookup seams for consumers: nearestRenderedAncestorGroupOf(folderPath) and lowestCommonAncestorContainerOf(pathA, pathB) (returns a group or root) - these become the ONE place LCA/nearest-ancestor logic lives (DRY: flowMapping, elkMapping and truncationBadges all consume them; they must never re-derive).

Constraints: stay PURE and deterministic (called independently by src/view/elkMapping.ts and src/view/flowMapping.ts which must not desync - see existing doc comment in folderGrouping.ts). Keep first-seen ordering determinism. BDD unit tests (WHEN/THEN) in src/view/folderGrouping.test.ts covering: descendant qualification, nearest-ancestor assignment, nesting, chain collapse, root exclusion, determinism.

