# CLARIFICATION__PUBLIC — step-04-view-shell

Recommended resolutions for the step doc's "Open items for step-level planning" (+ one found in exploration).
**STATUS: HUMAN CONFIRMED — "go with defaults" (all recommendations approved).**

| # | Open item | Recommended resolution | Rationale |
|---|-----------|------------------------|-----------|
| 1 | elk algorithm + options baseline | `layered` (elk.direction configurable) with `hierarchyHandling: INCLUDE_CHILDREN` so compound containment works in step 5. Implementation agent spikes on the dev-vault fixture to confirm before committing. | `layered` is elk's canonical compound-capable algorithm; force/stress handle containment worse. Spec: "choose elk options now with compound layout in mind." |
| 2 | Active-file change during in-flight rebuild | Latest-wins: cancel/ignore the in-flight result, run newest. Implemented via a monotonic rebuild token/generation counter (no sleeps). | Spec already states "latest wins". |
| 3 | elk web worker now vs later | **Inline async in V1** (no worker). elkjs runs async off the interaction path already; ≤100 node cap. Revisit if measured jank. | Spec: "avoid complexity if inline is fine at ≤100 nodes." Pareto. |
| 4 | Per-leaf `getState`/`setState` content in V1 | Persist **nothing view-specific in V1** beyond what ItemView needs — do NOT persist scroll/zoom. View follows active file on restore. (If trivial, store a minimal marker only.) | Spec: "scroll/zoom is NOT persisted — confirm." V1 has no view-settings UI yet (step 06), so snapshot would be empty. Keeps it simple. |
| 5 | React Flow package | **`@xyflow/react` v12** (current maintained successor to `reactflow` v11). | Actively maintained; v11 is legacy. React 18 compatible. |

## Notes
- Named constants: `SIZE_RELAYOUT_THRESHOLD = 1.0`, `REBUILD_DEBOUNCE_MS = 500` in a `src/view/` constants module.
- No behavior removed. All additive.
