# Step 04: View Shell — First Visible Graph

**Covers:** Phase 4 of [[../high-level-plan]]
**Depends on:** [[step-03-adapters-and-persistence]]

## Objective

The milestone where it feels real: an `ItemView` in the right sidebar showing the active file's vicinity as plain React Flow nodes, laid out by elkjs, rebuilding as you navigate.

## Scope

### View plumbing

- `ItemView` + React 18 root; register the view type; **right sidebar by default**, draggable to main area.
- **MAIN tracking**: follow the active file; ignore non-eligible actives (per lib `isEligible` — md/canvas only).
- **Per-leaf `getState`/`setState`** so workspace restore works with multiple views open.

### Rebuild pipeline

`events → engine → structural diff → elkjs → React Flow`

- Triggers: active file change; vault changes while the view is open via debounced metadata resolve (**~500ms**, named constant).
- **Structural diff after each rebuild**: unchanged node/edge structure skips layout entirely, only refreshes node data.
- Exception: any surviving node's computed size grew beyond **`SIZE_RELAYOUT_THRESHOLD`** (named constant, initially `1.0` = +100%) → full relayout.
- Structural changes accept layout jumps in V1 (position-seeding is V2).

### Layout

- **elkjs** with hierarchical containment so folder groups (step 05) lay out correctly — choose elk options now with compound layout in mind, even though this step renders flat plain nodes.
- Layout runs off the main interaction path (elkjs supports web workers; decide in step planning whether V1 needs it or inline-async suffices).

### Rendering (deliberately plain)

- Default React Flow nodes with titles; no rich content, no groups, no styling beyond legible.
- Pan/zoom/fit-view working; clicking a node opens the note (minimal interaction to make dev testing pleasant; full interactions in step 05).

## Out of scope

- Rich node components, folder groups, edge styling, theme variables (step 05).
- Toolbar/controls (step 06). Depth/sizing come from persisted + global settings only.

## Testing

- Pure parts extracted and vitest-covered: structural diff (incl. size-growth exception), rebuild decision logic, engine→React-Flow/elk graph mapping.
- View lifecycle exercised manually in the dev vault: open/close, sidebar↔main drag, workspace restore, two views open at once.

## Open items for step-level planning

1. elkjs algorithm + options baseline (`layered` vs `force`/`stress`) for the compound-graph future; spike on a real fixture before committing.
2. Debounce interplay: active-file change during an in-flight rebuild (cancel/replace policy — latest wins).
3. elk in a web worker now vs. later (measure first; avoid complexity if inline is fine at ≤100 nodes).
4. What per-leaf state contains in V1 (likely: view settings snapshot + scroll/zoom is NOT persisted — confirm).

## Exit criteria

- Opening the view shows the active note's vicinity; navigating notes updates it; editing links updates it within the debounce window.
- No-structural-change edits provably skip layout (log/assert in dev build).
- Pure pipeline logic under test; the ItemView file stays thin.
