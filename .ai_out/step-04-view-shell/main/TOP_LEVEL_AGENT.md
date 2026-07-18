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
- [x] IMPLEMENTATION_WITH_SELF_PLAN — 325 tests pass, check+build green. Committed c920e7d.
  - Callout: styles.css now generated at build time + gitignored (like main.js). `git rm --cached` done.
- [x] IMPLEMENTATION_REVIEW — Verdict READY. 0 blocking, 1 SHOULD-FIX (GraphViewController untested concurrency), 4 nice-to-have. Gates independently re-verified green.
- [x] IMPLEMENTATION_ITERATION — SHOULD-FIX closed (controller behind NoteNavigatorPort + 10 concurrency tests), clearDebounce added. Committed 057ccf0. Round-2 review: CONVERGED-READY (335 tests, 0 blocking, both signal readiness).
- [x] Changelog + ticket + commit + closeout — DONE.

## FINAL STATE: COMPLETE
- Commits: c920e7d (impl), 057ccf0 (iteration), + closeout commit (changelog/ticket).
- Gates: vitest 335+69 sublib, tsc, build — all green.
- Human smoke run pending: docs-internal/tickets/ticket-step-04-human-smoke-run.md.
- Callout: styles.css now generated-at-build + gitignored (like main.js). Reviewer endorsed the pattern.

## Open items (from step doc) needing decisions
1. elkjs algorithm baseline (layered vs force/stress) for compound future.
2. Debounce interplay: active-file change mid-rebuild (latest-wins cancel/replace).
3. elk in web worker now vs later (measure; inline likely fine at <=100 nodes).
4. Per-leaf state content in V1 (view settings snapshot; scroll/zoom NOT persisted — confirm).

## Notes
- react-flow + elkjs NOT yet in package.json — need to add deps.
- Existing scaffolding: src/view/HelloGraph.tsx, src/view/NeighborhoodGraphView.tsx.
