---
closed_iso: 2026-07-25T04:36:37Z
id: nid_6lxaenl4oamjxqj6f0eh6rr4c_e
title: "e2e: remove layered/radial layout-mode references left by force-layout-only ticket"
status: closed
deps: []
links: []
created_iso: 2026-07-24T00:58:34Z
status_updated_iso: 2026-07-25T04:36:37Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [e2e, layout, cleanup]
---

The force-layout-only ticket (nid_ihlfchb69wt1hqot6iqy7a9m9_e, closed) removed the layered/radial layout modes from the plugin but did NOT update the e2e suite, which still drives the removed modes via a now-ineffective persisted `layoutMode` field.

Leftovers (behaviorally dead — write a `layoutMode` the engine no longer reads):
- e2e/obsidianHarness.ts: `setLayoutMode("layered"|"radial"|"force")` — collapse to force-only or remove.
- e2e/edgeRoutingEval.e2e.ts: `type LayoutMode = "force"|"layered"|"radial"`, the "layered layout routes the dense fixture" test, and the "radial layout SKIPS routing (gated)" test. Radial routing-gating no longer exists (routing is always on after the edge-routing setting removal), and layered/radial layouts are gone. Keep only the force-fixture screenshots + the PERF BUDGET test.

Context: the edge-routing setting removal (ticket 02, _tickets/02-remove-edge-routing-setting-obstacle-avoidance-always-on.md) already removed setEdgeRouting from the harness and rewrote e2e/edgeRouting.e2e.ts to force-only, always-on routing. This ticket is only the residual layout-mode cleanup.

Acceptance: `npx tsc -p e2e/tsconfig.json --noEmit` passes; no layered/radial references remain in e2e/; `npm run test:e2e` green.


## Notes

**2026-07-25T04:36:37Z**

Done as step 0 of edge-routing__06, commit b4a9d57. Removed the LayoutMode type, the layered test, the radial 'routing is gated off' test (its gate no longer exists, so it asserted nothing), the stale PERF BUDGET prose, and setLayoutMode from e2e/obsidianHarness.ts -- removal rather than collapse-to-force, since no caller remained. Only the three benign English-word hits are left in e2e/. Also, beyond this ticket's scope but required by edge-routing__06: maxDetourRatio/meanDetourRatio now print in the [eval] lines -- they were already logged by the plugin but dropped by the spec's PerfEntry type. Verified: tsc -p e2e clean, test:e2e green.
