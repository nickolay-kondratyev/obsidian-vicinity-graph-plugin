# Step 06: Controls

**Covers:** Phase 6 of [[../high-level-plan]]
**Depends on:** [[step-05-rich-rendering]]

> **PARTLY SUPERSEDED — the central selector, per-central depth steppers,
> pin-on-toggle and per-control reset-to-global below.** Ticket
> `nid_ez38gf1mrdgh5kxedzrdicwzl_e` (owner decision 2026-07-29) made settings
> global-only: the panel's Depth section is now ONE pair of steppers
> (a `DepthStepper` pair) writing the global depth that drives MAIN and every pinned
> central, there is no per-central list and no per-control reset, and resetting is
> per settings-tab section plus one tab-wide scope. Pinning itself (hover button,
> node menu, global pinned set) is unchanged. This document is kept AS SHIPPED — the
> record of what was built and why, not current behavior; for that read
> [[../high-level-plan]] §Pinning and settings.

## Objective

Put the already-working machinery in the user's hands: per-central depth control, pinning, sizing configuration, and the global settings tab. This step is mostly UI over APIs that steps 02–03 built and tested.

## Scope

### In-view toolbar

- **Central selector** listing MAIN + pinned centrals, each with **per-direction depth steppers** (outbound / incoming independent).
- Depth changes write through the persistence layer: adjusting a pinned central's depth while at MAIN Y persists into **Y's** `centralDepths` (step 03 semantics); Y's own depth writes to Y's doc file.
- **Expandable sizing section** (not front and center): metric toggles, weights, min/max pixel range — global-only in V1, so edits here write global settings.
- **Node cap** setting.
- **Pin-on-toggle everywhere**: any explicit change writes the per-doc field even when equal to the global default.

### Reset-to-global affordances

- Per-control unpin ("reset to global") shown when a field is pinned; absence-vs-presence semantics from step 03 make this a field delete.
- Visual distinction between inherited and pinned values (so the user can tell why a value is what it is).

### Pin/unpin on nodes

- Pin affordance on every node (context menu and/or hover button); unpin on pinned centrals.
- Pinning uses `ensureDocId` (the explicit write-intent moment — see step 03); a `null` id → user-visible notice that this doc can't be pinned.
- Pinned set updates are global state, persist to `data.json`, survive restarts.

### Global settings tab

- Standard `PluginSettingTab`: global depth defaults, sizing defaults, cap default, any sweep/debug toggles worth exposing.

## Out of scope

- Per-view sizing overrides (V2 — but the resolver already supports the cascade; the UI just doesn't offer it).
- User-assignable folder colors (V2).

## Testing

- The settings-write layer (what field gets written where, on which interaction) as pure vitest-covered functions — this is contract-heavy and easy to get subtly wrong.
- Scenario test (engine-level, from the plan): pin X at depth 3 while MAIN Y is at depth 1 → X keeps exploring at 3; switch MAIN to Z and back to Y → exact view restored; X's own saved settings untouched.
- Manual QA checklist: every control round-trips through restart.

## Open items for step-level planning

1. Toolbar placement/overflow behavior in the narrow sidebar (the default home) — design for ~300px width.
2. Depth stepper bounds (min 0? max? named constants) and what depth 0 means per direction (just the central itself).
3. Where the unpin-node affordance lives: node hover button vs. right-click menu vs. both.
4. Whether cap changes are per-view (view settings class says yes via cascade) — align UI write target with the resolver's view-settings semantics.

## Exit criteria

- Every goal-3 and goal-4 behavior from the high-level plan is operable from the UI: independent per-direction depth, per-doc memory, pin/unpin, reset-to-global.
- Settings round-trip: change → restart Obsidian → identical view.
- No orphaned UI: every control maps to tested engine/persistence behavior.
