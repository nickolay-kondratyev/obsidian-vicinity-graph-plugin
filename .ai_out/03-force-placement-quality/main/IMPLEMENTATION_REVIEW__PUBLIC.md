# IMPLEMENTATION REVIEW — Ticket 03 (AABB rect-collide force, commit 507a27a)

Reviewer: IMPLEMENTATION_REVIEWER. Date: 2026-07-23. Scope: commit
`507a27a` ("feat(ticket-03): AABB rect-collide force fixes stranded linked nodes")
reviewed against `_tickets/03-force-placement-quality-...md`, `RE_PLAN__PUBLIC.md`
(plan of record), `IMPLEMENTATION__PUBLIC.md`, and repo CLAUDE.md standards.

## Verification performed (independently, this session)

| Check | Result |
|---|---|
| `npm test` (`.tmp/review-test.log`) | **703/703 pass**, 58 files, exit 0 |
| `npm run check` (`.tmp/review-check.log`) | exit 0 (strict tsc clean) |
| **Independent RED reproduction** | In a scratch git worktree at HEAD, reverted ONLY `src/view/d3ForceRefinement.ts` to HEAD~1 (circular collide) while keeping the committed test → `d3ForceStranding.test.ts` FAILS with `expected 206.5235742967829 to be less than or equal to 100` — byte-identical to the claimed RED value. The RED evidence is real, not reconstructed. Worktree removed after. |
| E2e triage logs inspected | `.tmp/impl2-e2e.log`: 21 pass / 2 fail (radial-gating `edgeRoutingEval.e2e.ts:171`, gamma breadcrumb `vicinityGraph.e2e.ts:160`). `.tmp/impl2-e2e-baseline.log` (change stashed): **identical two failures**. `.tmp/impl2-e2e-baseline-nofixture.log` (fixture notes also deleted): gamma failure persists. `.tmp/impl2-e2e-rest.log`: remaining **24 pass** with the change. Triage claim "both failures pre-existing" is credible and log-backed. |
| Visual acceptance | Viewed `.out/ticket-03-stranded-hub-after-fix.png`: `enchiridion` sits directly adjacent to the `ep` group box, crowd notes ring the group — the ticket symptom is visibly gone on the dev-vault mirror. |
| Behavior-test preservation | `src/view/D3ForceLayout.test.ts` (no-overlap, determinism, grouped-container tests) untouched since e68a86a; no test deleted or weakened anywhere in the commit. No anchor (`ap_XXX_E`) removals. |
| Determinism | No `Math.random`/`Date.now` in force code; fixed pair order + positive tie-break in `forceRectCollide.ts`; seeded LCG unchanged in `d3ForceRefinement.ts`. |
| Layering | Change confined to `src/view/` + script/docs. No engine/shared contamination; import-guard suite green. |
| Sanity script | No `sanity_check.sh` in repo — n/a. |

## Plan conformance (RE_PLAN steps 1–7)

1. RED stranding test — DONE, independently re-verified (above).
2. `forceRectCollide.ts` + unit tests — DONE (7 BDD tests: min-axis both ways, padding-as-separation, no-op when separated, deterministic tie-break, anticipated positions, multi-pass idempotence). Matches plan mechanics (anticipated `x+vx`, min-penetration axis, half/half split, `initialize` contract, O(n²) WHY comment).
3. Rewire `refineForceRootLayout` — DONE (`collideRadius` fully removed, link distance = min half-extents + gap, WHY comments cite prototype 207→33 / 375→193).
4. GREEN + full suites — DONE, re-verified.
5. Dev-vault repro cluster — DONE (`scripts/setup-dev-vault.sh`, self-contained, smoke-check text updated).
6. Visual acceptance — dev-vault DONE with screenshot; **public-vault cross-check honestly declared NOT done** (see Minor 3).
7. CHANGELOG + commit — DONE.

## 🚨 CRITICAL Issues

None.

## ⚠️ IMPORTANT Issues

None. Correctness hunting on `forceRectCollide.ts` came up clean: `?? 0`
guards cover undefined coords (NaN would no-op the pair, not crash); zero-size
bodies still get padding separation; per-pass anticipated positions make
multi-iteration relaxation converge (proven by the idempotence unit test);
fixed iteration order keeps intra-tick order-dependence deterministic; the
spring target (min-half-extents + 40) sits above the collide floor
(half-extents + 20) for square pairs, so no permanent spring/collide fight in
the common case, and the tall-container vertical case is documented as a
deferred refinement in the plan.

## 💡 Suggestions (MINOR — mention, not demand)

1. **Padding doc comments overstate the gap** — `src/view/forceRectCollide.ts:25-26`
   ("Half-extents are inflated by `paddingPx`") and the
   `D3_FORCE_COLLIDE_PADDING_PX` comment in `src/view/constants.ts` ("Padding
   added to each box's half-extents") both read as per-box inflation, implying a
   2×padding (40px) inter-box gap. The code applies padding **once per pair**
   (`a.halfWidth + b.halfWidth + paddingPx`), i.e. a 20px enforced gap — which
   the unit test at `src/view/forceRectCollide.test.ts:54` correctly pins.
   Behavior is fine and prototype-validated; the comments should say
   "per pair" so a maintainer's prediction matches reality (EXPLICIT/POLS).
2. **Test-helper duplication (DRY, test-level)** — `overlappingPairCount`
   (`src/view/D3ForceLayout.test.ts:54`) vs `overlappingRootPairCount`
   (`src/view/d3ForceStranding.test.ts:143`) are the same AABB-overlap count;
   `HUB_SIZE_PX`/`NEIGHBOR_SIZE_PX` constants are also re-declared. A shared
   helper in `src/view/testFixtures/` would DRY this if a third layout-quality
   suite ever appears; two occurrences is tolerable today.
3. **Ticket AC 2 partially deferred** — the ticket's visual-check AC names
   `.out/vaults/public` `we-have-a-finite-amount-of-time.md`; the implementation
   substituted the dev-vault mirror (which the ticket itself requested be
   created) + real-Obsidian screenshot, and deferred the public-vault check to
   the human smoke run because the e2e harness is hard-wired to `.dev-vault`.
   This is honestly declared in `IMPLEMENTATION__PUBLIC.md`, and the mirror
   reproduces the exact topology — but it is a declared deviation from the
   literal AC text.
   `#QUESTION_FOR_HUMAN:` Does the dev-vault mirror + metric test satisfy the
   public-vault visual AC, or should the human smoke run
   (`docs-internal/tickets/ticket-step-03-human-smoke-run.md`) on
   `we-have-a-finite-amount-of-time.md` gate closing ticket 03?

## Documentation Updates Needed

Only Minor 1 (two comment wording fixes). CHANGELOG, constants WHY comments,
module docs, and the new follow-up ticket
(`docs-internal/tickets/ticket-e2e-gamma-breadcrumb-fails-headless.md`, which
correctly forbids weakening the breadcrumb test) are otherwise accurate and
prototype-cited.

## VERDICT: APPROVED-WITH-MINORS

The fix is real (root cause addressed, not tuned around), failing-first
evidence is genuine and independently reproduced, determinism and layering are
preserved, no behavior tests were weakened, and the e2e reds are proven
pre-existing. The three minors are non-blocking; Minor 3 carries the only
human question.
