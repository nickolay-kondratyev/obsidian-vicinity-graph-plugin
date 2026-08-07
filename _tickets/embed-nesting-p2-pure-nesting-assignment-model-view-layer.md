---
id: nid_1moqnutin09drbiyxkd3l7r5k_e
title: 'Embed nesting P2: pure nesting-assignment model (view layer)'
status: in_progress
deps: [nid_e79vxubva52s9gq24idypb77x_e, nid_r3qiyd7xx3bund6f73wf5h0vd_e]
links: [nid_e79vxubva52s9gq24idypb77x_e, nid_r3qiyd7xx3bund6f73wf5h0vd_e, nid_qy5rc7sq261z23bp79bk8wsem_e,
  nid_jbsbfqqxyy1brm26ul7873v5h_e]
created_iso: '2026-08-07T01:53:31Z'
status_updated_iso: '2026-08-07T03:48:40Z'
type: feature
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [embed-nesting]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Part 2 of the embed-nesting feature (decisions: ticket nid_e79vxubva52s9gq24idypb77x_e; plan origin: closed ticket nid_14potmihi2tc0x421abf0awz6_e).

GOAL: a pure, react-free view-layer module (sibling of src/view/folderGrouping.ts, e.g. src/view/embedNesting.ts) that, given the rendered VicinityGraph (post-truncation — decision Q7), computes the NESTING FOREST: for each rendered node, an optional container (a rendered node that embeds it), forming a forest with deterministic assignment.

RULES (from the origin ticket + decisions):
- Candidates for containing node n: rendered nodes s with a DIRECTED edge s→n of kind embed|both (s embeds n; GraphEdge is directed source→target, so direction is unambiguous).
- Precedence: the MAIN node (GraphNode.isMain — decision Q1: "central" == isMain) beats pinned beats regular. Pinned = isCentral && !isMain.
- Constraints: the main node is NEVER nested; a pinned node may nest only under main or another pinned node; regular nodes nest under anyone who embeds them.
- Tie-break within a rank (decision Q2): smaller minDepth wins, then lexicographic vault path.
- Cycles (decision Q3, made precise 2026-08-06 plan review): candidate edges that lie inside a directed CYCLE of the rendered embed graph are EXCLUDED from candidacy up front — compute strongly-connected components over the rendered nodes' embed|both edges and drop every candidate edge whose two endpoints share an SCC of size > 1 (self-embeds too). The excluded pairs stay ordinary edges. Rationale: the naive "greedy, refuse the assignment that closes a cycle" alternative always nests ONE direction of a mutual embed, which puts the refused edge INSIDE the winner's tree where decision Q5 drops it — contradicting the recorded Q3 outcome ("cycles ... render as a normal edge") and the P4 e2e assertion. SCC-exclusion keeps every recorded decision true, is order-independent (no dependence on node processing order), and once the candidate edge set is acyclic, each node independently picking its single best candidate can never form a cycle — the forest property is free, no incremental cycle check needed. A node in an embed cycle can still nest under an embedder OUTSIDE its SCC.
- Output also names, per node, its OUTERMOST container (root of its tree) and its ordered children (by the embedOrder field added in ticket nid_r3qiyd7xx3bund6f73wf5h0vd_e, tie-broken by path).

DEPS: needs P1 (embedOrder on edges).

STEPS:
1. Failing BDD unit tests first (src/view/embedNesting.test.ts, node-env): each origin-ticket scenario becomes a test — chain n1 embeds n2 embeds n3 gives outermost n1; central wins over pinned/regular; pinned beats regular; central never nested; pinned never under regular (renders standalone); losing embedder keeps an edge target (decision Q6 is consumed later by flowMapping — this module only outputs the forest); a two-node mutual embed nests NEITHER direction (both standalone, SCC-excluded) regardless of input order; a node inside an embed cycle still nests under an embedder outside the cycle; a self-embed never nests; child order follows embedOrder.
2. Implement as pure functions over VicinityGraph; no obsidian/react imports (src/engine/importGuard.test.ts pattern applies to shared; keep this module import-clean anyway since flowMapping is pure too).
3. npm test + npm run check green. No rendering yet — e2e not required for this ticket.

## Acceptance Criteria

embedNesting module returns a deterministic forest honoring precedence, constraints, ties, cycles, and child order; full BDD unit coverage of every origin-ticket scenario.
