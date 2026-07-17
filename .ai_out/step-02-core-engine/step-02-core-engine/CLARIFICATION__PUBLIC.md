# CLARIFICATION — Step 02: Core Engine (RESOLVED with HUMAN)

All four open questions resolved with human on 2026-07-17. These are binding decisions for IMPLEMENTATION.

## Q1 — Node identity boundary (step open item #3) ✅ APPROVED

- Engine keys everything on **file path** (branded type). Engine never interprets docids (opaque string, echoed through).
- Docid-keyed persisted inputs (pins, `centralDepths`) are translated by the adapter (step-03) BEFORE entering the engine. Central/pin descriptors entering the engine carry `{path, docid?, pinTimestamp?}`.
- Engine echoes `docid` through to output nodes so steps 03/04 never re-map.
- **HUMAN NOTE (contract for step-03, document in engine API docs):** notes that receive an override/pin MUST get a docid — the adapter must `await` obsidian-id-lib (`ensureDocId`) to create the docid PRIOR to persisting the override on disk. Engine types should reflect that a pinned/overridden descriptor is expected to carry a docid.

## Q2 — LinkProvider sync vs async (step open item #1) ✅ SYNC

- `LinkProvider` interface is **synchronous** (outgoing links, incoming links, file metadata — all path-keyed). Adapters build their index up-front (async construction, sync queries).
- Human asked: "would sync require parsing ALL canvases upfront without potentially using them?" Answer (accepted): yes, but that cost is inherent — incoming-link queries require a full canvas index regardless of sync/async (any canvas could link into any node). Mitigations: canvases are few/small, step-03 caches parse results by mtime, and the fallback parser is dormant on Obsidian ≥ 1.12.4 where `resolvedLinks` covers canvases.

## Q3 — Depth-tag storage (step open item #2) ✅ FULL MAPS

- Store full per-root × per-direction depth map on each node AND precompute `minDepth`.
- **HUMAN GUIDANCE on traversal efficiency:** avoid needless re-traversal. Each root×direction runs its own BFS with its own depth limit; within a single BFS, maintain a visited map `path → best(shallowest) depth` — do NOT re-expand a node already seen at ≤ current depth (BFS visits in nondecreasing depth, so first visit is minimal — a plain visited-set per BFS suffices). Re-traversal across roots is fine and expected (independent traversals, small scale); the requirement is: never re-expand within one root×direction traversal, and if a node is reached again with no deeper remaining budget, skip it.

## Q4 — Node-bearing eligibility (md + canvas) ✅ APPROVED with SRP

- Node-bearing = `.md` + `.canvas`; everything else is an attachment on the linking node.
- Engine takes "is this path a node-bearing doc" from `LinkProvider` metadata rather than hardcoding extensions.
- **HUMAN REQUIREMENT:** this resolution must be an **SRP class that clearly owns eligibility** (single place that knows the rule). Adapter-side owns the real rule; the engine consumes the flag via provider metadata. `FakeLinkProvider` fixture data supplies the flag for tests.

## Non-questions (unambiguous from step doc — implement as specified)

- Multi-root directional BFS, independent depth limits per root per direction, union + dedupe.
- Truncation: hard cap param (default `100`, named constant), centrals exempt, folder containers don't count; priority chain lower minDepth → higher size score → graph distance to MAIN (when connected) → pin recency (most recent wins) → docid tiebreaker; hidden-node counts per folder group; ONE exported comparator reused for multi-pin settings-cascade conflicts (DRY).
- Sizing: composable metrics (own-file-size default-on log/sqrt, total-linker-size, backlink-count, outlink-count, depth-decay `1/(1+k*depth)`), each normalized/toggled/weighted, composed score → min/max pixel range; pinned nodes get central sizing even when disconnected from MAIN.
- Settings resolution: traversal (depth) per-root: own doc override → global default; view (sizing/grouping/cap): MAIN overrides → pinned per-field gaps (conflicts via priority chain) → global. Per-field: absence = inherit, presence = pinned. Fully tested.
- Zero `obsidian`/`obsidian-id-lib`/react imports under engine dir — enforced by a vitest grep test.
- Engine dir: `src/engine/`.
