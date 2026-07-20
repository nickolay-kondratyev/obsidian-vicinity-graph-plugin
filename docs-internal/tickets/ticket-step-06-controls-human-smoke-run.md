# Ticket: Step-06 human smoke run in real Obsidian (controls)

**Status:** OPEN — awaiting human run.
**Origin:** step-06-controls. The controls UI (toolbar depth steppers, node pin/unpin on both surfaces, in-view sizing mirror, global settings tab) is thin Obsidian/React glue over a pure, fully unit-tested core; the glue + the "settings round-trip through an Obsidian restart" exit criterion is the one thing the unit suite structurally cannot cover.

## What is ALREADY verified automatically (no need to re-check functionally)

`npm test` (49 files / 499 tests green) + `npm run check` (tsc clean) cover the entire contract layer:
- `planSettingsWrite` — which write lands where, per interaction, incl. pin-on-toggle (writes even when == global) and reset (=undefined → field delete).
- `ControlsModelBuilder` — presence-based inherited-vs-pinned, value derived through the same `TraversalSettingsResolver` the engine uses (shown value == graphed value, structurally), Q-A semantics (pinned central reflects only `MAIN.centralDepths[X]`).
- The headline scenario at BOTH levels: `src/adapters/CentralDepthRoundTrip.test.ts` (persistence round-trip: X's own DocData byte-identical through Y→Z→Y) + the appended block in `src/engine/NeighborhoodEngine.test.ts` (BFS actually re-explores X at the adjusted depth).
- `clampStepperDepth` bounds 0..5, `planNodePinAction` (main→none/regular→pin/pinned→unpin), `sizingMetrics` invariant vs engine `SizeMetricId`.

## What needs HUMAN eyes (native feel / visual / restart round-trip)

Full checklist: `.ai_out/step-06-controls/main/QA_CHECKLIST.md`. Focus:
1. `npm run setup:dev-vault` → open `.dev-vault` in Obsidian → open a note + the graph view.
2. Every control **round-trips through an Obsidian restart** (change → restart → identical view) — the step's hard exit criterion.
3. Pin/unpin feels native on BOTH surfaces (hover pin button + right-click menu); MAIN offers neither.
4. Inherited-vs-pinned depth styling is legible at a glance; reset (↺) only shows when pinned.
5. Toolbar at ~300px sidebar: no horizontal overflow, scrolls vertically, disclosures for pinned-centrals + sizing behave.
6. The scenario (QA §10): pin X at depth 3 while MAIN Y at 1 → X keeps exploring at 3; switch to Z and back to Y → exact restore; X's own depth untouched.
7. Settings-tab writes refresh already-open views (node cap / global depth defaults) without reopening.

Record observations inline here (step-04/05 pattern) and disposition failures to follow-up tickets.

## Known deferred (not a smoke-run failure)
- Controlled-input round-trip latency on rapid stepper / in-view-sizing edits → [[ticket-controls-optimistic-input-latency]].
