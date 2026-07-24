---
id: nid_j2jwp6x9rij34kbkewo03m0mb_e
title: "edge-routing__06: non-exclusive group boundary pins + reduce and expose the libavoid shape buffer"
status: open
deps: []
links: [nid_4lmhpfc64eb4auw27wqis8wqe_e]
created_iso: 2026-07-24T23:18:29Z
status_updated_iso: 2026-07-24T23:18:29Z
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

WHY: libavoid directional pins default to EXCLUSIVE (one connector per pin). Group boxes carry 3 pins per side, so the 4th edge approaching a given side finds no free pin of its class and silently falls back to the group's CENTRE attachment — the pre-`edge-routing__04` pathology, live in shipped code TODAY. A probe put 5 of 8 left-approaching edges on the group centre.

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
- At 5px the arrowhead inset (14px) EXCEEDS the obstacle clearance, so arrowheads may visually overlap neighbouring nodes. That is a real visual consequence, not a theoretical one.

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

