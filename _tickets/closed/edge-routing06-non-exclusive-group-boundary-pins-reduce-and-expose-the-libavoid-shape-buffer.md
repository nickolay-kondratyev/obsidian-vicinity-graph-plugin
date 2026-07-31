---
closed_iso: 2026-07-25T04:36:37Z
id: nid_j2jwp6x9rij34kbkewo03m0mb_e
title: "edge-routing__06: non-exclusive group boundary pins + reduce and expose the libavoid shape buffer"
status: closed
deps: []
links: [nid_4lmhpfc64eb4auw27wqis8wqe_e]
created_iso: 2026-07-24T23:18:29Z
status_updated_iso: 2026-07-25T04:36:37Z
type: feature
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [edge-routing, layout, aesthetics]
---

Two parameter-level KISS wins that survived the `edge-routing__05` investigation. Both attack the same user-visible symptom (edges to/from folder-group boxes wrap around and attach on a far side instead of the side facing the neighbour — the 2026-07-24 Epictetus screenshot), without the two-pass machinery that ticket explored.

BACKGROUND (read first): `edge-routing__05` (`_tickets/edge-routing05-over-stretched-wrap-around-routes-pick-the-facing-side-when-a-better-attachment-exists.md`, id `nid_4lmhpfc64eb4auw27wqis8wqe_e`) was closed as a MEASURED NEGATIVE RESULT — facing-side `ShapeConnectionPin.setConnectionCost` changes 0 of 818 group attachments across 400 random crowded scenes, and is still 0 at cost 100000. Do NOT retry pin costs. Full history, all measurements and the parked two-pass design: `docs-internal/research/facing-side-edge-attachment.md`. Diagnosis of the symptom: `docs-internal/research/research-layout-aesthetics.md` sections B1/C1.

The two items below are independent and should be separate commits. (a) is small and self-contained; (b) is the larger one and starts with a HUMAN DECISION, not with code.

## (a) `setExclusive(false)` on the folder-group boundary pins

WHERE: `src/view/edgeRouting.ts` — the `BOUNDARY_PIN_SPECS` registration loop (the `ShapeConnectionPin` is currently constructed and immediately discarded, around line 269). Keep the pin in a LOCAL const only long enough to call `setExclusive(false)`.

HARD RULE: never push that pin into `AvoidArena.owned` and never `destroy()` it — the Router owns and frees its pins, so freeing it ourselves is a double-free and aborts the wasm module. The existing block comment near `src/view/edgeRouting.ts:288-298` already states this rule; point at it from the call site.

`src/view/libavoidLoader.ts` types the `ShapeConnectionPin` constructor result as `unknown`. Narrow it to a named type exposing `setExclusive(b: boolean): void` (and `isExclusive()`), following that file's existing "narrow only what we use" pattern.

WHY: libavoid directional pins default to EXCLUSIVE (one connector per pin), so a group's boundary pins are exhausted by crowding and further edges fall back to the group's CENTRE attachment — the pre-`edge-routing__04` pathology, live in shipped code TODAY.

> **CORRECTED ON CLOSE (measured, see Notes).** The original text said "the 4th edge approaching a given side ... falls back to the group's CENTRE" and "a probe put 5 of 8 left-approaching edges on the group centre". Both are wrong. Exclusivity is per PIN over the whole 12-pin shared-class pool, so CENTRE fallback begins at the **13th** edge, not the 4th; at 8 edges there are **zero** centre attachments and the symptom is **5 of 8 landing on the wrong SIDE**. Separately, "directional pins default to exclusive" is only half the rule: libavoid derives the default from the pin's visibility directions, so `ConnDirAll` pins (the note centre pin) are created NON-exclusive.

MEASURED (reviewer probe, same scene generator and seed as the `edge-routing__05` probes):
- realistic group degree (1-7 edges per group, 1668 edges): non-facing attachments 82 -> 40, total route length -2.3%.
- low degree (1-3 edges per group, 802 edges): non-facing 24 -> 22, total route length -0.3%.
One line of code, single routing pass, zero extra routing work.

TEST (start RED): real-wasm BDD test in `src/view/edgeRouting.test.ts` — GIVEN 8 edges approaching the same side of one folder-group box, WHEN routed THEN no route terminates at the group centre.

## (b) Reduce the libavoid `shapeBufferDistance` and expose it as a user setting

CURRENT: `src/view/edgeRouting.ts:71` — `export const EDGE_ROUTING_SHAPE_BUFFER_PX = EDGE_PAIR_CURVATURE_PX / 2;` (= 17), applied at `src/view/edgeRouting.ts:374` via `router.setRoutingParameter(avoid.shapeBufferDistance, ...)`.
PROPOSED by the human: default 5px, exposed as a user-facing setting.

WHY THIS LEVER: the `edge-routing__05` probes showed facing-side pins are frequently VISIBILITY-BLOCKED, not merely expensive. Every obstacle carries a 17px buffer, so the corridor between a neighbour note and the group's facing border seals shut and the router must wrap. Shrinking the buffer attacks the measured root cause; no pin cost can reach a pin the router cannot see.

### CRITICAL — 17px is load-bearing AND test-locked. Do not just change the number.

- It is DERIVED, not free: `EDGE_ROUTING_SHAPE_BUFFER_PX = EDGE_PAIR_CURVATURE_PX / 2`, tying obstacle clearance to the hand-drawn bowed edge-pair curvature (`src/view/edgeGeometry.ts:58`, 34px) so routed detours read at the same visual scale as bowed pairs.
- It was deliberately chosen GREATER than the arrowhead minimum inset `EDGE_ARROWHEAD_INSET_MIN_PX = 14` (`src/view/edgeGeometry.ts:45`), so a route clears a box further out than its own arrowhead ever sits.
- BOTH invariants are asserted in `src/view/edgeRouting.test.ts:109-131`. These are BEHAVIOR-CAPTURING tests: do NOT loosen, skip or delete them without explicit human alignment.
- ~~At 5px the arrowhead inset (14px) EXCEEDS the obstacle clearance, so arrowheads may visually overlap neighbouring nodes. That is a real visual consequence, not a theoretical one.~~

> **CORRECTED ON CLOSE — this premise is measurably BACKWARDS.** Arrowhead overlap of a non-endpoint box falls monotonically as the buffer shrinks: **4.50% at 17px → 3.24% at 5px** (400 scenes, 1668 arrowheads). The comparison was never geometrically meaningful: the buffer is a PERPENDICULAR clearance from an obstacle, while the arrowhead inset is a LONGITUDINAL offset back along the route, so `buffer > inset` never described a containment relation. The constant that does protect the arrowhead body is `ARROWHEAD_HALF_WIDTH_PX` (6), which IS perpendicular — and that is what shipped as the clamp floor.

### FIRST TASK (before any implementation): resolve the two invariants, human decides

Lay out the options with the sweep evidence (below) and ask; do not pick unilaterally:
1. Re-derive the curvature tie — keep a documented relationship to `EDGE_PAIR_CURVATURE_PX` at a new divisor, or reduce the curvature too.
2. Shrink `EDGE_ARROWHEAD_INSET_MIN_PX` so the buffer > inset ordering survives at the new buffer.
3. Accept the decoupling — the buffer becomes an independently tuned value; both tests are rewritten to capture the NEW intent with the rationale in the test comment; the arrowhead-overlap consequence is accepted explicitly.

### MEASURED SWEEP (do not assume 5 is correct)

Sweep values 5 / 8 / 11 / 14 / 17 through the dev-vault fixtures using `e2e/edgeRoutingEval.e2e.ts` (`npm run test:e2e -- edgeRoutingEval.e2e.ts`, fixtures sparse / medium / dense). Per value record: non-facing attachment count, `maxDetourRatio`, `meanDetourRatio`, routing ms and layout ms, plus ONE screenshot per value in `.out/` (never source-controlled). Paste the table into this ticket's notes.

PREREQUISITE: `e2e/edgeRoutingEval.e2e.ts` is STALE — it drives the removed `layered`/`radial` layout modes and asserts a routing gate that no longer exists, so its numbers are not trustworthy until repaired. That repair is the open chore ticket `_tickets/e2e-remove-layeredradial-layout-mode-references-left-by-force-layout-only-ticket.md` — do it first (own commit).

Baselines of record (edge-routing__04, current shipped state): sparse 2.9ms routing / 34.4ms layout; medium 9.4 / 35.6, maxDetour 1.000; dense 137.2 / 1463.6, maxDetour 3.096, meanDetour 1.161.

### SETTINGS COST — real in this repo, and a deliberate reversal

Exposing a knob touches, at minimum:
- engine settings spec, defaults and clamp ranges: `src/engine/constants.ts` (see `FORCE_LAYOUT_RANGES`, `clampForceLayoutSettings`, `EngineDefaults`), `src/engine/SettingsSpec.ts`, re-exported from `src/engine/index.ts`.
- the persisted shape, which carries a `version` field: `src/persistence/persistedShapes.ts` — a mismatched `version` parses to defaults, so decide explicitly whether adding a field needs a `PERSISTED_SHAPE_VERSION` bump and say why.
- the settings tab: `src/view/VicinityGraphSettingTab.ts` — mirror `addForceLayoutSlider` (bounds from the engine ranges, not hardcoded in the view).
- the user-facing settings model in `README.md` ("Settings model" section).
Load the `obsidian-settings` skill before designing the row.

This CONTRADICTS the old `edge-routing__05` standing constraint "no new settings/knobs exposed to users". The reversal is deliberate and human-approved (2026-07-24) — do not treat the old constraint as binding here.

## Standing constraints (unchanged)

- `EDGE_ROUTING_CROSSING_PENALTY_PX` stays 0 (its cost is a cliff for any positive value — `docs-internal/research/crossing-penalty-and-worker-offload.md`).
- Routing pass stays well under elk+d3 layout time on the dense fixture (existing committed PERF BUDGET gate in `e2e/edgeRoutingEval.e2e.ts`).
- Never `destroy()` a router-owned `ShapeConnectionPin`.
- If a facing-side real-wasm test goes red, investigate — do not loosen `FACING_BORDER_TOL_PX`, `MID_SPAN_TOL_PX` or `CORNER_CLEARANCE_TOL_PX`.

## Design

Sequencing (each step its own commit):

0. Repair `e2e/edgeRoutingEval.e2e.ts` (the separate open chore ticket) so before/after numbers are trustworthy, and make sure `maxDetourRatio` / `meanDetourRatio` are actually PRINTED in the `[eval] force/<label>: ...` line — the headline acceptance number is currently not surfaced.
1. (a) `setExclusive(false)`: RED real-wasm test first (8 edges on one side -> none at the group centre), then the one-line change plus the `libavoidLoader.ts` type narrowing, then re-measure and record.
2. (b) STOP and ask the human about the two invariants (`buffer = curvature/2` and `buffer > arrowhead min inset`) BEFORE writing code. Bring the sweep table to that conversation.
3. (b) Run the 5 / 8 / 11 / 14 / 17 sweep by temporarily overriding the constant; record numbers + one screenshot per value; propose a default.
4. (b) Only then implement the setting end-to-end (engine range/default/clamp -> persisted shape -> settings tab -> README) with the chosen default.

Why NOT the two-pass facing design: measured in `edge-routing__05` and parked in `docs-internal/research/facing-side-edge-attachment.md`. It needs ~120 lines, a second router pass, a keep-the-better tolerance (1.30x if ever built) and a doubled routing pass on every grouped vicinity, and its headline numbers were measured WITHOUT `setExclusive(false)` — item (a) here is measured to close roughly 60% of the same gap for one line. Revisit only if (a)+(b) underdeliver.

Also parked (do not pull in): 4 directional pins per note square (revives the 64x perf pathology, ~8838ms vs ~1450ms layout), detourRatio-triggered re-route, `clusterCrossingPenalty` (`Avoid::ClusterRef` is NOT bound in libavoid-js 0.4.5).

## Acceptance Criteria

(a) setExclusive(false):
- A real-wasm test in `src/view/edgeRouting.test.ts` proves no route terminates at the group CENTRE when 8 edges approach one side of a folder-group box; the test was RED before the change.
- Non-facing attachment count and total route length measured before/after and recorded in this ticket's notes.
- No pin is ever pushed into `AvoidArena.owned` or `destroy()`ed.

(b) shapeBufferDistance:
- The human has explicitly decided how the two invariants in `src/view/edgeRouting.test.ts:109-131` are resolved, and the decision plus rationale is recorded in this ticket AND in the test comments. Neither test is silently loosened or deleted.
- A sweep table for 5 / 8 / 11 / 14 / 17 (non-facing count, maxDetourRatio, meanDetourRatio, routing ms, layout ms) is in this ticket's notes, with one screenshot per value under `.out/`.
- The shipped default is the swept value the human chose, not an assumed one.
- The setting is reachable end-to-end: engine default + clamp range, persisted shape (with an explicit call on whether `PERSISTED_SHAPE_VERSION` bumps), settings tab row, README "Settings model" entry.
- `npm run check` and `npm test` green; `npm run test:e2e -- edgeRoutingEval.e2e.ts` green including the PERF BUDGET gate.

Both:
- `EDGE_ROUTING_CROSSING_PENALTY_PX` still 0; dense-fixture routing still well under layout time.
- Screenshot smoke recorded from the real `.out/public` vault opened on `clear-goals.md`: does the Epictetus edge now attach on the facing side?


## Notes

**2026-07-25T04:36:27Z**

RESOLUTION — both items shipped. Full evidence: .ai_out/edge-routing__06/main/

## (a) setExclusive(false) on the group boundary pins — commits 2d08ab1, 9f92e77

Measured, 400 seeded scenes per corpus (node probes; e2e cannot see this metric):

| corpus | non-facing before | after | total route length |
|---|---|---|---|
| low degree (1-3 edges/group, 802 edges)      | 24 | 22 | -0.3% |
| realistic degree (1-7 edges/group, 1668 edges) | 82 | 40 | -2.3% |

Routing time flat (387->377ms, 536->530ms). Deterministic 8-leaf side-crowding probe: 5 of 8 edges
on the wrong side -> 8 of 8 on the facing side; at 16 edges, 4 centre attachments -> 0.

Two corrections to this ticket's own WHY text are inlined in the body above (13th edge not 4th;
exclusivity is derived from visDirs, so ConnDirAll pins are already non-exclusive). The mandated
acceptance test ("8 edges -> none at the group centre") is UNSATISFIABLE as a RED test, because at
8 edges the pre-change router already produced zero centre attachments. It was replaced by a
strictly stronger pair: the same 8-edge scene asserting every terminal is on the facing border
(which implies "none at the centre"), plus the centre assertion at 16 edges where the pathology
actually exists. Both are RED before the change. No pin is pushed into AvoidArena.owned or destroyed.

The note-square centre pin gets the call too, as explicit intent rather than behaviour: it changed
0 of 949 routes, but the default is invisible and direction-derived, and forcing it exclusive routes
spokes straight through obstacles (5 of 6 in a probe). A guard test locks that.

## (b) shapeBufferDistance -> the "Edge clearance" setting — commits 0703634, fc94c33, dc71503, d323512

MEASURED SWEEP (realistic-degree corpus + e2e dense fixture, on top of item (a)):

| buffer | non-facing (realistic / low) | dense maxDetour | dense meanDetour | route len | arrowhead overlap | routing ms |
|---|---|---|---|---|---|---|
| 5  | 22 / 7  | 1.188 | 1.033 | -2.7% | 3.24% | flat |
| 8  | 25 / 9  | 1.226 | 1.036 | -2.2% | 3.66% | flat |
| 11 | 26 / 7  | 1.244 | 1.046 | -1.6% | 3.90% | flat |
| 14 | 23 / 9  | 1.327 | 1.055 | -0.6% | 4.14% | flat |
| 16 | 39 / 20 | 1.337 | 1.062 | -0.3% | 4.50% | flat |
| 17 (shipped before) | 40 / 22 | 1.342 | 1.067 | 0.0% | 4.50% | flat |

Screenshots: one set per value under .out/ (gitignored). Routing ms showed no buffer trend at any
value; PERF BUDGET passed all 12 runs at roughly 10x margin.

ROOT CAUSE FOUND, and it is not what the ticket assumed. The corridor is sealed by the group's OWN
member squares, not by neighbouring notes: ELK_GROUP_PADDING insets members 16px, members are
separate routing obstacles, so once buffer > that padding a member's clearance escapes the group
border and seals the group's own boundary pins. Proven a mechanism, not a curve fit: the cliff moves
when the inset moves (inset 10 -> degrades from buffer 11; inset 24 -> never degrades in range).
The shipped 17 sat 1-2px OVER that cliff, making it the worst plausible value.

DECISIONS (human, 2026-07-24/25):
- Default 11, clamp 6-14 step 1, exposed as a 7th ForceLayoutSettings field "Edge clearance" in the
  Advanced spacing group.
- PERSISTED_SHAPE_VERSION does NOT bump. The parser fills missing known fields from engine defaults
  per field, so an existing data.json loads with every setting intact and only picks up the new
  default. A bump would DISCARD all stored user settings. Verified by constructing a real pre-change
  data.json (clamping also verified: 999 -> 14, -5 -> 6).
- Invariant option 3, with two REPLACEMENT invariants rather than a plain decoupling. Neither old
  test was loosened or deleted; both were replaced by stronger relations asserted against the clamp
  RANGE, so they hold for every value a user can reach:
      buffer === EDGE_PAIR_CURVATURE_PX / 2  ->  max < GROUP_SIDE_PADDING_PX (16)
      buffer > EDGE_ARROWHEAD_INSET_MIN_PX   ->  min >= ARROWHEAD_HALF_WIDTH_PX (6)
  At exactly 6 the arrowhead body is tangent to the box, not overlapping, so >= is sound.
  GROUP_SIDE_PADDING_PX was extracted from the elk syntax string and ARROWHEAD_HALF_WIDTH_PX
  exported, so both bounds are machine-checked instead of prose.

AFTER (shipped 11px): dense maxDetourRatio 1.342 -> 1.244, meanDetourRatio 1.067 -> 1.046; facing
fixture 1.310 -> 1.266. Exactly matches the sweep's prediction for 11. PERF BUDGET passing at 10.6x.

## Acceptance criteria — how each was met

- Real-vault screenshot smoke: REPLACED, at the human's direction, by a permanent `facing` dev-vault
  fixture (5-member group approached by 12 separate neighbour edges from one side). Better than the
  manual check it replaces, and it closed a real gap: no prior fixture could show this symptom at all
  (medium gives each group one collapsed x4 edge; dense has no folder groups).
  Result: on shipped code all 12 edges attach on the facing side — item (a) alone already fixed the
  reported symptom. With setExclusive(false) removed, edges wrap to the RIGHT and BOTTOM borders for
  neighbours that are all ABOVE the box, which is the reported symptom reproduced.
- The facing-side property is now a committed e2e assertion. It had NO automated gate before: the
  [eval] detour ratios are byte-identical between the wrapping and non-wrapping arms, so a regression
  passed a fully green suite.
- e2e/edgeRoutingEval.e2e.ts repaired first (own commit b4a9d57) and maxDetourRatio/meanDetourRatio
  now printed. The layered/radial chore ticket is closed by that commit.
- EDGE_ROUTING_CROSSING_PENALTY_PX still 0. Dense routing ~134ms vs ~1383ms layout.
- npm run check clean; npm test 780 passed; e2e green including PERF BUDGET.

## Known consequence, accepted (own ticket)

Shared pins make many edges converge on ~3 terminal points per side (3 pins per side is an
architectural floor; no buffer value changes it). Now visible for the first time on the facing
fixture: 11 of 12 edges on one border point. Accepted as strictly better than the wrap-around it
replaced; tracked as nid_g1zb4b06gew54gnwcn5hx237j_e with the screenshot as evidence.

## Follow-ups filed
- nid_oy3vas85xhr34n2dby1mvows4_e  wasm abort on the routing throw path (pre-existing, priority 1)
- nid_g1zb4b06gew54gnwcn5hx237j_e  pin fan-in
- nid_li45606h8uvcnjm7fss17xl1u_e  sparse eval fixture nondeterminism
- nid_se3h2v45c10x9j42utbm8v2sn_e  e2e vault override (VICINITY_E2E_VAULT)
- nid_5wiribg2mn0mqcr7ni4ya0cfe_e  settings-slider a11y gap (plugin-wide)
- nid_sw50n310je164zf8psqig77a9_e  move arrowhead constants into edgeGeometry.ts
