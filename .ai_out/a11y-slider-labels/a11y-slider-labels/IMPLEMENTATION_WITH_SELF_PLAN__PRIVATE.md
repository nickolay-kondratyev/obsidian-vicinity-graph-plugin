# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE (a11y slider labels)

## Goal
Every settings-tab control carries `aria-label` == its visible setting name, expressed in as
few places as possible, guarded by a real-DOM e2e assertion.

## Design call
Option (a) from TOP_LEVEL: explicit labeling inside shared helpers + one e2e assertion that
NO `input` in `.vicinity-graph-settings` lacks `aria-label`. Additionally DRY the rule into a
single private `nameControl(el, accessibleName)` helper carrying the WHY comment, and unify the
three slider call sites (depth ×2, force-layout ×7, outline depth ×1) behind one
`addLabeledSlider(...)` so a future slider row cannot skip the label.

## Plan (checklist)
1. [x] Read setting tab + exploration docs.
2. [x] Add `SliderBounds` local interface + `nameControl` static helper.
3. [x] `addLabeledSlider` shared; `addDepthSlider`/`addForceLayoutSlider`/outline-depth delegate.
4. [x] `addSizingNumber` labels its input; node-cap input labeled.
5. [x] Reuse `nameControl` at the 4 pre-existing aria-label sites (reset buttons ×2, textarea, weight).
6. [x] Toggles: NOT done (Obsidian checkbox-container) → follow-up ticket.
7. [x] e2e assertions in `e2e/settingsUxVisual.e2e.ts`; simplify the `.or()` fallback at ~176.
8. [x] Run `npm run check`, `npm test`, e2e settingsUxVisual + settingsResetReview.
9. [x] Follow-up tickets for §4 nits.

## State
Complete; results recorded in the PUBLIC file.
