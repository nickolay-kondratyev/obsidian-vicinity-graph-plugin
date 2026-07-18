# TOP_LEVEL_AGENT — step-04-view-shell

**Feature:** step-04-view-shell
**Branch:** main
**Task file:** docs-internal/plan/steps/step-04-view-shell.md

## Objective
Build the first visible graph: an ItemView (right sidebar, draggable to main) rendering
the active file's neighborhood as plain React Flow nodes, laid out by elkjs, rebuilding on
navigation and (debounced) vault changes. Structural diff skips layout when structure unchanged.

## Workflow
- [x] EXPLORATION (3 Explore agents → EXPLORATION_*.md)
- [x] CLARIFICATION — human confirmed "go with defaults" (layered elk, inline async, no view-state persist, @xyflow/react v12)
- [ ] IMPLEMENTATION_WITH_SELF_PLAN
- [ ] IMPLEMENTATION_REVIEW
- [ ] IMPLEMENTATION_ITERATION
- [ ] Changelog + commit + closeout

## Open items (from step doc) needing decisions
1. elkjs algorithm baseline (layered vs force/stress) for compound future.
2. Debounce interplay: active-file change mid-rebuild (latest-wins cancel/replace).
3. elk in web worker now vs later (measure; inline likely fine at <=100 nodes).
4. Per-leaf state content in V1 (view settings snapshot; scroll/zoom NOT persisted — confirm).

## Notes
- react-flow + elkjs NOT yet in package.json — need to add deps.
- Existing scaffolding: src/view/HelloGraph.tsx, src/view/NeighborhoodGraphView.tsx.
