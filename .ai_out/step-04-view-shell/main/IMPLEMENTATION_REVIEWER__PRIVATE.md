# IMPLEMENTATION_REVIEWER__PRIVATE — step-04-view-shell (main)

First run. Reviewed commit c920e7d against spec + CLARIFICATION.

## What I checked (rehydration notes)
- Read all new src/view/* modules, main.ts, esbuild.config.mjs, .gitignore, package.json, graph-view.css, FileKinds.
- Ran gates myself: vitest 325 passed / 35 files (exit 0); `npm run check` (tsc -noEmit) exit 0; `npm run build` production exit 0. Logs in .tmp/review-*.log.
- Confirmed bundle: main.js 1.84MB, contains @xyflow/elkjs/createRoot; react/react-dom NOT external (correctly bundled). styles.css generated (19KB, 138 xyflow rules) and NOT git-tracked (git ls-files empty) — the commit already did `styles.css | 5 -`. So the implementer's "please git rm --cached" callout was RESOLVED by TOP_LEVEL.

## Key verifications
- Multiple views: each view builds its OWN controller + ElkLayoutRunner in onOpen. All rebuild state (mainPath/positions/snapshot/rebuildToken) is per-instance. graphBuilder shared but effectively stateless-per-build. NO cross-contamination. CONFIRMED.
- Latest-wins: `++rebuildToken`, isStale checked after BOTH awaits (build line 115, layout line 131). No sleeps. Reuse-layout branch has no await before publish → safe. Race-free.
- Size boundary: growthRatio > threshold; at exactly +100% ratio=1.0 not > 1.0 → reuse. Tested (100→reuse, 101→relayout). `>` is correct for "beyond". Divide-by-zero guarded (prev<=0 → false).
- MAIN gating via FileKinds.isNodeBearingPath (md/canvas). Tested. png ignored.
- elk options layered + INCLUDE_CHILDREN + spacing, compound-ready. Real elkjs headless test (siblings don't overlap, deterministic). No RF mounted in tests. Good.
- getState/setState just call super (thin, documented anchor for step-06).

## Findings (see PUBLIC)
- Strongest: GraphViewController (latest-wins + reset/publish sequencing) is fully node-testable (obsidian imports are all `import type`) yet has ZERO tests. The flagged key risk (CLARIFICATION Q2). SHOULD-FIX (follow-up test), not blocking — pure decision modules all covered, gates green, logic verified correct by reading.
- NICE: handleActiveFileChanged doesn't clearDebounce → one redundant (harmless, diff→reuse) rebuild if a resolve debounce was pending. console.debug always-on (satisfies exit criterion though). openNode uses getLeaf(false) — fine because Obsidian getLeaf targets main-area, not sidebar; flag for smoke.

## Verdict: READY (2 SHOULD-FIX-ish, all non-blocking; gates green).
