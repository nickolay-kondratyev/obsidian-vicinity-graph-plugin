# RE-PLAN — Ticket 03: force placement quality (container-collide stranding)

Date: 2026-07-23. Supersedes `DETAILED_PLANNING__PUBLIC.md` (empirically invalidated —
see `IMPLEMENTATION__PUBLIC.md`). Root cause carried over unchanged: **circular
`forceCollide` uses the circumscribed-circle radius of folder-group containers**, so a
tall 192×392 container holds every external neighbour ≥ ~238px from its centre, at
uneven distances — the "Enchiridion" stranding.

## Chosen direction: rectangular (AABB) collision force — VALIDATED BY PROTOTYPE

Replace circular `forceCollide` in `src/view/d3ForceRefinement.ts` with a custom
deterministic rectangle-collision force, and make the link resting distance
rect-aware (min half-extents instead of circumscribed radii). A neighbour approaching
a tall container from the side then clears its **half-width (96px)**, not its
**diagonal (218px)**.

Options 2 (attract to member position) and 3 (squarer containers) are rejected:
both leave the circular collide floor in place — the investigation proved that floor
alone forbids any neighbour from sitting closer than the circumscribed radius,
regardless of link targets.

## Prototype evidence (sandbox run through the REAL elk-seed → d3 pipeline)

Prototype source: `PROTOTYPE__rect-collide.test.ts.txt` (this dir). It was run as a
temporary vitest file against the real `ElkLayoutRunner` seed + a modified refinement
(only `forceCollide` → `forceRectCollide`, link distance → min-half-extents; all other
forces/constants untouched). Raw logs: `.tmp/proto-run2.log` (variation A),
`.tmp/proto-run3.log` (variation B).

**New metric — boundary gap (px)** per projected root edge: rendered free space
between the two boxes' RECTANGLE boundaries along the centre-centre segment,
`dist(centers) − rectExtentAlongDir(s) − rectExtentAlongDir(t)`. Unlike the old
edge-stretch ratio it is NOT normalised by the circumscribed radius, so an inflated
container cannot hide the stranding — it genuinely detects the bug.

Variation A (padding 20, 2 collide iterations) — RECOMMENDED:

| Fixture (strandedHubGraph)     | Baseline (circular) | Prototype (AABB) |
|--------------------------------|---------------------|------------------|
| crowd=5 ench boundary gap      | **207**             | **33**           |
| crowd=5 ench→hub member dist   | 375                 | 193              |
| crowd=5 worst root-edge gap    | 207                 | 33 (all ≤ 33)    |
| crowd=10 ench boundary gap     | 203                 | 122              |
| crowd=16 ench boundary gap     | 231                 | 120              |
| root-box overlaps (all runs)   | 0                   | 0                |
| hub24 regression fixture overlaps | 0                | 0                |
| determinism (two runs)         | bit-identical       | bit-identical    |

- The crowd=5 fixture is the faithful mirror of the vault bug (hub with 5 crowd links
  + 1 degree-1 leaf). Gap 207 → 33 is RED→GREEN with huge margin at threshold 100.
- Variation B (2× padding, 3 iterations) was tried and is measurably WORSE at
  crowd ≥ 10 (worst gap 285/355 vs 221/322; ench→hub 500 vs 440) → keep padding 20,
  iterations 2.
- **Honest caveat:** at crowd ≥ 10 the prototype's *worst* gap exceeds baseline's
  (322 vs 252 at crowd=16). That is second-ring overflow — once the container's
  perimeter is full, extra leaves geometrically MUST sit a ring out. Baseline avoids
  it only by holding *every* neighbour uniformly far (uniformly bad). Mean gap still
  improves (~162 vs ~172 at crowd=16) and the bug-shaped edge (ench) always improves.
  The committed threshold test therefore targets the crowd=5 vault mirror; high-crowd
  numbers are diagnostics, not assertions.

## Implementation plan (failing-first)

1. **RED**: new colocated test (e.g. `src/view/d3ForceStranding.test.ts`):
   `strandedHubGraph(5)` fixture + boundary-gap metric (both lift verbatim from the
   prototype); assert every projected root edge's boundary gap ≤
   `D3_FORCE_MAX_BOUNDARY_GAP_PX` (new named constant, 100 — sits between prototype's
   33 and baseline's 207 with ~3× margin each way, WHY-documented). Verify it FAILS
   on current defaults (expected worst ≈ 207).
2. **`src/view/forceRectCollide.ts`** (new module + unit tests): deterministic
   pairwise AABB separation — anticipated positions (`x+vx`), padded half-extents,
   min-penetration axis, half/half velocity split, fixed iteration order,
   deterministic tie-break for exact coincidence (no randomness at all). d3-force
   `initialize(nodes)` contract. O(n²) per iteration with a WHY comment: root
   children ≤ a few hundred, ~300 static ticks ⇒ ≪ 10ms; quadtree is YAGNI.
3. **Rewire `refineForceRootLayout`**: drop `collideRadius` from `ForceBody`;
   `forceCollide` → `forceRectCollide(D3_FORCE_COLLIDE_PADDING_PX,
   D3_FORCE_COLLIDE_ITERATIONS)`; link distance →
   `minHalfExtent(s) + minHalfExtent(t) + D3_FORCE_LINK_GAP_PX` (WHY: collide owns
   separation; the spring only pulls partners into touching range — circumscribed
   resting distances were the stranding mechanism). Update the module doc comment +
   constants WHY comments (cite the prototype numbers).
4. **GREEN**: step-1 test passes; ALL existing tests stay green (`D3ForceLayout.test.ts`
   no-overlap/determinism, elk/edge-routing suites). `npm test` + `npm run check`.
5. **Dev-vault repro** (ticket note): add an Enchiridion-mirror note cluster to
   `.dev-vault/` (`p/ep/{hub,sib}.md`, `p/ep/book/enchiridion.md`, 5 crowd notes,
   a main note linking the hub) so the bug reproduces without `.out/vaults/public`.
6. **Visual acceptance**: `npm run setup:dev-vault`, open the repro note in Organic
   mode → leaf adjacent to its partner, no long crossing edge; cross-check
   `.out/vaults/public` `we-have-a-finite-amount-of-time.md` where available.
   Screenshots → `.out/`.
7. CHANGELOG entry; commit at milestones.

## Risks / deferred refinements (YAGNI until observed in visual QA)

- Scalar link distance cannot be direction-aware: a leaf approaching a tall container
  vertically has spring target (176px) below the collide floor (≈256px) — the spring
  presses, collide wins, zero overlaps observed in all prototype runs. If jitter or
  vertical crowding shows up in QA, the refinement is a custom rect-aware link force
  (per-tick directional resting distance) — do NOT build pre-emptively.
- Charge stays point-based (it only untangles; proven inert on resting geometry).
- Do not over-assert on high fan-out fixtures — second-ring overflow is geometry,
  not regression.
