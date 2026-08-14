---
session_ids: [{"a": "claude", "type": "execution", "id": "e4462a62-6ca9-41a7-926e-5305525b582f"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
id: nid_3wnxsfexabjnx1uj9js2o1c43_e
title: "Recursive grouping truncation badges: nearest rendered ancestor"
status: in_progress
deps: [nid_9uh2twn8whoqtplbxk0ywzpx7_e]
links: []
created_iso: 2026-08-14T00:18:09Z
status_updated_iso: 2026-08-14T01:50:52Z
type: feature
priority: 3
assignee: nickolaykondratyev
tags: []
---

Part of recursive folder grouping. Full design: plan ticket nid_xko67wo2z4awg5gdrm1xx1chz_e (closed). Signed-off decision D4.

src/view/truncationBadges.ts (deriveTruncationBadges): per-folder hidden-node counts (from src/engine/GraphTruncator.ts hiddenNodeCountsByFolder) currently attach to a rendered group only on EXACT folder match, else fall to the corner orphan overlay. Change: attribute each hidden count to the NEAREST RENDERED ANCESTOR group (via the grouping-tree seam - where the hidden note would have rendered per the nearest-qualifying-ancestor rule). Corner orphan badge (VicinityGraphFlow top-right Panel) only when NO ancestor group is rendered; keep its per-folder tooltip breakdown.

Engine unchanged (counts stay keyed by immediate folder - attribution is a view concern). BDD tests in truncationBadges tests: exact-match, ancestor-attribution, orphan fallback, breakdown preserved.

