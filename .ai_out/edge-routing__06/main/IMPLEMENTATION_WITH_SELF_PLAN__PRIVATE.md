# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE (edge-routing__06 step 0)

## Plan (checklist)

**Goal**: e2e-only. Purge stale layered/radial layout-mode refs from `e2e/`, and print
`maxDetourRatio`/`meanDetourRatio` in the `[eval]` lines so the shapeBufferDistance sweep has a baseline.

**Steps**
1. [ ] `e2e/edgeRoutingEval.e2e.ts`: drop `LayoutMode` type + `renderFixture` mode param + `harness.setLayoutMode` call.
2. [ ] Delete the layered test and the radial "gated off" test (+ their screenshots).
3. [ ] Rewrite the stale PERF BUDGET comment prose; KEEP the three assertions verbatim.
4. [ ] Extend `PerfEntry["data"]` with the two detour ratios; thread through `lastDurations`; print them.
5. [ ] `e2e/obsidianHarness.ts`: delete `setLayoutMode` entirely (no caller left).
6. [ ] Verify: tsc, grep, `npm run test:e2e -- edgeRoutingEval.e2e.ts`, `npm test`.

**Do NOT**: touch `src/`, weaken PERF BUDGET asserts, touch the benign English "layered"/"radial"
word uses (`e2e/edgeRouting.e2e.ts:22`, `e2e/obsidianHarness.ts:85,:127`), or git commit.

## Status: (in progress — updated at end of run)
