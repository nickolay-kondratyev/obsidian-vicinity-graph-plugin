---
closed_iso: 2026-08-14T01:02:34Z
session_ids: [{"a": "claude", "type": "execution", "id": "0ce1bb94-737d-4af0-93c5-8c49e250a75d"}, {"a": "claude", "type": "review", "id": "3a54711d-37ea-4587-ad2d-4c10b1db4acf"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
id: nid_unqqausmhnujjixitr6kieflq_e
title: "Recursive grouping core: derive folder-group TREE (folderGrouping.ts)"
status: closed
deps: [nid_xko67wo2z4awg5gdrm1xx1chz_e]
links: []
created_iso: 2026-08-14T00:18:08Z
status_updated_iso: 2026-08-14T01:02:34Z
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

---

## Resolution (2026-08-13)

Rewrote `src/view/folderGrouping.ts` `deriveFolderGroups` from flat bucketing to
the recursive TREE per plan D2. Pure/deterministic contract preserved.

### New data model (`FolderGroup`)
- `folder` — full vault path of the surviving leaf folder (stable id/key).
- `parentFolder: FolderPath | null` — nearest ancestor GROUP (a tree edge, not
  folder arithmetic; collapsed intermediates already skipped). `null` = top-level.
- `leafName` — leaf folder's last segment.
- `chainPath` — folder path RELATIVE to the parent group (or to root when
  top-level). Equals `leafName` normally; spans multiple segments (e.g. `A/B/C`)
  when redundant single-child ancestors collapsed into it. Multi-segment
  `chainPath` ⇔ a collapse happened.
- `memberPaths` — notes whose NEAREST qualifying ancestor is this folder.

### Algorithm
1. Walk each note's ancestor-folder chain to tally `descendantCountByFolder`
   (+ first-seen index). A folder qualifies iff `>= MIN_GROUP_MEMBER_COUNT` (2)
   descendants; vault root ("") is never in a chain so never qualifies.
2. Assign each note to the first qualifying folder in its chain (self-first) →
   `memberPaths` + `groupFolderByMemberPath`.
3. Parent = immediate parent folder (which always qualifies, since descendant
   counts only grow toward root). Collapse: a qualifying folder with 0 direct
   notes and exactly 1 child group folds into that child; a surviving leaf walks
   up through collapsible ancestors to its effective parent group.
4. Groups emitted in first-seen order (deterministic).

### Seams (the ONE place LCA / nearest-ancestor logic lives — DRY)
- `nearestRenderedAncestorGroupOf(folderPath)` → nearest surviving ancestor-or-self
  group or `null` (skips collapsed folders). For truncation-badge attribution.
- `lowestCommonAncestorContainerOf(pathA, pathB)` → deepest group rendering BOTH
  note paths, or `null` (canvas pane). For edge collapse.

### Compatibility / scope
- `groups` + `groupFolderByMemberPath` fields KEPT, so existing consumers
  (`elkMapping`, `flowMapping`, `layoutFit`) still compile unchanged. For flat
  (single-level) vaults descendant-qualification == direct-child qualification, so
  their behavior is identical. Full nesting rendering (multi-level parentId, LCA
  edge collapse, chain labels) is tickets 2–4; this ticket only lands the core
  data + seams.
- One EXPECTED behavior change surfaced: `src/view/d3ForceStranding.test.ts` put
  its degree-1 leaf in `p/ep/book/` — under recursive grouping that lone note now
  correctly falls UP into the `p/ep` group (the "lone note in SQL/sub renders in
  the SQL group" rule), adding a 3rd member and breaking the fixture's 2-strip
  landscape geometry. Fixed by moving that leaf to its OWN top-level singleton
  folder (`book/`), which matches the fixture's own doc comment ("its own
  singleton folder") and restores the intended standalone external leaf. No
  assertion was weakened.

### Verification
- `src/view/folderGrouping.test.ts` rewritten to BDD: descendant qualification,
  nearest-ancestor assignment, nesting (parent/chainPath), chain collapse
  (full + mid-chain), root exclusion, both seams, determinism (compare `.groups`
  — the result now carries closures, so whole-object `toEqual` is inappropriate).
- `npm run check` clean; `npm test` 1994 passed; `npm run test:e2e --
  vicinityGraph.e2e.ts` 27 passed.

### Left for later tickets (not this one)
- `docs-internal/plan/high-level-plan.md` update → ticket 6 (final docs gate).
- Consumer rewrites for real nesting → tickets 2 (elk), 3 (flow), 4 (badges).

