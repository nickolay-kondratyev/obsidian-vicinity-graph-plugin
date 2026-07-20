# PARETO COMPLEXITY ANALYSIS — step-06-controls

**Analyst:** PARETO_COMPLEXITY_ANALYSIS · **Date:** 2026-07-20 · **Range:** `9c51aab..524c53b` (Phases A–D + post-review cleanups)

## Verdict: **JUSTIFIED**

This is a good 80/20 outcome for V1. The delivered complexity is almost entirely *essential* complexity: a thin, well-tested pure core (the "which write lands where" contract) with obsidian/React glue laid over it. The agent added no speculative abstraction of its own — the only place that reads as "extra surface" (the in-view sizing mirror) is a binding human decision (CLARIFICATION Q5/Q-B), not gold-plating. Ship it.

The single most valuable structural decision — deriving the toolbar's displayed `value` through the SAME `TraversalSettingsResolver` the engine uses, so "value shown == value graphed" is *structural* rather than a parallel `?? ??` chain — is exactly the kind of small complexity that buys correctness which is otherwise hard to test. High ROI.

## Per-choice ROI table

| Choice | Value | Cost | Verdict |
|--------|-------|------|---------|
| ~4 pure modules (`settingsWritePlan`, `ControlsModelBuilder`, `nodePinAction`, `PinnedRootResolver`, `sizingMetrics`) + thin glue split | The contract-heavy logic (field-merge, presence-vs-value, skip-rule) is isolated and unit-tested once; glue is a switch | Low — each module is small and single-purpose (~20–115 lines); no ceremony | **80/20-right.** This is the core of the win |
| `GraphBuildResult{graph, controls}` — single disk read | Toolbar values can NEVER disagree with the graph (same inputs, same read); no second `DocDataStore` round-trip, no race | Return-shape ripple across builder/controller/tests — mechanical, one-time | **Right.** The alternative (second read for the toolbar) is both more code and a correctness hazard |
| Presence-based inherited-vs-pinned + `value`-via-resolver DRY | `pinned` honors pin-on-toggle (value can equal global); `value` structurally tracks the graph | The `mergedDepthOverride` / `mainAdjustedDepthOverride` pair on `ResolvedPinnedRoot` is a touch subtle | **Right.** The subtlety replaces a class of silent drift bugs; documented + tested (Q-A edge case has a dedicated test) |
| `PinnedRootResolver` shared by assembler + builder | One copy of "skip unresolved / skip main-as-pin"; toolbar list and graph provably agree | Assembler refactored to call it once (output verified unchanged) | **Right.** Real knowledge duplication removed; DRY on a business rule |
| Two-surface pin/unpin (hover button + context menu) | Fast idle-free affordance + discoverable menu | Low — both share `planNodePinAction`; only the DOM/Menu binding differs | **Acceptable.** Human-mandated (Q3 "BOTH"); shared decision keeps cost near-zero |
| `SizingSection` in-view mirror + settings tab both via `planSettingsWrite` | Both surfaces share ONE write path; field-merge rule exists once | The in-view mirror re-renders the full 5-metric+weights+min/max/k surface in raw React (settings tab uses obsidian `Setting`) — the largest UI chunk | **Acceptable — see note.** Human-mandated (Q5); the shared write path + shared `SIZING_METRICS` keep the duplication to presentation only |

## Gold-plating / premature abstraction — none by the agent

- **No premature abstraction found.** The impl notes explicitly resisted extracting the trivial whole-object `sizing` spreads into a helper (would be needless indirection) and added only `SIZING_METRICS` (the real duplication). Correct restraint.
- **The in-view sizing mirror is the one "could-be-cut-for-V1" candidate** on a pure ROI basis: sizing is global-only, "not front and center," and already fully editable in the settings tab; the mirror is arguably the 20% effort delivering the last ~10% of value. **But it is a binding human decision (Q5/Q-B), so it is NOT the agent's to cut.** Flag for the human only — do NOT simplify before ship. If the human ever wants to trim V1 surface area, this is the first thing to drop, and the shared write path makes removal a near-mechanical delete.
- Minor deviation worth noting for the human: Q-B asked for "one shared component"; the two sizing surfaces are instead two renders sharing `SIZING_METRICS`. This is forced (React `<input>` vs. obsidian `Setting` widgets can't be one component) and the review accepted it. No action.

## Under-investment risks

- **Stepper rapid-click latency (already ticketed) — rightly deferred.** `DepthStepper`/`SizingSection` are fully controlled off the (one-rebuild-behind) snapshot. Rapid clicks before a rebuild lands re-send the same base value, so increments coalesce. Deferring is the correct PARETO call: it is bounded by `MAX_STEPPER_DEPTH = 5`, is not data loss, and the fix (optimistic local value + debounced flush) adds real drift-prone state. Ticket, don't build.
- **Same-family seam on the in-view sizing writes (note, ticket-at-most).** The in-view `SizingSection` builds its whole-object write from `controls.globalView` in the *snapshot* (a rebuild behind), whereas the settings tab reads globals *fresh* from the store per edit. Under rapid in-view sizing edits while a rebuild is in flight, a stale base object could clobber a just-written field. Low frequency for a global knob, and it is the same root cause as the stepper ticket — fold it into that optimistic-value ticket rather than opening a new one. Not a ship blocker.
- **Test investment is well-targeted (not under-invested).** The contract-heavy 20% (`planSettingsWrite`, `ControlsModelBuilder`, `PinnedRootResolver`, the round-trip + engine re-exploration scenarios) carries the tests; the glue (executor, React, settings tab) is manual-QA-only per repo convention (no obsidian import in tests). That is the right split — the fragile logic is covered, the switch-glue is not where bugs hide.

## Recommendations

- **Simplify before ship: none.** Nothing the agent built is over-engineered; the one trimmable surface is human-mandated.
- **Ticket (defer):** the stepper rapid-click optimistic-value item (already recommended by the reviewer) — and fold the in-view sizing stale-base note into that same ticket.
- **For the human's awareness only** (not an agent action): the in-view sizing mirror is the highest-cost/lowest-marginal-value surface in the step; it exists solely because Q5 requested it. Cheap to drop later if V1 scope tightens.
