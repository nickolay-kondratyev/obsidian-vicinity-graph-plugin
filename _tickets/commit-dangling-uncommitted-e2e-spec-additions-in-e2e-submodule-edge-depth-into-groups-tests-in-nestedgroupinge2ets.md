---
id: nid_4uaakunhzxq4ur9l1qxe04zb7_e
title: "Commit dangling uncommitted e2e spec additions in e2e submodule (Edge depth into groups tests in nestedGrouping.e2e.ts)"
status: closed
deps: []
links: []
created_iso: 2026-08-15T03:26:05Z
status_updated_iso: 2026-08-15T03:26:05Z
type: chore
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [decide]
---

The e2e submodule working tree (e2e/) holds an UNCOMMITTED +148-line addition to e2e/nestedGrouping.e2e.ts: tests (6) and (7) for the "Edge depth into groups" feature (a setEdgeDepthIntoGroups helper, an edge-piercing test, and a pierced-edge avoidance test). The feature itself is merged in src/ (plan nid_6fkhyw97hjs84xb62z6tommhi_e) and BOTH tests PASS against the current build (verified 2026-08-15 during ticket nid_2pobjyfp5zgspx283bfukaugn_e), but the spec was never committed in the submodule, so no superproject gitlink includes it — a fresh clone loses these tests silently.

Also note: the submodule checkout is behind origin/main by 3 commits.

TO DO: decide whether this diff is the intended final form (it passed), commit it inside the e2e submodule, and bump the superproject gitlink. Tagged decide because an agent cannot know whether the original author considered it finished.

