---
closed_iso: 2026-08-10T19:22:36Z
id: nid_ghaeps3siekw0oe17mr4xpmad_e
title: 'Restart-time stale controls: toolbar depth stepper stuck at defaults after
  an Obsidian restart'
status: closed
deps: []
links: []
created_iso: '2026-08-07T18:08:51Z'
status_updated_iso: 2026-08-10T19:22:36Z
type: bug
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [view]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
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

---
## INVESTIGATION 2026-08-07 (CC_WITH-nickolaykondratyev) — HYPOTHESIS REFUTED, NOT REPRODUCED, REOPENED

**Outcome: could NOT complete the acceptance criteria.** The stated root-cause hypothesis
(first GraphViewController build reads spec defaults because it runs BEFORE main.ts onload
finishes awaiting data.json) is **disproven** on the floor build, and the flake did **not
reproduce** in this environment across extensive runs — so no failing-first test could be
written at the hypothesized seam. Documented here for the next agent; NO code fix landed
(landing a speculative fix for an unconfirmed/refuted cause would violate EARN_TRUST).

### What was verified

1. **Ordering is structural, not timing — Obsidian awaits the FULL plugin onload before it
   restores/builds ANY view.** `src/main.ts` onload does `await this.pluginDataStore.init()`
   (loads data.json) BEFORE `registerView` and `addCommand`. To test whether a view could
   still build before init resolved, I instrumented the whole restart path (onload start/done,
   init start/done, view.onOpen, VicinityGraphBuilder.build depth, onLayoutReady) AND inserted
   a deliberate **6-second stall inside `PluginDataStore.init()`** on the relaunch boot (fired
   only when data.json already held a non-default depth). Result on relaunch, in order:
   `onload:start` → `init:start` → `init:stalling 6s` → `init:stall-done` →
   `init:done depthIn=[2]` → `onload:done` → `view.onOpen` → `onLayoutReady depthIn=[2]` →
   (remount) `view.onOpen` → `build depthIn=[2]` ×2 → **test passed**.
   Even with init stalled 6s, the restored view's `onOpen` and every `build` happened strictly
   AFTER `init:done`, and every build read the persisted `depthIn=2` — never the default. So a
   build-before-load cannot occur on the floor build; the store is always loaded before any
   view is created. This is the SAME floor build (1.12.4) the CI downloads, so the refutation
   applies to CI too.

2. **Controls cannot diverge from the graph in a READY snapshot.** `GraphViewController.buildAndPublish`
   sets `this.controls = result.controls` from the SAME build result it publishes the graph
   from; the toolbar reads `snapshot.controls` directly (no independent state, `useOptimisticValue`
   mirrors the stored snapshot). For the ticket's exact symptom — a READY graph (HUB rendered)
   whose stepper shows the DEFAULT — a build must have completed, and every build reads the
   loaded store. That symptom is not producible by the current code path.

3. **Not reproduced.** ~57 isolated restart/remount cycles + 10 full-floor-suite runs during
   instrumentation, then 8/8 clean-tree full-floor-suite runs (159 passed each) after reverting
   all instrumentation — all green. `npm run check` and `npm test` green on the clean tree.

### Leading remaining candidates (for a environment that DOES reproduce)

- **Write-flush-on-close (data-loss, not stale-read):** if Obsidian is killed while a queued
  `saveData` is still flushing, a setting can revert. But depth is the 2nd of 4 writes in the
  test and is normally flushed well before relaunch; and this predicts data.json holding `1`,
  which CONTRADICTS the ticket's "data.json holds 2". Worth confirming by dumping data.json ON
  DISK at the moment line 179 fails.
- **Harness/timing artifact under heavy concurrent load** specific to the CI machine.

### Concrete next step for whoever reproduces

At the moment `e2e/controlsRestart.e2e.ts:179` fails, capture ALL of: (a) data.json ON DISK,
(b) the published `snapshot.controls.linkDepthIn` (add a temporary `page.evaluate`/DOM probe or
a build-time `console.log`), (c) `getLeavesOfType(VIEW_TYPE_VICINITY_GRAPH).length`. Those three
distinguish write-loss (a=1) from a stale build (a=2, b=1) from a second/stale view (leaf>1).
Instrumentation used here is in git history of this branch (all reverted); re-apply from the
`VG-DIAG` markers if useful.

---
## RESOLUTION 2026-08-10 (CC_WITH-nickolaykondratyev) — ROOT CAUSE FOUND IN OBSIDIAN'S OWN LOAD PATH, FIX LANDED

**Root cause (mechanism confirmed by reading the SHIPPED Obsidian bundles, both builds).**
The prior investigation correctly refuted the ordering hypothesis — a view can never build
before `main.ts` onload's `await pluginDataStore.init()`. The missed case is that the load
itself can SILENTLY fail: `Plugin.loadData` → `Vault.readPluginData` → `Vault.readJson`,
extracted from `.tmp/obsidian/obsidian-1.12.4/resources/obsidian.asar` (and 1.12.7 —
byte-identical logic), is:

```js
try { return JSON.parse(await this.adapter.read(path)); }
catch (e) { if (e.code === "ENOENT") return null;
            console.error("failed to read JSON", path, e); }
return undefined;   // <-- ANY non-ENOENT failure: transient fs error under load, torn read
```

So a transient `adapter.read` failure (e.g. resource exhaustion under full-suite load —
`adapter.read` is `queue(() => fsPromises.readFile(...))`, whose throw propagates) or a
parse failure yields **`undefined` with data.json left INTACT on disk**. Our
`PluginDataStore.init()` fed that straight to `PersistedShapes.parsePluginData`, which
treats it exactly like a first run → **defaults in memory, "2" on disk, ready graph,
stepper stuck at "1", and no later event to reload** — the ONLY mechanism consistent with
all three observed facts (disk=2, published controls=default, rendered graph), and one the
6s-stall instrumentation could not have caught (ordering was never the problem). It also
explains the flake's load-dependence and why floor-vs-pinned looked significant but isn't
(the code is identical; the floor runs were the loaded ones). Honest caveat: the exact
errno was not captured live (the flake never reproduced in this environment either — the
prior 8/8 + this session's 4/4 full floor suites are all green), so the confirmation is of
the MECHANISM in the shipped code, not a live capture. Obsidian logs
`failed to read JSON <path> <err>` at the moment it fires, which is the marker to look for
in any future capture.

**Why it was silent AND dangerous:** beyond the stale session, memory-on-defaults means the
NEXT settings write would persist defaults OVER the user's intact data.json (the store
merges over memory) — a real data-loss path, not just a display bug.

**Fix (failing-first at the seam, `src/persistence/PluginDataStore.test.ts`
"PluginDataStore.init read-failure resilience"):** `init()` now distinguishes Obsidian's
three answers. `null` (ENOENT — genuine first run) stays a definite answer, never retried;
`undefined` or a port rejection is a TRANSIENT read failure, retried up to
`INIT_LOAD_ATTEMPTS=3` total attempts with a 100ms injected-sleep pause; if every attempt
fails it falls back to defaults, `console.error`s, and tells the user ONCE via the injected
`UserNoticePort` (same optional-notice pattern as `VaultFileStore`), naming the consequence
and the way back ("restart Obsidian to load it again"). `main.ts` passes `this.notices`.

**Verification:** `npm run check` green; `npm test` 1830/1830 green (7 new seam tests);
`controlsRestart.e2e.ts` green on pinned; **4/4 consecutive FULL floor suites green**
(163 passed each, `OBSIDIAN_VERSION=1.12.4`). The e2e cannot deterministically inject a
transient fs read failure into a real Obsidian boot, so the seam is unit-covered
(scripted port) and the floor suite stands as the regression canary.

Commit: 06da6ce on branch CC_nid_ghaeps3siekw0oe17mr4xpmad_e__restart-time-stale-controls-toolbar-depth-stepper-_fable.

---
## REVIEW HARDENING 2026-08-10 (adversarial review pass)

The retry fix left one residual data-loss path open: a session whose init EXHAUSTED
all read attempts runs on defaults while the user's real data.json sits intact on
disk, and every `PluginDataStore` mutator persists the WHOLE in-memory object — so
the next settings/pin write would overwrite the user's file with defaults (the exact
danger the resolution above names). Closed: such a session now sets
`protectingUnreadDataJson` and `persist()` REFUSES (rejects before memory moves);
the rejection surfaces through the existing one failure policy (pipeline `guarded()`
/ `runGuarded`), so each refused write is reported to the user, and the init notice
now says changes won't be saved this session. `forgetDocs` is unaffected (defaults
hold an empty pinned set, so it early-returns). Covered by 4 new seam tests in
`PluginDataStore.test.ts` ("degraded-session write protection").
