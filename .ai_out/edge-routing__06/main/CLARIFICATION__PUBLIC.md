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

## D3 — the ticket's mandated human stop, taken WITH the sweep table (`SWEEP__PUBLIC.md`)

**DECIDED: default 11px, clamp range 6-14 step 1, and the ticket's option 3 with two REPLACEMENT invariants.**

The two existing invariants at `src/view/edgeRouting.test.ts:110-118` are **replaced, not loosened or deleted**:

| Removed | Replaced by | Measured rationale (goes in the test comment) |
|---|---|---|
| `buffer === EDGE_PAIR_CURVATURE_PX / 2` | `buffer < ` folder-group side padding (16) | A group's member squares are separate obstacles inset 16px by `ELK_GROUP_PADDING`. Once the buffer exceeds that padding a member's clearance escapes the group border and seals the group's own boundary pins. Measured cliff; it moves when the inset moves (`SWEEP__PUBLIC.md` §4). Today's 17 sits 1-2px over it. |
| `buffer > EDGE_ARROWHEAD_INSET_MIN_PX (14)` | `buffer > ARROWHEAD_HALF_WIDTH_PX (6)` | The old pair compared a PERPENDICULAR clearance to a LONGITUDINAL offset — never a real containment relation. The arrowhead half-width is perpendicular like the buffer, so this one actually guarantees the head's body stays clear of every box its route clears. |

Ticket options 1 (re-derive the curvature tie) and 2 (shrink the arrowhead inset) were **rejected on the data**: nothing ties bowed-pair curvature to obstacle clearance, and arrowhead overlap measurably IMPROVES at smaller buffers (4.50% at 17 → 3.24% at 5), so option 2 compensates for a non-problem.

**Clamp 6-14 is load-bearing:** it makes both invariants properties of *every reachable value*, not just the shipped default — the tests assert `min > 6` and `max < 16`. Accepted, deliberate consequence: a user can no longer reproduce today's spacing. That is intended; today's spacing is the pathology.

**Required supporting refactor:** export `ARROWHEAD_HALF_WIDTH_PX` from `src/view/VicinityEdge.tsx:23`, and extract a numeric `GROUP_SIDE_PADDING_PX = 16` in `src/view/constants.ts` that the `ELK_GROUP_PADDING` elk syntax string is BUILT FROM. The 16 currently exists only inside `"[top=36.0,left=16.0,bottom=16.0,right=16.0]"`, so invariant 1 is not machine-checkable without it.

## D4 — settings row placement and label

**DECIDED: label "Edge clearance", placed in the *Advanced spacing* disclosure** of the Force layout card, after "Node spacing" and "Group member spacing".

WHY: the four main sliders are deliberately named after Obsidian's native graph so the card reads as familiar; a routing clearance has no native analogue. Advanced spacing already holds exactly this class of px fine-tuning knob.

## D5 — the real-vault screenshot smoke

**DECIDED: recreate the scenario as a new `.dev-vault` fixture** rather than driving the human's real 457MB `.out/public` vault or dropping the criterion.

This is strictly better than the options offered: it turns a one-off manual eyeball into a permanent automatable fixture, and it fills the exact gap the sweep identified — no existing fixture can show the group facing-side symptom (`medium` gives each group a single collapsed x4 edge; `dense` has no folder groups at all), which is also why the fan-in question got no visual evidence.

## D6 — follow-ups (all four approved)

1. Correct the ticket's disproved text on close (three claims: 4th-edge centre fallback, "5 of 8 on the centre", the arrowhead-overlap warning).
2. Fan-in ticket — filed: `nid_g1zb4b06gew54gnwcn5hx237j_e`.
3. Sparse e2e fixture nondeterminism — filed: `nid_li45606h8uvcnjm7fss17xl1u_e`.
4. Harness vault override `VICINITY_E2E_VAULT` — filed: `nid_se3h2v45c10x9j42utbm8v2sn_e`.

Plus, filed earlier from the item-(a) review: the wasm-abort-on-routing-throw bug, `nid_oy3vas85xhr34n2dby1mvows4_e`.
