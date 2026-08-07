---
closed_iso: 2026-08-07T02:27:31Z
id: nid_r3qiyd7xx3bund6f73wf5h0vd_e
title: 'Embed nesting P1: engine exposes per-source embed order'
status: closed
deps: [nid_e79vxubva52s9gq24idypb77x_e]
links: [nid_e79vxubva52s9gq24idypb77x_e, nid_1moqnutin09drbiyxkd3l7r5k_e, nid_qy5rc7sq261z23bp79bk8wsem_e,
  nid_jbsbfqqxyy1brm26ul7873v5h_e]
created_iso: '2026-08-07T01:53:14Z'
status_updated_iso: 2026-08-07T02:27:31Z
type: feature
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [embed-nesting]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2
---
Part 1 of the embed-nesting feature (plan: closed ticket nid_14potmihi2tc0x421abf0awz6_e; decisions RECORDED in ticket nid_e79vxubva52s9gq24idypb77x_e body).

GOAL: the view will nest embedded notes inside their embedder and must render children IN EMBED ORDER (order of `![[...]]` occurrences in the source note). Today `GraphEdge` (src/engine/types.ts) carries `{source, target, count, kind}` with NO ordering, while reference order already exists at the LinkProvider seam: `LinkProvider.getOutgoingReferences` returns references in reference order (src/engine/LinkProvider.ts, adapters/ObsidianLinkProvider.ts via adapters/ReferenceOrder.ts).

REQUIREMENT: expose, for every rendered edge whose kind is `embed` or `both`, the 0-based position of the FIRST embed reference from `source` to `target` within the source's embed references (embed references only, deduped per target). Suggested shape: optional `embedOrder?: number` stamped in `EdgeAssembly.attach` (src/engine/EdgeAssembly.ts) by consulting `OutgoingReferences` for each visible source. Keep the engine pure (no obsidian/react imports — src/engine/importGuard.test.ts guards this) and export from src/engine/index.ts.

STEPS:
1. Failing BDD unit tests first (colocated *.test.ts, WHEN/THEN, FakeLinkProvider fixtures): embed order stamped per source; plain-link edges get no embedOrder; a target both linked and embedded uses the embed occurrence position; order survives dedup.
2. Implement in EdgeAssembly (or a sibling pure step in src/engine/VicinityEngine.ts pipeline) without changing traversal, sizing, or truncation.
3. npm test + npm run check green. Pure engine change: e2e not required (per CLAUDE.md).

## Acceptance Criteria

Every GraphEdge of kind embed|both carries the source-scoped embed position; engine stays pure; existing tests untouched and green.

## Resolution (closed 2026-08-06)

Implemented in the pure engine, no traversal/sizing/truncation changes.

- `src/engine/types.ts`: added optional `readonly embedOrder?: number` to `GraphEdge` — 0-based position of the FIRST embed reference `source → target` within `source`'s embed references (deduped per target, in reference order). Present iff `kind` is `"embed"` or `"both"`. Re-exported already via `src/engine/index.ts` (`GraphEdge` type export unchanged).
- `src/engine/EdgeAssembly.ts`: `attach` now derives `embedOrder` from the SAME per-source reference list it already fetches for `kind` (one `getOutgoingReferences` call per source — the per-source cache is unchanged). New private `embedOrderOf(references, target)` filters the reference list to `kind === "embed"` and returns the target's index, or `undefined` (no embed reference ⇒ plain-link/cache-lag pair, no field stamped). Because the provider's list is deduped per (target, kind), the embed slice holds each target once → the index IS the order that survives dedup.
- Tests (`src/engine/EdgeAssembly.test.ts`, BDD WHEN/THEN, `FakeLinkProvider`): three-note embed order 0/1/2; plain-link edge has no `embedOrder`; a both-linked-and-embedded target uses its EMBED occurrence position (index 1, not its link position); a doubly-embedded target's order survives dedup; embed-only edge equals `{…, kind:"embed", embedOrder:0}`.
- One existing behavior test updated honestly, NOT to fake a pass: `src/engine/VicinityEngine.test.ts` "note EMBEDS MAIN … reads 'embed'" asserted the full edge object via `toEqual`; the embedder embeds hub.md at index 0, so the assertion now includes the correct new `embedOrder: 0`.

Gates: `npm test` 1725 passed (122 files); `npm run check` (tsc strict + e2e tsc) green. Engine purity preserved (no obsidian/react imports; `importGuard.test.ts` green). E2E not required per CLAUDE.md (pure engine change).
