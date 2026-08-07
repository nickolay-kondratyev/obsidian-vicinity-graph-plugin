---
id: nid_ghaeps3siekw0oe17mr4xpmad_e
title: "Restart-time stale controls: toolbar depth stepper stuck at defaults after an Obsidian restart"
status: open
deps: []
links: []
created_iso: 2026-08-07T18:08:51Z
status_updated_iso: 2026-08-07T18:08:51Z
type: bug
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [view]
---

Distinct root cause found while root-causing ticket nid_1s77g4wx33uj8b380d1oph1d6_e (residual live-view repaint stall). Independent of that ticket's node-box fix.

SYMPTOM (floor e2e, ~10-25% under full-suite load): e2e/controlsRestart.e2e.ts:136 "depth, pin, node cap and sizing all survive an Obsidian restart" fails at line 179 — the toolbar non-pinned "Links in" stepper stays at the DEFAULT "1" for the full 15s poll while data.json holds "2" (observed 18-26x resolving to "1").

WHY THIS IS A DIFFERENT BUG FROM nid_1s77g4wx33uj8b380d1oph1d6_e:
- The depth stepper renders snapshot.controls DIRECTLY (src/view/GraphToolbar.tsx -> DepthControls -> DepthStepper via useOptimisticValue, which returns the STORED snapshot value when no pending edit). There is NO local-node state and NO onNodesChange involved.
- So a stuck default "1" means the READY snapshot the controller published itself carries EMPTY_CONTROLS/default depth (linkDepthIn=1), i.e. the build read the store as defaults.
- The node graph rendered (HUB is data-tier=main), so status=ready — the build DID run and publish; it just carried default controls.

HYPOTHESIS: after an Obsidian restart + view remount, the FIRST GraphViewController build (src/view/GraphViewController.ts buildAndPublish -> this.controls = result.controls) runs BEFORE the plugin has finished loading data.json (main.ts onload loadData is async), so the engine reads spec defaults; no later rebuild is triggered (no settings/vault event), so the default-controls snapshot sticks. Confirm by instrumenting the restart path: log at buildAndPublish the depth the build read vs what data.json holds, and the load-vs-first-build ordering.

REPRO: full FLOOR suite under load — npm run test:e2e:floor — reproduced ~1 in 4-8 runs. Does NOT reproduce on pinned in the runs observed. controlsRestart.e2e.ts is UNTOUCHED by nid_1s77g4wx33uj8b380d1oph1d6_e; this flake is pre-existing.

SCOPE NOTE: This is a restart/load-ordering race, NOT the refreshOpenViews in-place fan-out that nid_1s77g4wx33uj8b380d1oph1d6_e addressed. Fixing it likely means gating the first build on data.json load completion, or re-running the first build once load resolves.

## Acceptance Criteria

Root cause confirmed (first-build-before-data.json-load, or otherwise) with a failing-first test at that seam; fix lands so the toolbar/controls reflect persisted settings immediately after an Obsidian restart; e2e/controlsRestart.e2e.ts:136 stays green across repeated FULL floor suites.

