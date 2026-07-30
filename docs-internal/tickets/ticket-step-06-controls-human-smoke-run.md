# Ticket: Step-06 human smoke run in real Obsidian (controls)

**Status:** OPEN — awaiting human run.

> **2026-07-29 — RE-SCOPED by `nid_ez38gf1mrdgh5kxedzrdicwzl_e` (global-only
> settings).** Settings are global-only now: the panel's Depth section is ONE pair
> of steppers driving MAIN and every pinned central, there is no per-central list,
> no inherited-vs-pinned styling and no per-control reset (↺). The checklist items
> below are corrected accordingly — **do not go looking for those affordances.**
> Everything else in this gate stands, and `.ai_out/step-06-controls/main/QA_CHECKLIST.md`
> still has the pre-simplification wording.
**Origin:** step-06-controls. The controls UI (toolbar depth steppers, node pin/unpin on both surfaces, in-view sizing mirror, global settings tab) is thin Obsidian/React glue over a pure, fully unit-tested core; the glue + the "settings round-trip through an Obsidian restart" exit criterion is the one thing the unit suite structurally cannot cover.

## What is ALREADY verified automatically (no need to re-check functionally)

**Release-time e2e now covers the glue too** (`npm run test:e2e`, real Obsidian 1.12.7, run + re-run green headless — see `.ai_out/step-06-controls/main/E2E_AUTOMATION_ANALYSIS.md`):
- `e2e/controlsRestart.e2e.ts` — depth stepper (§1), pin (§6), sizing weight (§11) and node cap (§13) all survive a **real Obsidian restart** (`ObsidianHarness.relaunch()`), the step's hard exit criterion.
- `e2e/pinnedCentralScenario.e2e.ts` — the §10 headline scenario end-to-end through the UI: the global pin lifecycle (pin MAIN → switch MAIN away → it stays a pinned central → unpin), plus the one global depth driving MAIN's own reach AND a pinned central's.
- Node **pin** is a REAL hover+click pointer gesture; toolbar steppers/sizing fire their own handler (overlay-panel pixel-clickability at ~300px is QA §16, still human).
- Surfaced two follow-ups: pinned-central status lag after restart ([[ticket-pinned-central-status-lags-after-restart]]) and a pre-existing headless flake in the step-05 node-open click ([[ticket-e2e-node-click-flaky-headless]]).

Human eyes are now needed only for the **visual/native-feel** residue of §1/§6/§10/§11/§13 (accent styling, size-change legibility) plus §2–§5, §7–§9, §12, §14–§16.

`npm test` (49 files / 499 tests green) + `npm run check` (tsc clean) cover the entire contract layer:
- `planSettingsWrite` — which write lands where, per interaction, every write landing in `data.json` as a global (there is no pin-on-toggle and no field delete left).
- `ControlsModelBuilder` — the panel renders the same `globalDepths` the engine traverses with (shown value == graphed value, structurally).
- The headline claim in `src/engine/VicinityEngine.test.ts`: the one global depth drives MAIN **and** every pinned root, and a pinned root's reach does not change when MAIN does.
- `clampStepperDepth` bounds 0..5, `planNodePinAction` (main→none/regular→pin/pinned→unpin), `sizingMetrics` invariant vs engine `SizeMetricId`.

## What needs HUMAN eyes (native feel / visual / restart round-trip)

Full checklist: `.ai_out/step-06-controls/main/QA_CHECKLIST.md`. Focus:
1. `npm run setup:dev-vault` → open `.dev-vault` in Obsidian → open a note + the graph view.
2. Every control **round-trips through an Obsidian restart** (change → restart → identical view) — the step's hard exit criterion.
3. Pin/unpin feels native on BOTH surfaces (hover pin button + right-click menu), including on MAIN itself — the active note is pinnable so it survives navigating away (asserted by `pinnedCentralScenario.e2e.ts`; this line used to say MAIN offers neither).
4. The Depth steppers read as a GLOBAL control: bumping one visibly changes every note's graph and every open view (no per-note surprise). This is the UX risk the simplification introduced — judge it here. Both surfaces are now headed **"Depth (all notes)"** (owner-chosen copy, 2026-07-29); the question left for this gate is whether that heading alone is enough, or whether the panel also needs a hint line under the steppers.
5. Toolbar at ~300px sidebar: no horizontal overflow, scrolls vertically, every section's disclosure behaves, and the Depth rows sit at the same indent as the other sections' rows (their extra card padding was removed). The longest summary is now "Depth (all notes)" — check it does not wrap awkwardly beside its chevron.
6. The scenario (QA §10): pin X while MAIN is Y → X keeps its own vicinity; raise the depth → BOTH X's and Y's reach grow; switch to Z and back to Y → nothing was per-note, so the view is the same.
7. Settings-tab writes refresh already-open views (node cap / the global depth pair) without reopening.

Record observations inline here (step-04/05 pattern) and disposition failures to follow-up tickets.

## Known deferred (not a smoke-run failure)
- Controlled-input round-trip latency on rapid stepper / in-view-sizing edits → [[ticket-controls-optimistic-input-latency]].
