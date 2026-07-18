# TOP_LEVEL_AGENT — step-05-rich-rendering (branch: main)

## Task
Execute [[docs-internal/plan/steps/step-05-rich-rendering.md]] via straightforward-flow:
EXPLORATION → CLARIFICATION → IMPLEMENTATION_WITH_SELF_PLAN → IMPLEMENTATION_REVIEW → IMPLEMENTATION_ITERATION

## Status
- [x] EXPLORATION (3 parallel Explore agents → EXPLORATION_PUBLIC.md)
- [x] CLARIFICATION (top-level, with HUMAN) — CLARIFICATION__PUBLIC.md; spec doc updated per human decisions
- [ ] IMPL_A: data & pure logic (engine edge count, frontmatter title, view data plumbing, pure transforms + tests) → REVIEW_A → ITERATION_A
- [ ] IMPL_B: rendering & interactions (rich node, groups, edges, badges, CSS theming, ports, Menu) → REVIEW_B → ITERATION_B
- [ ] IMPL_C: Playwright e2e harness (state-based, no screenshots) → REVIEW_C → ITERATION_C
- [ ] Final: changelog entry (single, by TOP_LEVEL_AGENT), tickets (folder-color-UX, human smoke-run), commit

## Key clarified decisions (binding — details in CLARIFICATION__PUBLIC.md)
- GraphEdge.count engine extension approved; ctrl/cmd = new tab; native Menu; orphaned truncation counts → corner overlay badge; NO folder colors (deferred, ticket); breadcrumb `<folder>/<title>` on ungrouped nodes; title from frontmatter title/name else basename; Playwright e2e in scope (state assertions, no screenshots).

## Phasing rationale
Step 05 split into 3 serial implementation phases (A data, B render, C e2e) to keep each sub-agent context small (never compact). Code-modifying agents run SERIALLY.

## Log
- Started. Prior step artifacts at .ai_out/step-04-view-shell/main/.
