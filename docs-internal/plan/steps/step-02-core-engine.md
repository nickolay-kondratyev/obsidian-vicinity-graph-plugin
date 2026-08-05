# Step 02: Core Engine (pure, fully tested)

**Covers:** Phase 1 of [[../high-level-plan]]
**Depends on:** [[step-01-scaffold]]

## Objective

The entire decision-heavy core as pure functions with **no Obsidian imports**, tested against fixtures. This step carries most of the project's design risk; iteration here is cheapest, so it gets the deepest tests.

## Scope

### Types and boundary

- Domain types: node id (docid-based), graph node, edge, attachment, folder identity, depth tags (per root, per direction), central-node descriptors.
- **`LinkProvider` interface** — the only seam to Obsidian: outgoing links, incoming links, file metadata (folder, size, attachments). Ships with a fixture-driven **`FakeLinkProvider`**.

### Traversal

- **Multi-root directional BFS**: independent BFS per central node; outbound and incoming traversed separately with independent depth limits; results unioned and deduped.
- Each root uses **its own depth settings** (no cascade for depth).
- Every node tagged with depth per root per direction; compute **minDepth** = min across all roots and directions.
- **Non-markdown files are never nodes** — collected as attachments on the linking node during traversal.
- Attachment collection includes identifying the first image (for later thumbnail rendering).

### Truncation

- Hard cap (parameter; default `100` as a named constant). **Centrals exempt**; folder containers don't count.
- Deterministic priority chain: lower minDepth → higher size score → graph distance to MAIN (when connected) → pin recency (most recent wins) → docid tiebreaker. **(SUPERSEDED 2026-08-04: the "higher size score" level was removed with the sizing metrics — see `../high-level-plan` and `NodePriorityChain`.)**
- Output includes **hidden-node counts, per folder group**, for the UI badge.
- The same chain is exposed as a reusable comparator — it also resolves multi-pin conflicts in the settings cascade (DRY: one implementation).

### Sizing

**SUPERSEDED 2026-08-03** (owner decision, ticket `nid_cx5zoz7ptucg9nxalibv0mbjb_e`; see `../node-sizing-rethink` and the Sizing section of `../high-level-plan`): the metric system below was removed wholesale. A node now sizes to FIT what it shows, clamped by `minPx`/`maxPx`, with a prominence floor for centrals. The bullets stay as the record of what step-02 shipped.

- Composable metric system: each metric independently normalized, toggled, weighted; composed score maps to a min/max pixel range.
- Metrics: `own-file-size` (default-on, log/sqrt normalization for byte sizes), `total-linker-size`, `backlink-count`, `outlink-count`, `depth-decay` (`1 / (1 + k * depth)` on shortest depth from any central).
- **Pinned nodes get central sizing even when disconnected from MAIN.**

### Settings resolution

- Two classes:
    - **Traversal (depth)**: per-root — own doc override → global default.
    - **View (sizing, grouping, cap)**: MAIN overrides → pinned nodes fill per-field gaps (conflicts via the priority chain) → global.
- **Per-field semantics**: absence = inherit, presence = pinned. The resolver ships fully tested even though V1 has little to arbitrate (per-view overrides are planned).

## Out of scope

- Anything importing `obsidian`. Any persistence. Any React.

## Testing (the point of this step)

- BDD GIVEN/WHEN/THEN suites per module; one assert per test where practical.
- Fixture vaults expressed as `FakeLinkProvider` data: diamond graphs, cycles, bidirectional links, disconnected pinned vicinities, attachment-heavy notes.
- Truncation determinism: same input → same output, every tiebreaker level exercised.
- Sizing: normalization edge cases (one huge note, zero-byte notes, single-node graph).
- Settings resolver: every cascade layer and per-field pin/inherit combination.

## Open items for step-level planning

1. Exact `LinkProvider` method signatures — design so the canvas-fallback provider (step 03) composes without interface change (OCP).
2. Whether depth tags store full per-root maps or just the min + per-root needed by UI steppers (memory vs. UI needs).
3. Node identity during traversal: traversal keys on file path (what Obsidian indexes give us) while persistence keys on docid — define the mapping type here.

## Exit criteria

- Full engine test suite green; zero `obsidian` imports under the engine directory (enforce with a lint rule or a test that greps imports).
- Engine API documented (succinct interface docs) — steps 03/04 consume it without reading implementations.
