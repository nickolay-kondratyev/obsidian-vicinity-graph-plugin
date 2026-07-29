# TOP_LEVEL_AGENT — settings-cleanup-descriptor-model

Ticket: `_tickets/settings-cleanup-descriptor-model.md` (`nid_wimjq4ewgbg21n4zx9d4qq3a0_e`)
Branch: `CC_nid_wimjq4ewgbg21n4zx9d4qq3a0_e__descriptor-model_opus`
Chain context: `docs-internal/notes/settings.md` — step 2 of 6.

## Scope boundary (important)

IN: one declarative field descriptor per setting, deriving spec entry, ViewSettings
field/type, default, override parse branch, write plan, reset scope, row metadata.
Unions declared once (folds in `nid_3k0a4zl6in0mj8lcjibkjq2dx_e`).

OUT (later tickets): write/refresh pipeline rewrite (3), dual-presenter rewrite (4),
spec-driven test rewrite (5), new fields (6).

Primary invariant: **absent override = inherit** (ViewSettings vs ViewSettingsOverride split).

## Phase log

| Phase | Status | Result file |
|-------|--------|-------------|
| EXPLORATION | running | `EXPLORATION_PUBLIC.md` (index) + 3 area files |
| CLARIFICATION | pending | `CLARIFICATION__PUBLIC.md` |
| DETAILED_PLANNING | pending | `DETAILED_PLANNING__PUBLIC.md` |
| DETAILED_PLAN_REVIEW | pending | `DETAILED_PLAN_REVIEW__PUBLIC.md` |
| PLAN_ITERATION | pending | `PLAN_ITERATION__PUBLIC.md` |
| IMPLEMENTATION | pending | `IMPLEMENTATION__PUBLIC.md` |
| IMPLEMENTATION_REVIEW | pending | `IMPLEMENTATION_REVIEW__PUBLIC.md` |
| IMPLEMENTATION_ITERATION | pending | `IMPLEMENTATION_ITERATION__PUBLIC.md` |
