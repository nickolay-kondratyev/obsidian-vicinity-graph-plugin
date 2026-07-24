---
id: nid_apkpp62otiz0qhxlxoqhe5l1r_e
title: "force placement quality: linked nodes stranded far from neighbors (root-cause + fix defaults)"
status: open
deps: [nid_ihlfchb69wt1hqot6iqy7a9m9_e]
links: []
created_iso: 2026-07-23T23:34:17Z
status_updated_iso: 2026-07-23T23:34:17Z
type: bug
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [layout, force, quality]
---

Observed: with Organic (force) on note we-have-a-finite-amount-of-time.md in .out/vaults/public, node "The Enchiridion (The Manual)" is placed mid-graph, far from its link partners, producing long crossing edges (screenshot .tmp/Screenshot From 2026-07-23 17-22-17.png, 2026-07-23).

Pipeline: elk force seed (src/view/elkMapping.ts, ELK_FORCE_ROOT_OPTIONS at src/view/constants.ts:104) then static d3-force refinement (src/view/d3ForceRefinement.ts:57-78) with constants at src/view/constants.ts:117-140.

Hypothesized root causes (verify, then fix defaults — do NOT reach for user settings first):
1. Link strength is d3 default 1/min(degree(source),degree(target)) — forceLink.strength() is never set (src/view/d3ForceRefinement.ts:61-66). Around the active-note hub every link is weak (~0.1), so "linked boxes sit close" is unenforced exactly where it matters. Try constant strength ~0.7-1.
2. Static run from elk seed → local minimum: a centrally-seeded node is caged by neighbors collide circles; center pull (D3_FORCE_CENTER_PULL_STRENGTH=0.05) holds it there. Try slower alphaDecay (more ticks), or re-heat/restart passes; keep determinism (seeded LCG, src/view/d3ForceRefinement.ts:108).
3. elk force seed untuned: consider elk.force.model (FRUCHTERMAN_REINGOLD vs EADES), elk.force.iterations, elk.force.repulsivePower on ELK_FORCE_ROOT_OPTIONS.

Approach:
- Start with a failing/eval test: deterministic pipeline means we can fixture the vault graph and assert a quality metric (e.g. mean edge length in collide-radius units, or specifically: each node closer to centroid of its link partners than to unrelated nodes). Consider small eval harness like e2e/edgeRoutingEval.e2e.ts but unit-level over Fake fixtures.
- Tune constants + link strength until the Enchiridion-style stranding disappears on the public vault without collapsing hub packing (see WHY comments at src/view/constants.ts:111-133 — charge deliberately moderate, center pull must stay << link strength).
- Layout must stay deterministic (test-stability contract in d3ForceRefinement.ts doc comment).
- Document chosen values with WHY comments.

## Acceptance Criteria

- New quality test/eval fails on current defaults and passes after fix.
- Visual check on .out/vaults/public note we-have-a-finite-amount-of-time.md: The Enchiridion (The Manual) sits adjacent to its link partners; no long stranded edges.
- Layout deterministic; npm test + npm run check pass.


NOTE: `.out/vaults/public` is not under source control so bring in the required test data into the dev-vault to be able to reproduce this issues without the `.out/vaults/public` dependency.

---

## Investigation Findings (2026-07-23) — original hypotheses EMPIRICALLY INVALIDATED

A failing-first investigation (self-contained `makeGraph` `strandedHubGraph()` fixture
+ edge-stretch metric run through the REAL elk-seed → d3-force pipeline) disproved the
three hypotheses at the top of this ticket. **No production change was shipped** — a
constant tune cannot fix this. Full detail + reproduction harness:
`.ai_out/03-force-placement-quality/main/IMPLEMENTATION__PUBLIC.md` (and `EXPLORATION_*`,
`DETAILED_PLANNING__PUBLIC.md`, `DETAILED_PLAN_REVIEW__PUBLIC.md` in the same dir).

- **Hypothesis 1 (weak link strength) — WRONG for this node.** "The Enchiridion" is a
  **degree-1** leaf; d3's default link strength is `1/min(deg)=1`, i.e. already full
  strength. Pinning `forceLink.strength` is a no-op on every hub-and-spoke fixture.
- **Hypothesis 2 (charge / static local minimum) — has ZERO leverage.** Sweeping
  `D3_FORCE_CHARGE_STRENGTH` from −300 → −30 (10×) leaves the max edge-stretch
  **bit-identical to 3 decimals**. Charge cannot compress the resting distance that
  produces the long edge; overlaps stay 0 throughout.
- **Hypothesis 3 (elk force seed) — not the driver either.**

**Actual root cause — circular `forceCollide` on a high-aspect-ratio folder-group
container.** When the hub note lives inside a folder-group container, cross-boundary
edges are projected onto the *container* id (`elkMapping.ts` `projectedRootEdges`), and
`forceCollide` uses the container's **circumscribed-circle** radius
(`hypot(w,h)/2 + D3_FORCE_COLLIDE_PADDING_PX`). For a tall 192×392 container that is
~238px, so every external neighbor is forced ~238px + its own radius from the container
centre, at uneven distances:

```
grouped=true    ench->hub=375   crowdToHub=[332,261,414,417,288]   (far AND uneven)
grouped=false   ench->hub=247   crowdToHub=[245,244,241,242,243]   (near AND even ring)
```

This is a geometry property of the circular collision approximation, **independent of
`D3_FORCE_CHARGE_STRENGTH` and `forceLink.strength`**. Shrinking the collide radius below
the circumscribed circle reintroduces box overlaps (fails the existing
`overlappingPairCount == 0` regression), so no pure-constant lever fixes it. The chosen
edge-stretch metric also cannot *detect* it (numerator and denominator both scale with
the oversized container radius → stranded placement still scores ≈ 1); a new fix needs a
metric that measures the rendered/member-relative geometry.

### Candidate fix directions (for the re-plan to weigh)
1. **AABB / rectangular collision force** replacing circular `forceCollide` — a neighbor
   approaching a tall container from the side clears its half-width, not its diagonal.
   Durable root-cause fix; largest change; needs a custom deterministic d3 force + its own
   overlap/determinism tests. (Investigation's recommended durable option.)
2. **Attract cross-boundary edge to the member-note position** (not the container centre)
   in `elkMapping.ts` + `d3ForceRefinement.ts`. Lighter; **caveat:** the circular collide
   floor still applies, so this alone may only partially resolve.
3. **Squarer / capped container** (reduce container aspect ratio, or cap collide radius) —
   smallest change, likely partial; radius cap risks overlaps.

## Next Step — RE-PLAN this ticket with a stronger model

Re-plan the approach from the corrected root cause above (do NOT resurrect the invalidated
constant-tune plan). Use a stronger reasoning model for planning. Keep the deliverable
goals (deterministic layout, failing-first quality test that a fix moves red→green, repro
data mirrored into the dev-vault, `npm test` + `npm run check` green).

**Planning exit criteria — MUST include sandboxing / prototyping during planning:**
- Before the plan is accepted, build a **throwaway prototype** of the chosen direction and
  run it through the REAL elk+d3 pipeline on the reproduction fixture, demonstrating it
  actually moves the (new) quality metric red→green **without** breaking
  `overlappingPairCount == 0` or determinism. Attach the prototype evidence (numbers) to
  the plan.
- The plan must define a quality metric that can genuinely **detect** the container-collide
  stranding (the prior circumscribed-normalised edge-stretch metric could not).
- No approach is accepted on a-priori reasoning alone — this ticket already shows why that
  fails for a layout heuristic.