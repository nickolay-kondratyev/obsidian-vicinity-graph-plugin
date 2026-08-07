---
id: nid_r3qiyd7xx3bund6f73wf5h0vd_e
title: "Embed nesting P1: engine exposes per-source embed order"
status: open
deps: [nid_e79vxubva52s9gq24idypb77x_e]
links: [nid_e79vxubva52s9gq24idypb77x_e, nid_1moqnutin09drbiyxkd3l7r5k_e, nid_qy5rc7sq261z23bp79bk8wsem_e, nid_jbsbfqqxyy1brm26ul7873v5h_e]
created_iso: 2026-08-07T01:53:14Z
status_updated_iso: 2026-08-07T01:53:14Z
type: feature
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [embed-nesting]
---

Part 1 of the embed-nesting feature (plan: closed ticket nid_14potmihi2tc0x421abf0awz6_e; decisions: ticket nid_e79vxubva52s9gq24idypb77x_e and .ai_out/_current_decision/current_decision.md).

GOAL: the view will nest embedded notes inside their embedder and must render children IN EMBED ORDER (order of `![[...]]` occurrences in the source note). Today `GraphEdge` (src/engine/types.ts) carries `{source, target, count, kind}` with NO ordering, while reference order already exists at the LinkProvider seam: `LinkProvider.getOutgoingReferences` returns references in reference order (src/engine/LinkProvider.ts, adapters/ObsidianLinkProvider.ts via adapters/ReferenceOrder.ts).

REQUIREMENT: expose, for every rendered edge whose kind is `embed` or `both`, the 0-based position of the FIRST embed reference from `source` to `target` within the source's embed references (embed references only, deduped per target). Suggested shape: optional `embedOrder?: number` stamped in `EdgeAssembly.attach` (src/engine/EdgeAssembly.ts) by consulting `OutgoingReferences` for each visible source. Keep the engine pure (no obsidian/react imports — src/engine/importGuard.test.ts guards this) and export from src/engine/index.ts.

STEPS:
1. Failing BDD unit tests first (colocated *.test.ts, WHEN/THEN, FakeLinkProvider fixtures): embed order stamped per source; plain-link edges get no embedOrder; a target both linked and embedded uses the embed occurrence position; order survives dedup.
2. Implement in EdgeAssembly (or a sibling pure step in src/engine/VicinityEngine.ts pipeline) without changing traversal, sizing, or truncation.
3. npm test + npm run check green. Pure engine change: e2e not required (per CLAUDE.md).

## Acceptance Criteria

Every GraphEdge of kind embed|both carries the source-scoped embed position; engine stays pure; existing tests untouched and green.

