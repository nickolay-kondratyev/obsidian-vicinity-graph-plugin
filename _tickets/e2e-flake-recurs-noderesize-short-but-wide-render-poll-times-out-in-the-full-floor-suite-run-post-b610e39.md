---
id: nid_8vekpgg97n5x7ckxbwswr5uar_e
title: "e2e flake recurs: nodeResize 'short but WIDE' render-poll times out in the FULL floor-suite run (post-b610e39)"
status: open
deps: []
links: [nid_g1f5tjmxzr0hbfdeujvgwywsd_e, nid_a5jbonflbm3110gsy6puf18ds_e]
created_iso: 2026-08-06T22:36:50Z
status_updated_iso: 2026-08-06T22:36:50Z
type: bug
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [e2e, flaky]
---

Observed 2026-08-06 while landing nid_a5jbonflbm3110gsy6puf18ds_e (the floor+pinned release matrix / ./release.sh).

This is a RECURRENCE of the flake closed in nid_g1f5tjmxzr0hbfdeujvgwywsd_e (`e2e/nodeResize.e2e.ts` render-poll reads the PREVIOUS test's box for 15s). That ticket concluded the underlying repaint defect was fixed by commit b610e39 (nid_c78k90su87jrzigxvfjv5t95g_e, "stop RF re-measurements clobbering a fresh publish") and verified two consecutive green full suites. The current tree INCLUDES b610e39, yet the flake still fires intermittently.

SYMPTOM (this occurrence): `npm run test:e2e:floor` (Obsidian 1.12.4, FULL suite, one worker) failed on `e2e/nodeResize.e2e.ts:433` — "WHEN a node is short but WIDE THEN its pin chip is the same size as a large node's". The legibility fix from the closed ticket did its job: the STORE poll passed (write landed), and the RENDER poll at `renderTargetAsNeighbourBox` (e2e/nodeResize.e2e.ts:366) timed out after 15s reading the immediately-preceding test's box:

    Expected {widthPx: 160, heightPx: 40}
    Received {widthPx: 40,  heightPx: 40}

(40x40 = the prior test's SHIPPED_MIN_NODE_PX box.) So it is a lost REPAINT, not a lost write — exactly the class b610e39 was meant to eliminate, now on the WIDE case instead of the drag-resize-floor case.

INTERMITTENT / NOT version-specific:
- `npm run test:e2e -- nodeResize.e2e.ts` on the FLOOR build: 15 passed (green in isolation).
- A later `./release.sh` full run: e2e floor 1.12.4 = 157 passed AND e2e pinned = 157 passed (flake did not fire). So the floor is functionally green; this is a residual full-suite ordering/timing flake, reproducible on the floor build under full-suite load, not a floor-specific plugin regression.

EVIDENCE: baseline floor log at .tmp/floor-baseline.log (1 failed / 153 passed), isolation rerun .tmp/floor-noderesize-rerun.log (15 passed), green matrix .tmp/release-run.log. (.tmp is gitignored — re-run to regenerate.)

WHAT TO DO: the b610e39 `isResizeGestureChange` filter reduced but did not eliminate the RF re-measure clobber under full-suite load. Consider whether `refreshOpenViews()` fan-out can still be swallowed by a ResizeObserver re-measure racing the reseed (see also open ticket _tickets/a-refreshopenviews-fan-out-can-be-swallowed-leaving-the-screen-stale-against-datajson-with-nothing-to-re-converge-it.md), or harden `renderTargetAsNeighbourBox` to force a remount / re-issue the fan-out if the rendered box has not converged within a short budget. Do NOT paper over it by widening the poll timeout.

## Acceptance Criteria

The full e2e suite (both pinned and floor builds via ./release.sh) is green across repeated runs; the nodeResize render-poll flake no longer recurs, OR renderTargetAsNeighbourBox is hardened so the repaint stall cannot leave the previous test's box on screen for the poll window.

