---
closed_iso: 2026-07-24T03:57:07Z
id: nid_apkpp62otiz0qhxlxoqhe5l1r_e
title: "force placement quality: linked nodes stranded far from neighbors (root-cause + fix defaults)"
status: closed
deps: [nid_ihlfchb69wt1hqot6iqy7a9m9_e]
links: []
created_iso: 2026-07-23T23:34:17Z
status_updated_iso: 2026-07-24T03:57:07Z
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

## RE-PLAN (2026-07-23) — ACCEPTED: rectangular (AABB) collision force, prototype-validated

Full plan + evidence: `.ai_out/03-force-placement-quality/main/RE_PLAN__PUBLIC.md`
(prototype source preserved at `PROTOTYPE__rect-collide.test.ts.txt` in the same dir).
The planning exit criteria below were MET — a throwaway prototype ran through the REAL
`ElkLayoutRunner` seed → d3 refinement on the reproduction fixture.

**Direction chosen: candidate fix 1** (AABB collide replacing circular `forceCollide`,
plus rect-aware link resting distance = min half-extents + `D3_FORCE_LINK_GAP_PX`).
Candidates 2/3 rejected: both leave the circular collide floor in place, which alone
forbids neighbors from approaching closer than the circumscribed radius.

**New quality metric (detects the bug, unlike edge-stretch): boundary gap** — rendered
free space between the two boxes' RECTANGLE boundaries along the center-center segment:
`dist(centers) − rectExtentAlongDir(s) − rectExtentAlongDir(t)`, per projected root edge.
Not normalized by the circumscribed radius, so container inflation cannot mask stranding.

**Prototype evidence** (padding 20 / 2 collide iterations; `strandedHubGraph` fixture):

```
                          baseline(circle)   prototype(AABB)
crowd=5  ench gap                207                33        RED→GREEN at threshold 100
crowd=5  ench->hub member        375               193
crowd=10 ench gap                203               122
crowd=16 ench gap                231               120
overlaps (all fixtures + hub24)    0                 0
determinism (two runs)        bit-identical    bit-identical
```

Variation with 2× padding / 3 iterations was measurably WORSE at crowd≥10 — keep
padding 20, iterations 2. Honest caveat: at crowd≥16 the prototype's *worst* gap
(second-ring overflow, a geometric necessity once the container perimeter is full)
exceeds baseline's; the bug-shaped edge always improves. The committed test therefore
asserts on the crowd=5 vault mirror only.

### Implementation steps (failing-first)
1. RED — `src/view/d3ForceStranding.test.ts`: `strandedHubGraph(5)` + boundary-gap
   metric (lift from prototype); assert every root edge gap ≤
   `D3_FORCE_MAX_BOUNDARY_GAP_PX` (new constant, 100, WHY-documented: ~3× margin to
   both prototype 33 and baseline 207). Must FAIL on current defaults (~207).
2. New `src/view/forceRectCollide.ts` + unit tests: deterministic pairwise AABB
   separation (anticipated `x+vx` positions, padded half-extents, min-penetration
   axis, half/half split, fixed pair order, deterministic tie-break, NO randomness);
   O(n²) with WHY (root children small; quadtree YAGNI).
3. Rewire `refineForceRootLayout`: drop `collideRadius`; collide → rect force; link
   distance → `minHalf(s)+minHalf(t)+D3_FORCE_LINK_GAP_PX`. Update WHY comments with
   prototype numbers.
4. GREEN — step-1 test + all existing suites; `npm test` + `npm run check`.
5. Dev-vault repro data: mirror the Enchiridion cluster into `.dev-vault/`
   (`p/ep/{hub,sib}.md`, `p/ep/book/enchiridion.md`, 5 crowd notes + main) so repro
   needs no `.out/vaults/public`.
6. Visual acceptance on dev-vault repro note (+ public vault where available),
   screenshots → `.out/`; CHANGELOG entry; commit at milestones.

### Deferred (YAGNI unless visual QA shows it)
- Direction-aware link force (scalar spring presses against the rect collide floor on
  vertical approaches to tall containers; collide wins, zero overlaps in all runs).
- Charge stays point-based (proven inert on resting geometry).
## RESOLUTION (2026-07-23) — SHIPPED

Implemented per accepted re-plan (`.ai_out/03-force-placement-quality/main/RE_PLAN__PUBLIC.md`):

- `src/view/forceRectCollide.ts` — deterministic pairwise AABB separation force
  replaces circular `forceCollide`; link resting distance now min-half-extent based
  (`src/view/d3ForceRefinement.ts`, `src/view/constants.ts`).
- Failing-first proof: boundary-gap metric RED **206.52px** on baseline → GREEN
  **32.84px** (`src/view/d3ForceStranding.test.ts`, threshold
  `D3_FORCE_MAX_BOUNDARY_GAP_PX = 100`).
- `npm test` 703/703 + `npm run check` clean. E2e: 2 failures proven PRE-EXISTING via
  stash-baseline rerun (radial gating already ticketed; gamma breadcrumb →
  `docs-internal/tickets/ticket-e2e-gamma-breadcrumb-fails-headless.md`).
- Visual acceptance passed on real headless Obsidian
  (`.out/ticket-03-stranded-hub-after-fix.png`); Enchiridion-mirror repro cluster added
  to `.dev-vault/` via `scripts/setup-dev-vault.sh`.
- Review: APPROVED-WITH-MINORS (all incorporated). Pareto analysis: JUSTIFIED — net
  simplification of the production path.
- Remaining human step: public-vault visual smoke check (covered by existing
  `docs-internal/tickets/ticket-step-03-human-smoke-run.md`).
