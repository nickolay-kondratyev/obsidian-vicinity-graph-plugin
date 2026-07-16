# Steps Index

Derived from [[../high-level-plan]]. Each step gets its own detailed planning pass before implementation; these docs define scope, exit criteria, and the open items that step-level planning must resolve.

| Step | Covers | Deliverable |
|------|--------|-------------|
| [[step-01-scaffold]] | Phase 0 | Empty plugin loads in dev vault, tests run, submodule wired |
| [[step-02-core-engine]] | Phase 1 | Pure, fully tested engine: traversal, truncation, sizing, settings resolution |
| [[step-03-adapters-and-persistence]] | Phases 2 + 3 | Obsidian link providers, canvas fallback, docid-keyed persistence, orphan sweep |
| [[step-04-view-shell]] | Phase 4 | First visible graph: events → engine → diff → elkjs → React Flow |
| [[step-05-rich-rendering]] | Phase 5 | Rich nodes, folder groups, directed edges, theme integration |
| [[step-06-controls]] | Phase 6 | In-view toolbar, per-central depth steppers, pin/unpin, settings tab |
| [[step-07-hardening]] | Phase 7 | Dense-vault fixtures, perf pass, README |

## Dependency chain

Strictly sequential: `01 → 02 → 03 → 04 → 05 → 06 → 07`.

Rationale (from the high-level plan): steps 02–03 contain every design decision and run entirely without Obsidian UI, so rework risk concentrates where iteration is cheapest. The UI (04–06) consumes a stable, tested engine.
