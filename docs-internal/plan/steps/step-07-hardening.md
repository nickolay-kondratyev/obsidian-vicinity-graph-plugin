# Step 07: Hardening

**Covers:** Phase 7 of [[../high-level-plan]]
**Depends on:** [[step-06-controls]]

## Objective

Confidence at the edges: dense vaults, cap boundaries, perf under real usage, and the public README. This is the ship-readiness pass, not a feature step.

## Scope

### Dense-vault fixtures

- Generated fixture vaults (Python script in `.tmp/`-style tooling or a committed generator): hub notes with 200+ links, deep chains, heavily bidirectional clusters, folders with 1/2/many members, canvas-heavy sets.
- Engine-level: run traversal/truncation/sizing over these via `FakeLinkProvider`; assert caps, determinism, and timing sanity.

### Cap edge cases

- Centrals alone exceed the cap (all exempt — verify nothing else renders and UI communicates it).
- Cap boundary ±1; every truncation tiebreaker reached on realistic data.
- Cap changes at runtime; pinned disconnected neighborhoods under tight caps.

### Performance pass

- **Image loading**: verify lazy loading + viewport culling actually bound work on image-heavy vaults; no thumbnail refetch storms on rebuild.
- **Rebuild frequency**: typing bursts in a linked note stay within one debounce window; structural-diff skip rate measured (unchanged structure must skip elk).
- Orphan sweep on a vault with hundreds of doc-data files: no main-thread jank (chunk yields observable).
- Fix what measurement exposes; ticket what's out of V1 scope rather than scope-creeping.

### README + release readiness

- Public `README.md`: what it is (the two native-graph weaknesses it fixes), install, the settings model (global vs per-doc pinning semantics — users will ask), V1 scope/limits, V2 roadmap from the plan's deferred list.
- Fresh-clone dev instructions (submodule init, dev vault).
- Release checklist per Obsidian community-plugin requirements (versions.json, manifest correctness) — actual store submission is a separate decision, not part of this step's exit criteria.

## Out of scope

- Everything in "Deferred to V2+" in the high-level plan.
- New features discovered during hardening → tickets, not scope.

## Open items for step-level planning

1. Perf budget numbers: acceptable rebuild time at cap=100 on the dev machine (set explicit targets before measuring).
2. Whether fixture generators are committed dev tooling or one-off scripts (lean: committed — they're the regression harness for V2 layout work).
3. Any findings parked as tickets during steps 01–06 — triage them here.

## Exit criteria

- Dense-fixture suite green and fast enough to keep in the default `npm test` run (or split into a `test:heavy` script if slow — explicitly, not silently).
- No perf item from the pass left unfixed without a ticket.
- README accurate to shipped behavior; fresh clone → running dev build following only the README.
