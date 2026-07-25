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
Iteration 1 complete; results in `IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md`.

## Iteration 2 (review response) — complete
Review verdict was READY / 0 blocking; all 3 should-fix + all 3 nits ACCEPTED, none rejected.
1. [x] S1 — textarea clause was vacuous: enable `nodeExclusion` + re-`display()` inside the test,
   plus a positive `getByLabel("Exclusion patterns")` assertion.
2. [x] S2 — guard widened to a DENY-list: `input:not([type=radio]):not([type=checkbox])`, `select`,
   `textarea`; the "all" and "unlabeled" selectors are derived from one array (no drift).
   Radio/checkbox exemptions commented, checkbox one carries ticket `nid_d2z2jgt6v49ssej8hxmwd2xi6_e`.
3. [x] S3 — `getByLabel("Node cap")` type=number, plus `MIN_NAMED_CONTROLS = 20` floor
   (measured via a deliberate 999 mutation).
4. [x] N1 — dropped the deprecated no-op `setDynamicTooltip()` (clean break) + WHY-NOT comment.
5. [x] N2 — `Node cap` locator scoped to `.vicinity-graph-settings`.
6. [x] N3 — "core does nothing" finding written into `IMPLEMENTATION_ITERATION__PUBLIC.md`.
7. [x] Mutation-checked 4 ways (M0 floor=20, M1 slider, M2 textarea, M3 new type=text row) — all RED.
   Driver was `.tmp/mutate.py`; tree restored + verified clean.

Committed as `b334209`. Gotcha for future me: `git checkout <file>` to revert a mutation ALSO
destroyed uncommitted work once — commit the good state BEFORE mutation testing.

Left open deliberately: ticket `nid_5wiribg2mn0mqcr7ni4ya0cfe_e` (TOP_LEVEL closes it); no
`change_log` entry (TOP_LEVEL owns it).

## Iteration 3 (review-2 response) — complete
Review 2 verdict: NOT-READY, 1 BLOCKING (B1). Scope was exactly one revert.
1. [x] B1 — restored `.setDynamicTooltip()` in `addLabeledSlider`
   (`src/view/VicinityGraphSettingTab.ts`), WHY-NOT comment replaced by a WHY that records the
   1.12.x-vs-1.13 typings trap so nobody repeats the removal.
2. [x] Runtime proof on pinned Obsidian 1.12.7 via throwaway `e2e/zzTooltipProbe.e2e.ts`
   (created, run before + after, deleted): ours `.tooltip` `[]` → `["1"]`; core control group
   `["16"]` in both. Compile/green-suite alone would have proved nothing here.
3. [x] check/test/settingsUxVisual/settingsResetReview all green (verbatim in the PUBLIC file).
4. [x] Tickets filed, NOT implemented: `nid_14phm98g7w64oparxz5wvfqwh_e` (e2e slider-value
   assertion) and `nid_6kms4zn8o8c8r7g983oqlvvky_e` (pin `obsidian` devDep + CLAUDE.md guardrail).
5. [x] Nothing else touched — guard, locators, a11y code all left as reviewed.

**Lesson for future me (the real one):** an `@deprecated` tag in `obsidian.d.ts` describes the
INSTALLED typings version, not `minAppVersion`. `package.json` pins `"obsidian": "latest"`. Before
deleting any Obsidian API call, check the shipped bundle of the e2e-pinned build
(`.tmp/obsidian/obsidian-<ver>/resources/obsidian.asar`) and probe the real DOM. "Deprecated" is not
"no-op". Also: a fully green suite proves nothing about behaviour nobody asserts.
