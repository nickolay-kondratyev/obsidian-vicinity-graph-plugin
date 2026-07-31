---
closed_iso: 2026-07-31T17:49:03Z
id: nid_nvk25n73l5hahwdx9o8rmoyl4_e
title: "Stranding boundary-gap metric is degree-blind and the d3 root pass is chaotically\
  \ sensitive \u2014 treat single readings as unsound"
status: closed
deps: []
links: []
created_iso: '2026-07-30T07:51:46Z'
status_updated_iso: 2026-07-31T17:49:02Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [layout, metrics]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2
---
Surfaced while deriving `ELK_ROOT_SEED_NODE_SPACING_PX` (ticket nid_zvoay26y4y9h1e2p2b1y9glfk_e, now closed). Two properties of the root-layout measurement apparatus that make single-number readings untrustworthy for FUTURE tuning. Nothing is broken today; this is about not drawing wrong conclusions next time.

1. **The boundary-gap metric is degree-blind.** The metric used by `src/view/d3ForceStranding.test.ts` (worst gap between a node and its linked neighbour boundary) reports 22-24 "stranded" edges on high-degree star fixtures at EVERY seed spacing — a hub physically cannot seat all its neighbours within the budget, so the count says nothing about layout quality there. It is only trustworthy as a regression signal on the two fixed fixtures the suite pins. Anyone reading it as a general quality score will be misled.

2. **The d3 refinement is chaotically sensitive to its input arrangement.** Measured over the elk seed sweep: a +-4px nudge to the root seed spacing (36..44) moves the worst-gap metric as much as or MORE than the entire 5..200 range does (466..1032px within 36..44 vs 455..789px across 5..200, on the 26-box vault-mirror fixture). Consequence: any future tuning of the root pass MUST be judged on a DISTRIBUTION over many fixtures, never on single readings, or it will be fitting noise.

**Suggested work** (pick per value): document both properties where the metric is defined (`src/view/d3ForceStranding.test.ts`, and/or wherever the gap helper lives) so the next reader is not misled; and/or promote the sweep harness into a reusable multi-fixture distribution rig if a root-pass re-tune is ever actually undertaken.

**Evidence / reproduce**: harness, raw TSVs and full analysis are committed under `.ai_out/root-seed-spacing/nid_zvoay26y4y9h1e2p2b1y9glfk_e_2026-07-30T00-28-34PDT/` (`seed-sweep/seed.sweep.ts` + `results-*.tsv`, and `IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md`).

**Do NOT** re-tune `ELK_ROOT_SEED_NODE_SPACING_PX` on the strength of this — it was just derived as measured-flat above a cliff at seed 10, and 40 sits with ~4x margin.

## Notes

**2026-07-31T17:49:02Z**

RESOLVED (2026-07-31): Documented both measurement-apparatus caveats at the metric definition, per the ticket's "pick per value" guidance — the doc pointer is the 80/20; the multi-fixture distribution rig is deliberately NOT built (only worth building if a root-pass re-tune is actually undertaken; the harness to promote is referenced from the new doc).

What changed: added a doc block on worstBoundaryGapPx() in src/view/d3ForceStranding.test.ts (where the metric and its gap helper both live) stating (1) the metric is degree-blind — a regression signal on the suite's two pinned fixtures only, never a general quality score (22-24 "stranded" edges at EVERY seed spacing on high-degree stars), and (2) the d3 refinement is chaotically seed-sensitive (+-4px nudge moves the metric as much as the whole 5..200 sweep), so future tuning must be judged on distributions over many fixtures. The block points at the committed evidence/harness under .ai_out/root-seed-spacing/nid_zvoay26y4y9h1e2p2b1y9glfk_e_2026-07-30T00-28-34PDT/ and cross-references the ELK_ROOT_SEED_NODE_SPACING_PX doc in src/view/constants.ts, which already carried the chaos finding (verified — no duplication added there).

Verified: npx vitest run src/view/d3ForceStranding.test.ts (4 passed) and npm run check both green. No behavior change; comment-only.
