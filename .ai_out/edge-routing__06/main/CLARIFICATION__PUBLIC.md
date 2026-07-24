# CLARIFICATION__PUBLIC — edge-routing__06

Human decisions taken at the pre-implementation clarification stop (2026-07-24).

## D1 — Home of the new user-facing routing-clearance setting

**DECIDED: add it as a 7th field on `ForceLayoutSettings`.** (Not a new top-level `ViewSettings` field.)

Consequences the implementer MUST handle (from `EXPLORATION_PUBLIC__settings.md` §8, option A):

- Touch by hand: `src/engine/types.ts:202` (`ForceLayoutSettings`), `src/engine/SettingsSpec.ts` (`globalView.forceLayout` block ~`:147`, WITH the file's mandatory `[min,max]` rationale JSDoc), `src/engine/constants.ts:91-97` (`clampForceLayoutSettings`) and `:137-143` (`EngineDefaults.forceLayoutSettings`), `src/persistence/persistedShapes.ts:190-195` (`parseForceLayout`), `src/view/forceLayoutFieldMeta.ts:16` (`FORCE_LAYOUT_FIELD_META`) **plus** one of `FORCE_LAYOUT_MAIN_FIELDS` / `FORCE_LAYOUT_ADVANCED_FIELDS` (compile-time assert `:65-67` will fail otherwise).
- Comes free: `FORCE_LAYOUT_RANGES`, the settings-tab slider, the in-graph `ForceLayoutSection.tsx` slider, the settings cascade, reset scopes, relayout-on-change diff.
- Must be updated because it hardcodes the count SIX: `src/view/settingsResetPlan.ts:94` copy, `e2e/settingsUxVisual.e2e.ts:96` (`toHaveCount(6)`), `README.md:67-71`, and the literal baselines `src/engine/SettingsSpec.test.ts:67-74` / `:95-102` and `src/engine/forceLayoutSettings.test.ts:16-23`.
- Accepted downside (explicit): a routing clearance lives in a type documented as driving the elk+d3 pipeline, and changing it triggers a full elk+d3 relayout via `src/view/GraphStructureDiff.ts:35`. Correct-but-wasteful; accepted for the free plumbing. Name the field so the routing meaning is unmistakable and say WHY it sits here in its JSDoc.
- **No `PERSISTED_SHAPE_VERSION` bump** — the parser fills missing known fields from engine defaults per field (precedent test `src/persistence/persistedShapes.test.ts:158`). A bump would be destructive (discards all stored settings), so it is explicitly NOT taken.
- Cache trap still applies: `routingSignature` (`src/view/GraphViewController.ts:362-370`) hashes only obstacles+edges, so the value must enter the routing input/signature or the slider will appear dead.

## D2 — Pre-existing RED test on clean `main` (unrelated to this ticket)

`src/engine/SettingsSpec.test.ts:98` expects `linkStrengthFactor.max: 2`; `src/engine/SettingsSpec.ts:182` ships `max: 4`. Verified red on a clean tree before any work: 1 failed / 9 passed.

**DECIDED: align the test to the shipped value 4**, in its own commit, so `npm test` is green and this ticket's acceptance criteria mean something. The shipped spec value is treated as the deliberate later change (force-layout tuning) whose baseline test was not updated.

## Still OPEN — the ticket's mandated human stop (step 2 of its Design section)

Not asked yet, by design: the two invariants at `src/view/edgeRouting.test.ts:109-119`
(`buffer === EDGE_PAIR_CURVATURE_PX / 2` and `buffer > EDGE_ARROWHEAD_INSET_MIN_PX`)
are to be resolved by the human **with the measured 5/8/11/14/17 sweep table in hand**, per ticket lines 52-61. TOP_LEVEL_AGENT will stop and ask once the sweep exists.
