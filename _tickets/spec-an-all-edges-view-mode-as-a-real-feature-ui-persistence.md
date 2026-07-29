---
id: nid_puf4a4q6fgn5lpehh5dowfm1r_e
title: "Spec an 'all-edges' view mode as a real feature (UI + persistence)"
status: open
deps: []
links: []
created_iso: 2026-07-29T18:05:04Z
status_updated_iso: 2026-07-29T18:05:04Z
type: feature
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [settings, graph, decide]
---

The orphan `edgeVisibility` setting was DELETED in nid_niz5dz6uqeyv237ckm15ittqa_e (owner decision 2026-07-29): it had no write path anywhere, so the induced-subgraph "all-edges" implementation in src/engine/EdgeVisibility.ts (now src/engine/EdgeCounts.ts, walked-edges only) was removed with it.

The IDEA is not dead: rendering every link between two visible nodes (post-truncation induced subgraph) may still be a good feature. If wanted, it must be specced properly with a UI control, a cascade story (global / MAIN / pinned), persistence and tests — NOT resurrected as dead config.

Prior implementation is recoverable from git history (src/engine/EdgeVisibility.ts before the deletion commit).

[decide] Human must decide whether this feature is wanted at all before any work starts.

## Acceptance Criteria

Either the ticket is closed as "not wanted", or an "all-edges" mode ships with a real settings control, persistence and tests.

