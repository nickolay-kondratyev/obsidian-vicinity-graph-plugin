# IMPLEMENTATION_REVIEWER — private memory (compact-group-layout)

Branch `compact-group-layout`, impl commit `4cd7366`. Reviewed 2026-07-27.

## Verification I actually ran (do not redo blindly on rehydrate)

- `npm test` -> exit 0. `npm run check` -> exit 0. Log:
  `/dev/shm/.../tasks/bc7mtbn50.output`, `.tmp/rev-check.log`.
- `.tmp/rev_elk.mjs` — direct elkjs 0.12.0 comparison, layered(DOWN) vs
  rectpacking(0.75, orderBySize), spacing 40, padding 16, heterogeneous members:

  | shape | n | layered | singleRow | fill | rectpacking | fill | relArea |
  |---|---|---|---|---|---|---|---|
  | none | 6/12/20 | 374x448 / 682x455 / 910x619 | false | .62/.66/.59 | 431x436 / 782x495 / 855x764 | .55/.53/.51 | 1.12 / 1.25 / 1.16 |
  | hub | 6/12/20 | 907x287 / 1954x358 / 3342x438 | TRUE | .40/.29/.23 | same as above | .55/.53/.51 | 0.72 / 0.55 / 0.45 |
  | chain | 6/12/20 | 217x747 / 228x1514 / 228x2542 | false | .67/.63/.62 | same | .55/.53/.51 | 1.16 / 1.12 / 1.13 |

  rectpacking with NO aspectRatio: 1076x336 (ratio 3.20) — elk's default 1.3 is a
  soft goal it overshoots badly.

- `.tmp/rev_ob.mjs` — `elk.rectpacking.orderBySize` IS honored in 0.12.0
  (592x715 -> 780x493). `elk.rectpacking.widthApproximation.orderBySize` and a
  deliberately bogus id both leave output unchanged, so the id in constants.ts is
  the real one, not a silently-ignored string.

- `.tmp/rev_land.mjs` — landscape group boxes REMAIN reachable at AR 0.75:
  two 250x40 members -> 282x152 (ratio 1.86); 2 members 250x40+80x80 -> 282x192.
  `MIN_GROUP_MEMBER_COUNT = 2` (folderGrouping.ts:25) so 1-member groups don't exist.

- Aspect-ratio sweep against the REAL stranding pipeline (detached worktree at
  /dev/shm/claude-1000/arsweep, since removed; probe copy of
  d3ForceStranding.test.ts writing via fs.appendFileSync because vitest is silent):

  | AR | group box | worst gap | worst edge |
  |---|---|---|---|
  | 0.5 – 0.95 | 192x412 | **61.5** | folder-group:p/ep -> crowd0.md |
  | 1.0 / 1.1 / 1.3 | 392x212 | **204.2** | main.md -> folder-group:p/ep |

  STEP function with a wide plateau. 0.75 is mid-plateau, NOT knife-edge tuned.

## Conclusions

(a) Implementer's correction to CLARIFICATION is CORRECT and honestly disclosed.
    Change still justified, but on SHAPE regularity + the hub case, not on mean area.
    Edge-free and chain groups get measurably LOOSER (my numbers worse than reported).
(b) 0.75 is NOT a hack. Real latent issue is `minHalfExtent()` in
    d3ForceRefinement.ts (direction-agnostic link resting distance) + no test
    covering a LANDSCAPE container. Pre-existing, now load-bearing on a soft hint.
(c) Tests are robust (no elk pixels hardcoded, derived from nodeDimensionsPx, BDD,
    1 assert each). Weakness: the two edge-free "locks" pass on baseline AND cannot
    detect the regression this change introduced (fill .66 -> .53). Determinism test
    duplicates ElkLayout.test.ts:40.

Scope clean: only constants.ts / elkMapping.ts / elkMapping.test.ts / groupPacking.test.ts
(+ architecture-map, 2 tickets). GROUP_SIDE_PADDING_PX and ELK_GROUP_PADDING untouched,
no settings, no root force/d3 change. ELK_DIRECTION fully deleted (only a prose mention
of `elk.direction` survives in docs-internal/research/research-layout-aesthetics.md:178).
No existing assertion weakened/skipped/deleted.

Verdict issued: READY, 0 blocking, 2 should-fix.

---

# Round 2 — iteration-2 commit `67c6c2f` (range `24294ec..HEAD`). Reviewed 2026-07-27.

## Verification I actually ran (do not redo blindly on rehydrate)

- `npm test` -> 0 (1151 passed + 1 expected fail), `npm run check` -> 0.
  Logs `.tmp/rev-test3.log`, `.tmp/rev-check3.log`.
- Throwaway probe `src/view/zzProbeReview.test.ts` (DELETED after; tree clean),
  driving vicinityGraphToElk + ElkLayoutRunner, appending to `.tmp/probe-review.txt`:

  | fixture | g | box | fill(test) | fill(real band) | sumArea/sum((w+g)(h+g)) |
  |---|---|---|---|---|---|
  | screenshot | 40 | 433x459 | .509 | .534 | **.579** |
  | screenshot | 20 | 413x419 | .591 | .623 | .746 |
  | screenshot | 15 | 408x409 | .614 | .649 | .799 |

  Every headline number in the plan reproduces EXACTLY. The 0.58 ceiling = .579.
  Member rects: 111x76, 114x114, 230x84, 250x83, 160x160 (sumArea 87,102; plan
  said 86,514 — 0.7% off, immaterial).
- `vicinityGraphToElk(graph with knob=90).layoutOptions` = `{"elk.algorithm":"force",
  "elk.spacing.nodeNode":"40"}` — root seed IGNORES a non-default knob. Byte-identical
  for DEFAULT users: verified. Non-default users: silent behaviour change.
- Reverted `graphFixtures.elkNodeSpacingPx` 20->40, ran groupPacking.test.ts:
  3 FAIL — 0.5087 vs 0.54 floor, 0.5154 vs 0.55 floor (x2). Floors are real.
  Restored with `git checkout`.
- `d3ForceStranding.test.ts` untouched in this range and DOES use graphFixtures,
  so it genuinely exercised interiors@20 with root@40.
- No test asserts root `elk.spacing.nodeNode` value anywhere (grep) — that is the
  blocking hole.
- Plugin unreleased: manifest 0.1.1, `git tag` empty => value-migration machinery
  not worth building.

## Conclusions

(a) HOLDS. Ceiling is a heuristic bound (charges gap on outer edges too), so true
    ceiling slightly >0.58, but skyline measurement brackets it. Packer rejection right.
(b) Split justified (SRP: label always said "group member"), but needs human sign-off;
    JSDoc para 1 ("not what a user sees") contradicts para 3 (budget blew).
(c) Real: `global-view` writes persist the whole slice, so engaged users pinned at 40.
    HUMAN'S OWN VAULT will show no change unless he restores defaults first — biggest
    practical risk of a 3rd rejection.
(d) 20 = first step-5 grid value >= 16 side padding. Sound. Plan's prose is backwards
    (says "never farther from mates than from wall"; 20>16 means it IS farther); the
    CODE comment is correct.
(e) No cardinal sin. it.fails pin intact. One vacuous-pass risk in elkMapping.test.ts:38.
    fillRatio denominator uses 2*16 though top padding is 36 (pre-existing).

Verdict issued: NEEDS_ITERATION, 1 blocking, 4 should-fix.
