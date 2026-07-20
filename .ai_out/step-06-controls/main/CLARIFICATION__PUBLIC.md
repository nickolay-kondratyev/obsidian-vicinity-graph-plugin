# CLARIFICATION — step-06-controls

Human-aligned decisions (2026-07-20). These bound the plan; do not re-litigate without human.

| # | Decision | Resolution |
|---|----------|-----------|
| Q1 | Toolbar placement/overflow @~300px | **Single React-Flow `<Panel position="top-left">`**, compact, **collapsed-by-default**. MAIN central + depth steppers always visible; pinned centrals and sizing section behind expand/disclosure toggles (sizing "not front and center"). Vertical stack, scrolls if tall. |
| Q2 | Depth stepper bounds | **`MAX_STEPPER_DEPTH = 5`** (new named constant), min **0** (= central only). Steppers clamp; no free-text entry. |
| Q3 | Node pin/unpin affordance | **BOTH**: (1) hover-reveal pin/unpin **button on the node** — appears only on hover, hidden otherwise (fast, no clutter when idle); (2) right-click **context menu** entry (mirrors `ObsidianGraphUi.showAttachmentMenu`). "Pin" on regular nodes, "Unpin" on pinned centrals; MAIN itself not pinnable. |
| Q4 | Node-cap control target | **Global settings tab only** (writes `saveGlobalView`), NOT in per-view toolbar. Cascade still works; UI doesn't expose per-doc cap in V1. |
| Q5 | Sizing section write target | **Global** (`saveGlobalView`). Toolbar's expandable sizing section is an in-view mirror of the settings-tab sizing controls. |

## Implications for the plan
- Toolbar's **depth steppers are the only per-doc/per-central write surface** in V1 (via `setDocDepthField` for MAIN's own depth; `setCentralDepthField` for pinned centrals). Sizing + cap are global-only.
- **Reset-to-global (unpin field)** affordance applies to the **depth steppers** (per-direction), since those are the only per-doc-pinnable controls surfaced. Write `value=undefined` to reset. Inherited-vs-pinned visual distinction needed for depth fields.
- Pin/unpin has two entry points (hover button + context menu) → keep the decision/planning logic pure and shared; only the Obsidian `Menu`/DOM binding differs.
- "Can't be pinned" (`PersistableIdentity.kind==="not-persistable"`) → Obsidian `Notice`.
