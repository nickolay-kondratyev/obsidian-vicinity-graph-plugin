# Step-06 Controls — Manual QA Checklist

Run against real Obsidian through a restart. `npm run setup:dev-vault` → open `.dev-vault` → open a note + the graph view. The unit suite (49 files / 499 tests) covers all pure contract + scenario logic; this checklist covers the Obsidian/React glue that unit tests structurally cannot (per plan §11.6).

**⚙ Now e2e-automated** (`npm run test:e2e`, real Obsidian, incl. a real restart — see `E2E_AUTOMATION_ANALYSIS.md`): items **1, 6, 10, 11, 13** below are covered functionally + through-restart by `controlsRestart.e2e.ts` (depth/pin/sizing/cap survive a relaunch) and `pinnedCentralScenario.e2e.ts` (the §10 headline). The ⚙ items now need HUMAN eyes only for the *visual/native-feel* residue noted on each (dashed-accent look, size-change legibility). Everything else is still a manual pass.

Record observations inline (step-04/05 ticket pattern) and disposition anything that fails to a follow-up.

## Toolbar — depth (per-doc / per-central)
1. [ ] ⚙ MAIN outbound stepper +/− → graph re-expands in that direction; restart → value persists. *(e2e: incoming-depth variant + restart)*
2. [ ] MAIN incoming stepper is independent of outbound.
3. [ ] Reset (↺) a pinned MAIN depth → falls back to global; row shows "inherited" (muted) styling, reset button disappears.
4. [ ] Inherited-vs-pinned styling is distinct at a glance (pinned = normal text + accent marker; inherited = muted).
5. [ ] Steppers clamp at 0 (min) and 5 (max); no free-text entry.

## Pin / unpin (both surfaces)
6. [ ] ⚙ Pin a regular node via the hover pin button → becomes pinned-central (dashed accent), appears in the toolbar's "Pinned centrals" disclosure; restart → persists. *(e2e: real hover+click pin, tier + disclosure + restart; human = dashed-accent LOOK)*
7. [ ] Pin via right-click context menu (same result). MAIN node offers neither pin nor unpin.
8. [ ] Unpin via hover button AND via context menu.
9. [ ] Pin a doc that can't get a docid → Notice shown, nothing persisted, no pinned-central added.

## Scenario (goal-3 / goal-4 headline)
10. [ ] ⚙ At MAIN Y, adjust pinned central X's depth to 3 → X re-explores at 3; switch active file to Z, then back to Y → view identical to before; open X as its own MAIN → X's own depth unchanged. *(e2e: `pinnedCentralScenario.e2e.ts`, full flow)*

## Sizing (global, in-view mirror + settings tab)
11. [ ] ⚙ Toolbar "Node sizing" disclosure: toggle a metric / change a weight / min-max → node sizes change globally; restart persists. *(e2e: weight write persists through restart; human = size-change LOOK)*
12. [ ] Settings tab sizing controls mirror the toolbar; a change in one is reflected after the other's view refreshes.

## Settings tab (global)
13. [ ] ⚙ Change node cap → truncation changes in the open view (refresh fan-out, no reopen); restart persists. *(e2e: cap write persists through restart; human = live-refresh visual)*
14. [ ] Change global depth defaults → new/inherited docs use them; open view refreshes.

## Layout / overflow
15. [ ] Toolbar collapse/expand works; pinned-centrals + sizing disclosures open/close.
16. [ ] At ~300px sidebar width: no horizontal overflow; toolbar scrolls vertically when tall.

## Known deferred (see ticket-controls-optimistic-input-latency)
- Rapid +/− stepper clicks coalesce (each waits a write→rebuild round-trip). Bounded by max depth 5; not data loss. Same for rapid in-view sizing edits (built from a one-rebuild-behind snapshot).
