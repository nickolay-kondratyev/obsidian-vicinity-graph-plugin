---
closed_iso: 2026-08-14T01:53:32Z
session_ids: [{"a": "claude", "type": "execution", "id": "e4462a62-6ca9-41a7-926e-5305525b582f"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
id: nid_3wnxsfexabjnx1uj9js2o1c43_e
title: "Recursive grouping truncation badges: nearest rendered ancestor"
status: closed
deps: [nid_9uh2twn8whoqtplbxk0ywzpx7_e]
links: []
created_iso: 2026-08-14T00:18:09Z
status_updated_iso: 2026-08-14T01:53:32Z
type: feature
priority: 3
assignee: nickolaykondratyev
tags: []
---

Part of recursive folder grouping. Full design: plan ticket nid_xko67wo2z4awg5gdrm1xx1chz_e (closed). Signed-off decision D4.

src/view/truncationBadges.ts (deriveTruncationBadges): per-folder hidden-node counts (from src/engine/GraphTruncator.ts hiddenNodeCountsByFolder) currently attach to a rendered group only on EXACT folder match, else fall to the corner orphan overlay. Change: attribute each hidden count to the NEAREST RENDERED ANCESTOR group (via the grouping-tree seam - where the hidden note would have rendered per the nearest-qualifying-ancestor rule). Corner orphan badge (VicinityGraphFlow top-right Panel) only when NO ancestor group is rendered; keep its per-folder tooltip breakdown.

Engine unchanged (counts stay keyed by immediate folder - attribution is a view concern). BDD tests in truncationBadges tests: exact-match, ancestor-attribution, orphan fallback, breakdown preserved.

---

## Resolution (2026-08-13)

Done. Attribution now uses the nearest-rendered-ancestor seam instead of exact folder match.

**What changed**
- `src/view/truncationBadges.ts` — `deriveTruncationBadges` now takes
  `nearestRenderedAncestorGroupOf: (folder) => FolderGroup | null` (the
  `FolderGroupingResult` seam) in place of the old
  `renderedGroupFolders: ReadonlySet<FolderPath>`. Each hidden folder's count is
  credited to the group where its notes WOULD render (self-or-ancestor);
  counts for the same group ACCUMULATE (several hidden subfolders can share one
  ancestor group). Only when the lookup returns `null` (no rendered ancestor —
  top-level singletons, vault root) does it fall to the corner orphan overlay,
  whose per-folder breakdown/tooltip is unchanged.
- `src/view/flowMapping.ts` — caller passes `grouping.nearestRenderedAncestorGroupOf`
  (already derived) instead of building a folder set. DRY: reuses the ONE
  nearest-ancestor seam in `folderGrouping.ts`, no re-derivation.
- `src/view/truncationBadges.test.ts` — updated to the new signature with a
  `nearestAncestorGroups(...)` stub mirroring the seam; added
  ancestor-attribution and accumulation cases; kept exact-match, orphan
  fallback, root-aggregates, and breakdown-order coverage.

**Engine**: untouched — `hiddenNodeCountsByFolder` stays keyed by immediate
folder; attribution is purely a view concern as specified.

**Gates**: `npm run check` (green), `npm test` (137 files / 2019 tests, green),
including `flowMapping.test.ts` which asserts the integrated `data.hiddenCount`
and `orphanTruncation` shapes. No DOM/CSS/settings surface changed (badge
components are untouched), so no e2e gate applies here.

