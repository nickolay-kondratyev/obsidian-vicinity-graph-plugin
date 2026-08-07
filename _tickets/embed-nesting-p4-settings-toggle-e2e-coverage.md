---
id: nid_jbsbfqqxyy1brm26ul7873v5h_e
title: "Embed nesting P4: e2e coverage + docs (nesting always on)"
status: open
deps: [nid_qy5rc7sq261z23bp79bk8wsem_e]
links: [nid_e79vxubva52s9gq24idypb77x_e, nid_r3qiyd7xx3bund6f73wf5h0vd_e, nid_1moqnutin09drbiyxkd3l7r5k_e, nid_qy5rc7sq261z23bp79bk8wsem_e]
created_iso: 2026-08-07T01:54:03Z
status_updated_iso: 2026-08-07T01:54:03Z
type: feature
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [embed-nesting]
---

Part 4 (final) of the embed-nesting feature (decisions: ticket nid_e79vxubva52s9gq24idypb77x_e). Builds on rendering from ticket nid_qy5rc7sq261z23bp79bk8wsem_e.

DECISION Q9 (resolved 2026-08-07, ticket nid_e79vxubva52s9gq24idypb77x_e): NO settings toggle — embed nesting is ALWAYS ON. There are no users yet, and a toggle would double the testing surface; add one only if a real feature request arrives. Do NOT add a spec leaf, row, or accessor for this.

SCOPE:
1. e2e specs (e2e/, Playwright vs real Obsidian, run via npm run test:e2e): dev-vault fixture notes exercising: nested rendering in embed order; edge from an outside note attaches to the outermost container and its link preview lists the true pair (FlowEdge.notePairs); central (active, isMain) note wins containment; pinned-vs-regular precedence; embed cycle: a two-note MUTUAL embed nests NEITHER note — both render standalone with a plain embed edge between them (Q3 as made precise in P2: cyclic embed pairs are SCC-excluded from nesting candidacy entirely; the greedy alternative would nest one direction and Q5 would then hide the refused edge, making "renders as a plain edge" unprovable); no edges rendered inside a nesting tree (decision Q5).
2. Update docs: docs-internal/plan/high-level-plan.md gains an embed-nesting section (rules + resolved decisions Q1-Q9 summary, including the always-on decision and the future follow-ups: direct-sibling edges, cap priority for nested notes, resize workstream ticket nid_1av3d7fx1072oyp5lxyhjd451_e); docs-internal/architecture-map.md mentions src/view/embedNesting.ts; README.md describes the nesting behavior (as behavior, not a setting); docs-internal/vocab.md nesting terms stay in sync (ticket nid_1ht2a3rm0ng8wnlis259u5egg_e owns creating that file).

npm run test:all green.

## Acceptance Criteria

e2e proves nesting order, edge collapse + preview truth, precedence, cycle fallback, and no intra-tree edges; docs updated (no toggle anywhere); npm run test:all green.

