---
id: nid_zvoay26y4y9h1e2p2b1y9glfk_e
tags: [settings, settings-cleanup]
title: "Group interiors: split intra-group vs root spacing knob, revisit chain/edge-free packing"
status: open
deps: [nid_wimjq4ewgbg21n4zx9d4qq3a0_e]
links: []
created_iso: 2026-07-28T00:31:44Z
status_updated_iso: 2026-07-28T00:31:44Z
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

