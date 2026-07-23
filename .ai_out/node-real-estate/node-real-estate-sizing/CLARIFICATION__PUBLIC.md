# Clarification — Node Width Real Estate

## Scope (confirmed with human)
Reduce **node width** so a node takes only enough horizontal space to render its name,
and **remove the grayed folder prefix**. **Height is explicitly deferred** to a later
iteration (revisit once nodes render richer content that can fill the vertical space).

## Decisions
1. **Long titles → cap width + wrap to 2 lines.**
   - `width = max(node.sizePx, min(CAP, snugSingleLineEstimate))`.
   - When the snug single-line estimate exceeds `CAP`, width is pinned to `CAP` and the
     title wraps onto the 2 lines CSS already permits (`-webkit-line-clamp: 2`).
   - Tighten the per-char estimate (currently `NODE_TITLE_CHAR_WIDTH_PX = 8`, deliberately
     generous) to something snugger (~7px). The 2-line clamp is now the overflow safety net,
     so we no longer need to overshoot single-line width.
   - Suggested `NODE_MAX_LABEL_WIDTH_PX ≈ 200` (implementation may tune; keep it a named
     constant, no magic numbers). Rationale: roughly balanced against the 160px max height.

2. **Remove folder prefix entirely** — the breadcrumb render, its CSS, AND the width it
   reserves (`estimateNodeLabelWidthPx` breadcrumb term). Drop `breadcrumbFolder` threading
   through `flowMapping.ts` / `elkMapping.ts` / `graphIdentity.ts` if it becomes dead after
   removal (keep the code clean — no dead params).

3. **Height untouched this iteration** — `nodeDimensionsPx.height = node.sizePx` stays.
   Note (do NOT fix now): min node height 40px + 2-line title could clip slightly on the
   smallest nodes; acceptable via line-clamp for now, and folded into the future height work.

## Constraints
- `flowMapping.ts` (RF box) and `elkMapping.ts` (elk layout box) MUST use the same width →
  keep both routed through `nodeDimensionsPx`.
- Update tests in `graphIdentity.test.ts` (and `flowMapping`/`elkMapping` tests if they assert
  breadcrumb/width). Add coverage for the new cap + wrap width formula.
- Update `docs-internal/plan/high-level-plan.md:59` (Sizing) + the CSS design-intent comment
  (`graph-view.css:65-71`) to reflect: prefix removed, width capped, wrap-to-2-lines.
- Pareto: keep it simple. No height changes. No new abstractions beyond named constants.
