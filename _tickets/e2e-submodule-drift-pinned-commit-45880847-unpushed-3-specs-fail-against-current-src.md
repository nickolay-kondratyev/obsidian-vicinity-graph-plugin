---
id: nid_794aqyj6ks4gtlu1cc6po5cut_e
title: "e2e submodule drift: pinned commit 45880847 unpushed; 3 specs fail against current src"
status: open
deps: []
links: []
created_iso: 2026-08-13T20:19:13Z
status_updated_iso: 2026-08-13T20:19:13Z
type: bug
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [e2e, infra]
---

The e2e git submodule (at repo-root `e2e/`, its tests are the release gate) has TWO related problems, found 2026-08-13 while fixing ticket nid_ofacqul281sr71qrdacqy8jv3_e:

1. **The parent repo pinned submodule commit `45880847`, which was never pushed to the submodule remote** ("not our ref" on fetch). Work had to proceed from the submodule `origin/main` tip (527bd3a) instead — so whatever spec updates lived in 45880847 are lost to anyone cloning fresh. The unpushed-commit problem repeated in this environment: the ticket-fix branch `CC_nid_ofacqul281sr71qrdacqy8jv3_e__rename-at-time-eats-the-visualization-of-the-node_fable` was committed in the submodule (e9bdc4a) but `git push` was refused (no access rights from this env), so the parent again points at a commit only present locally. **Someone with push access must push that submodule branch.**

2. **Three e2e specs fail deterministically against current `src` even with a fully pristine checkout** (verified by stashing ALL local changes; failures are identical with and without the ticket fix, so they are pre-existing drift, likely fixed in the lost 45880847):
   - `e2e/controlsRestart.e2e.ts:155` "depth, pin, node cap and sizing all survive an Obsidian restart" — the "Links in" stepper stays "1" after a bump, expected "2".
   - `e2e/pinnedCentralScenario.e2e.ts:129` "the MAIN central itself can be pinned..." — after the unpin click `sc_hub.md` keeps `data-tier="pinned-central"`, expected "regular".
   - `e2e/vicinityGraph.e2e.ts:216` "every edge carries a self-drawn arrowhead" — `.react-flow__edge-path` count 2, expected ALPHA_EDGE_COUNT=3.
   A plausible common cause: src grew the frontmatter-links feature/settings section that the submodule tip predates (the compile-level half of that drift — `e2e/settingsBaseline.ts` missing the "frontmatter-links" scope and `e2e/settingsBaseline.test.ts` missing "Restore frontmatter links defaults" — was already patched in submodule commit e9bdc4a). The three behavioral failures still need triage: either recover 45880847, or update the three specs to match current-src behavior.

Repro: `npm run test:e2e -- controlsRestart.e2e.ts pinnedCentralScenario.e2e.ts vicinityGraph.e2e.ts` (logs from the finding session: `.tmp/e2e-triage.log`, `.tmp/e2e-prefix-check.log`).

