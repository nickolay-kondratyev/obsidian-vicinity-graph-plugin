# TOP_LEVEL_AGENT — Node Width Real Estate

Feature: `node-real-estate` · Branch: `node-real-estate-sizing`

## Task
Reduce node horizontal real estate: snug width capped with 2-line wrap; remove folder prefix.
Height deferred to a later iteration (human decision).

## Flow
- [x] EXPLORATION (Explore) → EXPLORATION_PUBLIC.md
- [x] CLARIFICATION (human) → CLARIFICATION__PUBLIC.md — width-only, cap+wrap, remove prefix, defer height
- [ ] IMPLEMENTATION_WITH_SELF_PLAN
- [ ] IMPLEMENTATION_REVIEW
- [ ] IMPLEMENTATION_ITERATION
- [ ] change_log entry + commit + final summary

## Key decisions
- width = max(sizePx, min(NODE_MAX_LABEL_WIDTH_PX, snugSingleLine)); char width 8→~7; remove breadcrumb width term.
- Remove folder prefix (render + CSS + threading + reserved width).
- Height untouched.

## Commits
- (pending) exploration+clarification docs
