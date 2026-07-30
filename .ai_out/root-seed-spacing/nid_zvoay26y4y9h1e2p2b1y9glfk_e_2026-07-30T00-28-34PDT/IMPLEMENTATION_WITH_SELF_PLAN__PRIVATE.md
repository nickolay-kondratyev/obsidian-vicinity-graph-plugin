# PRIVATE — root seed spacing derivation (nid_zvoay26y4y9h1e2p2b1y9glfk_e)

## Task

Only remaining scope of the ticket: `ELK_ROOT_SEED_NODE_SPACING_PX = 40`
(`src/view/constants.ts`) had no derivation. Give it a measured one, or re-tune.
Root d3 pass in scope. Points 1 and 2 of the ticket were already resolved.

## Plan (executed)

1. Read `constants.ts`, `elkMapping.test.ts` (value lock), `d3ForceRefinement.ts`,
   `d3ForceStranding.test.ts` (100px boundary-gap budget), `groupPacking.test.ts`.
2. Build a `.tmp/` sweep harness over the REAL pipeline.
3. Sweep coarse / fine / low / high. Decide. Rewrite the doc comment.
4. `npm test` + `npm run check`.

## Harness — key insight (no source edit needed)

`vicinityGraphToElk(graph)` returns the root `ElkNode` whose `layoutOptions`
already carry `"elk.spacing.nodeNode"` from `elkForceRootOptions()`. So the seed
can be swept by shallow-overriding THAT ONE KEY before handing the root to
`new GraphLayoutRunner().layout(...)`. Group interiors are untouched (they read
`viewSettings.forceLayout.elkNodeSpacingPx`, fixture default 20px), so the sweep
isolates the seed. Earlier idea — patching the constant to read an env var —
was abandoned as unnecessary.

Files (kept in this artifact under `seed-sweep/`, transient copies were in
`.tmp/seed-sweep/`):

- `seed.sweep.ts` — 9 fixtures x N seeds, writes a TSV.
- `vitest.config.ts` — separate config; `root` MUST be absolute
  (`fileURLToPath(new URL("../..", import.meta.url))`) — a relative `"../.."`
  resolves against CWD and vitest then finds no test files (dead end, cost one run).

Reproduce:

```bash
mkdir -p .tmp/seed-sweep && cp <artifact>/seed-sweep/{seed.sweep.ts,vitest.config.ts} .tmp/seed-sweep/
npx vitest run --config .tmp/seed-sweep/vitest.config.ts                                  # coarse 5..200
SWEEP_SEEDS=36,37,38,39,40,41,42,43,44        SWEEP_OUT=.tmp/seed-sweep/results-fine.tsv  npx vitest run --config .tmp/seed-sweep/vitest.config.ts
SWEEP_SEEDS=1,2,3,4,5,6,7,8,9,10,11,12,13,14,16,18 SWEEP_OUT=.tmp/seed-sweep/results-low.tsv npx vitest run --config .tmp/seed-sweep/vitest.config.ts
SWEEP_SEEDS=200,300,400,600,800,1200          SWEEP_OUT=.tmp/seed-sweep/results-high.tsv  npx vitest run --config .tmp/seed-sweep/vitest.config.ts
```

Each run ~7s. Deterministic (elk + fixed-seed LCG), reruns reproduce exactly.

### Fixtures (9)

`stranding-portrait`, `stranding-landscape` (verbatim mirrors of the two shipped
`d3ForceStranding.test.ts` fixtures), `vault-{3f4m3l, 6f5m8l, 10f3m15l}`
(7 / 15 / 26 root boxes, heterogeneous sizes, some title-widened),
`ungrouped-star-{12,30}`, `cluster-chain-{6,12}`.

### Metrics (per fixture x seed, on the FINAL layout)

`worstGap` / `meanGap` / `stranded` = the suite's own projected-extent boundary
gap over projected ROOT edges (reuses `rectExtentAlong`, so it measures the
layout, not a second formula); `bboxArea`, `fill` = sum(box area)/bbox area,
`overlaps` (0 everywhere, all seeds — the rect collide always wins).

## Measurements

Raw TSVs in `seed-sweep/results-{coarse,fine,low,high}.tsv`.

### 1. Lower cliff — REAL, structural

`stranding-portrait` worstGap by seed (budget 100):

| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 16 | 18 |
|---|---|---|---|---|---|---|---|---|----|----|----|----|----|----|----|
|203|124|121|193|121|193|121|123|100.3|75.5|75.5|89.1|89.1|89.1|75.5|65.2|

Nine consecutive over-budget values then nine consecutive under-budget ones ⇒
threshold at 10, not noise. `stranding-landscape` is 73.4 flat across 1..18 —
the cliff is portrait-only (that container is the tall one).

### 2. Above the cliff — flat and CHAOTIC

Coarse 5..200 (40x range), aggregate over 9 fixtures, each normalised to its own
median worstGap: 0.944 / 1.135 / 1.072 / 1.073 / 0.967 / 0.854 / 0.804 / 0.945 /
0.958 / 0.965 / 0.955 / 1.062 / 0.872 / 0.773 / 0.821 / 0.828 / 0.929 — band
0.77..1.14, no trend. Total stranded edges across all fixtures: 43..55, no trend.

Fine sweep 36..44 (±4px) vs coarse 5..200, worstGap min..max:

| fixture | 36..44 | 5..200 |
|---|---|---|
| stranding-portrait | 61..62 | 56..121 |
| stranding-landscape | 73..73 | 56..97 |
| vault-3f | 83..174 | 59..203 |
| vault-6f | 207..228 | 208..582 |
| vault-10f (26 boxes) | **466..1032** | 455..789 |
| star-12 | 174..192 | 179..223 |
| star-30 | 354..591 | 385..628 |
| chain-6 | 343..343 | 61..657 |
| chain-12 | 388..532 | 70..454 |

On the largest fixture a ±4px nudge spans MORE than the entire 40x range ⇒ the
seed is a chaotic input to d3, not a tunable. No optimum exists to find.

### 3. Upper end — no cliff to 1200

`stranding-portrait` 65/65/181/70/96/89 at 200/300/400/600/800/1200 (the 181 at
400 is the same chaos, still under an ad-hoc reading of "broken"); mean root fill
drifts 0.469 → 0.452. Nothing to gain by going high.

## Decision

KEEP 40. Only requirement is "comfortably above 10"; 40 has ~4x margin and sits
in the flat band. Re-tuning inside a flat band buys nothing and re-shuffles every
existing layout. NO behavior change, no value change, no test-literal change.

### Correction found and recorded

The old comment claimed "taking it down to 20 blew the boundary-gap budget —
113px against 100px". That run moved the seed AND the group interiors together,
so it measured re-shaped containers. Isolated, seed=20 measures 89.1 (portrait) /
73.4 (landscape) — inside budget. The doc now says so explicitly. (The 113px
figure ALSO appears in `d3ForceStranding.test.ts` attributed to direction-blind
`forceLink` — a different cause; that file's version is the accurate one.)

### WHY no new test

The cliff is already guarded: `d3ForceStranding.test.ts` asserts the 100px budget
at the shipped seed, and `elkMapping.test.ts` value-locks 40. A seed-sweep test
would be slow and would duplicate that knowledge (DRY). Precedent in the same
file: `GROUP_PACKING_ASPECT_RATIO = 0.75` carries its measured curve in the
comment, not in a sweep test.

## Files touched

- `src/view/constants.ts` — replaced the "40 is inherited, not derived" +
  "WHY IT IS PINNED" paragraphs with the measured derivation + the correction.
  Comment only; the value is unchanged.
- `src/view/elkMapping.test.ts` — value-lock comment no longer says "the value the
  root pass has always seen"; points at the cliff + sweep. Assertion unchanged.

## Verification

`npm test` → 94 files / 1245 tests passed (`.tmp/npm-test.log`).
`npm run check` → exit 0 (`.tmp/npm-check.log`).
`npm run test:e2e` deliberately NOT run (release gate, out of scope).

## ROUND 1 REVIEW RESPONSE

### B1 (BLOCKING) — ACCEPTED, but verified independently, and I did NOT adopt the reviewer's wording

My claim "that run moved the seed AND the group INTERIORS together" was NOT backed.
I verified the alternative myself rather than taking the reviewer's word:

```
git log -1 9454a1a          # 2026-07-29, "direction-aware link spring (forceRectLink)"
                            # body: "113px boundary gap vs the 100px budget" ...
                            #       "Landscape fixture 113px -> 73px; portrait unchanged at 61px"
git merge-base --is-ancestor 0fb796f 9454a1a   # YES (compact-group-layout squash precedes it)
git show 9454a1a^:src/view/constants.ts | grep ELK_ROOT_SEED_NODE_SPACING_PX  # = 40
git show 9454a1a:src/view/constants.ts  | grep ELK_ROOT_SEED_NODE_SPACING_PX  # = 40
git show --stat 9454a1a     # does NOT touch constants.ts at all
git show 9454a1a^:src/view/d3ForceStranding.test.ts | grep -n "it.fails\|113"
                            # line 207: "113px against the 100px budget — and 130px with the previous"
                            # line 230: it.fails(... LANDSCAPE ... boundary-gap budget ...)
```

So the fully PROVABLE facts are: 113px was the LANDSCAPE fixture's reading under the
direction-blind `forceLink` spring, measured with the seed at 40 (the constant is
literally 40 on both sides of `9454a1a`, which never touches the file), and the
pre-fix test carried that assertion as `it.fails`. Therefore 113px was never a
property of a seed of 20 — which is the only thing the correction needs.

I deliberately did NOT write the reviewer's suggested clause "and was taken with the
knob still feeding BOTH passes": at `9454a1a^` the split had ALREADY landed (seed
pinned 40, interiors 20), so that clause is wrong for the reading actually preserved
in the test file. Substituting a second unbacked mechanism is the very failure B1 is
about. The comment now states only the git-verifiable chain.

### I1 (IMPORTANT) — ACCEPTED

The high-end bullet argued safety from `fill` alone while `results-high.tsv` shows
portrait at 181.3px (seed 400) and 96.3px (seed 800). Bullet now reads "no cliff at
the TOP either ... but no safety up there either: the chaos persists, and the portrait
fixture reads 181px at seed 400." This strengthens §3 rather than weakening the case.

### N1 — ACCEPTED, fixed by MEASURING rather than by softening the claim

Seed 17 had never been run (nine values below the cliff, only eight above). Ran
seeds 15 and 17: portrait 75.5 / 65.2, landscape 69.7 / 73.4. Seed 15 reproduces the
coarse file byte-for-byte (determinism cross-check). 10..18 is now fully sampled —
nine consecutive values each side, all 65.2..89.1 — so "nine each side" is exact as
written. New data: `seed-sweep/results-seed15-17.tsv`.

### N2 — ACCEPTED

"Across 5..200" included seed 5, which the preceding bullet classes as BELOW the
cliff. Recomputed the aggregate over coarse seeds >= 10 only (medians recomputed over
that subset): band 0.769..1.132, total stranded 43..55. Comment now says
"Across 10..200 (a 20x range) ... 0.77..1.13". The 26-box min..max (455..789) is
unchanged by dropping seed 5 (its value there is 538.1, interior to the range), so
that figure stands; its label changed from "across 5..200" to "across the sweep".

### N3 — ACCEPTED

Comment now points at `.ai_out/root-seed-spacing/` → the ticket artifact's
`seed-sweep` folder. NOTE — self-inflicted breakage worth remembering: my first
attempt wrote the path as a glob, `nid_..._*/seed-sweep/`, and the `*/` CLOSED the
block comment. `npm test` went to 11 failed files / `npm run check` exit 2 with
`TS1005`. Never put `*/` inside a block comment; the path is now spelled without a
glob.

### N4 — ACCEPTED

Re-wrapped the 135-char tail line in `elkMapping.test.ts` to the block's ~80 cols.

### Not revisited (reviewer explicitly agreed)

`d3ForceStranding.test.ts`'s own 113px untouched; no new test; harness in `.ai_out/`;
keep 40.

### Re-verified after the round

`npm test` → 94 files / 1245 passed, exit 0. `npm run check` → exit 0.

## Not done / open

- Ticket NOT closed, no commit, no change_log entry (orchestrator owns those).
- Follow-up candidates listed in PUBLIC.
