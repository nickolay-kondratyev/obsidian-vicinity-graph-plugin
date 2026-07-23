# TOP_LEVEL_AGENT — Node Width Real Estate

Feature: `node-real-estate` · Branch: `node-real-estate-sizing`

## Task
Reduce node horizontal real estate: snug width capped with 2-line wrap; remove folder prefix.
Height deferred to a later iteration (human decision).

## Flow
- [x] EXPLORATION (Explore) → EXPLORATION_PUBLIC.md
- [x] CLARIFICATION (human) → CLARIFICATION__PUBLIC.md — width-only, cap+wrap, remove prefix, defer height
- [x] IMPLEMENTATION_WITH_SELF_PLAN → commit 998fdac (tests/check/build PASS)
- [x] IMPLEMENTATION_REVIEW → APPROVE (0 blocking, 0 should-fix, 2 nits)
- [x] IMPLEMENTATION_ITERATION → converged on first review, no cycle needed
- [x] change_log entry (id 8c45wf4sswn74sep8mv6rmvfb) + follow-up ticket (height) + commit

## Follow-up ticket
- Node vertical real-estate (height content-aware) — deferred per human; revisit when nodes render content.

## Key decisions
- width = max(sizePx, min(NODE_MAX_LABEL_WIDTH_PX, snugSingleLine)); char width 8→~7; remove breadcrumb width term.
- Remove folder prefix (render + CSS + threading + reserved width).
- Height untouched.

## Commits
- (pending) exploration+clarification docs
