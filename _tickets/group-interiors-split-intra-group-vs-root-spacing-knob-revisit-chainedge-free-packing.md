---
closed_iso: 2026-07-30T07:52:04Z
id: nid_zvoay26y4y9h1e2p2b1y9glfk_e
tags: [settings, settings-cleanup]
title: "Group interiors: split intra-group vs root spacing knob, revisit chain/edge-free packing"
status: closed
deps: [nid_wimjq4ewgbg21n4zx9d4qq3a0_e]
links: []
created_iso: 2026-07-28T00:31:44Z
status_updated_iso: 2026-07-30T07:52:04Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
---

Overarching context and chain ordering for the settings cleanup: docs-internal/notes/settings.md (grouping tag: settings-cleanup).
Follow-up from the compact-group-layout work (see .ai_out/compact-group-layout/compact-group-layout/IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md).

Group interiors now use elk `rectpacking` (src/view/constants.ts `elkGroupMemberOptions`) instead of `layered`. Measured across 120 fixtures (2-20 members x 4 intra-group link shapes), box area is ~6% smaller on average, but the win is very uneven:

- hub/star-linked groups: ~45-60% LESS area (the big win, the common note-vault shape)
- sparse-linked groups: ~10% less area
- groups with NO intra-group edges: ~10-12% MORE area than `layered` (elk `layered` delegates unconnected members to its component packer, which was already decent)
- chain-linked groups: ~15-18% MORE area (`layered` rendered a chain as a narrow column, which is compact even if strip-shaped)

Two things to consider:
1. Whether a second spacing knob (intra-group `elk.spacing.nodeNode` separate from the root force seed) buys enough to justify the extra setting. Deliberately deferred as D3 in the CLARIFICATION.
2. Whether the edge-free / chain regressions are worth addressing (e.g. by keeping `layered` when the group has no intra-group edges) or whether the shape regularity is worth the area.

Baseline metric harness lives in the PUBLIC artifact; reproduce with a small elkjs script under .tmp/.

## UPDATE (iteration 2, compact-group-layout)

Point 1 is RESOLVED without a new setting: the two spacings were split in code, not in the UI. The "Group member spacing" knob now feeds ONLY the group interiors (default lowered 40 -> 20); the root force seed uses the internal `ELK_ROOT_SEED_NODE_SPACING_PX` in `src/view/constants.ts`. Measured cause: with the knob still wired to both, lowering it blew the `d3ForceStranding.test.ts` boundary-gap budget (113px vs 100px).

Point 2 is RESOLVED for the edge-free case at the shipped 20px spacing: rectpacking reproduces `layered`'s edge-free box exactly (602x483, fill 0.660 on the 13-member fixture). The chain case is still looser than `layered`'s narrow column — but that column is a strip, which is the shape this pass exists to avoid.

What REMAINS open here: `ELK_ROOT_SEED_NODE_SPACING_PX = 40` is frozen at the old shared default purely to keep the root pass byte-identical (CLARIFICATION D4 put the root pass out of scope). It has no derivation of its own — it deserves either one or a deliberate re-tune with the root d3 pass in scope.


## Notes

**2026-07-30T07:52:04Z**

## RESOLUTION (2026-07-30)

All three items are now closed out.

Points 1 (second spacing knob) and 2 (chain / edge-free packing regressions) were already resolved in the compact-group-layout pass — see the UPDATE section above.

The remaining item — `ELK_ROOT_SEED_NODE_SPACING_PX = 40` inherited with no derivation of its own — is DONE. The value is UNCHANGED (40) and every layout is byte-identical; what changed is that the number is now derived from measurement instead of inherited. Measured by sweeping the seed IN ISOLATION (interiors held at the shipped 20px) through the real `vicinityGraphToElk` -> `GraphLayoutRunner` pipeline over 9 root-topology fixtures, scored on the stranding suite's own boundary-gap metric:

- One real cliff, at 10: seeds 1..9 are all over the 100px budget (100-203px), seeds 10..18 all under (65-89px, every value measured).
- Flat above it: across 10..200 the fixture-median-normalised worst gap wobbles 0.77..1.13 with no trend.
- Not tunable: a +-4px nudge (36..44) moves the metric as much as or more than the whole range does. There is no optimum to find.
- No cliff at the top out to 1200px either, but no safety up there either (portrait reads 181px at seed 400).

So the only requirement is "comfortably above 10", and 40 has ~4x margin. Re-tuning inside a flat band would re-shuffle every existing layout to buy nothing measurable.

Also CORRECTED a wrong claim in the old comment: "taking it down to 20 blew the budget — 113px" was not a property of seed 20. Verified from git — `9454a1a` (`forceRectLink`, direction-aware link spring) records that landscape fixture going 113px -> 73px and does not touch `constants.ts`; the seed reads 40 on both sides of it. The 113px reading was the landscape fixture under the old direction-blind `forceLink`, WITH the seed at 40.

Files: `src/view/constants.ts` (derivation replaces the "inherited, not derived" paragraph; no longer cites this ticket as open), `src/view/elkMapping.test.ts` (value-lock comment; assertion unchanged). No new test — `d3ForceStranding.test.ts` already guards the cliff at the shipped seed and `elkMapping.test.ts` value-locks 40; a sweep test would duplicate that knowledge and is chaotic/slow.

`npm test` 1245 passed, `npm run check` exit 0. `test:e2e` not run (release gate).

Harness + raw TSVs + full analysis: `.ai_out/root-seed-spacing/nid_zvoay26y4y9h1e2p2b1y9glfk_e_2026-07-30T00-28-34PDT/`.

FOLLOW-UP FILED: `nid_nvk25n73l5hahwdx9o8rmoyl4_e` — the boundary-gap metric is degree-blind and the d3 root pass is chaotically sensitive, so future root-pass tuning needs distributions over many fixtures, not single readings.
