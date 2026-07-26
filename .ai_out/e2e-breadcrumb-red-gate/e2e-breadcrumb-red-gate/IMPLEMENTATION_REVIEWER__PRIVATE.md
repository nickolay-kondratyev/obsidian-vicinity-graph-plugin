# IMPLEMENTATION_REVIEWER — PRIVATE (rehydration notes)

## State: VERIFICATION PASS COMPLETE (iteration 1, HEAD `712a73c`). 0 BLOCKING. **SHIP.**

Review 1 (`c2ea883`) raised 1 BLOCKING (B1) + S1–S4 + N1/N2. Iteration 1 accepted 6, rejected N2.
I re-verified everything below myself. Output: `IMPLEMENTATION_REVIEW_ITERATION__PUBLIC.md`.

## Settled — do NOT reopen

- "e2e test was stale; breadcrumb deliberately removed by `998fdac`" — adjudicated CORRECT in
  review 1 with independent evidence (commit subject/body, `_change_log/2026-07-23_22-16-50Z.md:17`,
  `998fdac`'s PUBLIC, and the affirmative deletion of the `high-level-plan.md:59` sentence).
- All review-1 "rejected concerns" (toHaveText not a loosening, trimming coverage intact,
  ObsidianLinkProvider comment-only, setup-dev-vault fixes honest). Still clean.

## B1 — FIXED. Evidence I verified myself

- `git diff b9fb631..HEAD -- src/` → **empty**. Byte-identical. Nothing re-added.
- Guard now `e2e/vicinityGraph.e2e.ts:177`, after `:143 openFile(NOTE1_PATH)`. Nothing between
  `:143` and `:177` re-navigates (`:148` = note1 thumbnail).
- gamma in vicinity: `:31-32` (11-node list), `:189` passed in my run, and
  `scripts/setup-dev-vault.sh:109` makes `solo/gamma.md` the folder's ONLY note → ungrouped +
  non-root = the surviving `!isGrouped && folder !== root` case.
- JSDoc `:156-176`: "vault-wide" claim GONE; every remaining claim checks out. No overstatement left.
- Mutation proof credible & **arithmetically self-consistent**: guard failed as spec #13 with
  `12 passed`; counting `test(` calls before `:177` gives exactly 12 (10 alpha + `:142` + `:148`),
  and the guard's old home was position #4 — inside that green block. Confirms both (a) bites and
  (b) old placement could not. Did not redo the experiment.

## N2 rejection — SOUND, accepted

`git show 998fdac^:src/view/NoteNode.tsx` lines 87-92: breadcrumb `<span>` nested INSIDE
`.vicinity-graph-node__title`. So `:188` catches a revival only via that nesting; a sibling-shaped
revival leaves `:188` green, only `:177` red. Converse also true (nested-but-unclassed revival →
only `:188` red). Genuinely complementary. Keep both.

## Gate re-run at HEAD — ALL GREEN, matches maker exactly

Logs `.tmp/rev-{npm-test,check,build,e2e}.log`.
- `npm test` exit 0, `Test Files 74 passed (74)` / `Tests 990 passed (990)`.
- `check-exit=0`, `build-exit=0`.
- e2e exit 0, `1 skipped / 78 passed (54.3s)`. `grep -c "did not run"` → **0**. No `✘`.
  Skip = env-gated `externalVault.e2e.ts:53`. Guard ✓ at `:177` (#72), gamma ✓ at `:188` (#73).
- `git status --porcelain` post-build → **empty** (no main.js/styles.css drift).

## New HACKs: none. Diff is one test move + JSDoc + 4 doc/ticket edits.

## Only new findings (both NICE-TO-HAVE, non-blocking)

- **V1**: S4 ticket `nid_c5acy7gm7lj3afz0vtq79k8bx_e` acceptance criteria would false-positive on
  `.vicinity-graph-node__breadcrumb` at `e2e/…:178` — a class asserted precisely because it must be
  absent. Ticket should exempt `toHaveCount(0)` absence guards.
- **V2**: no `_change_log/` entry on branch `f45082d..HEAD`. Repo precedent records it at branch
  close (`5b3eb91`) → likely a TOP_LEVEL merge-step item, not an iteration miss.

## Ticket-systems opinion given

CLI-file + cross-reference is the right interim (avoids rot from duplication); which of `_tickets/`
vs `docs-internal/tickets/` is authoritative needs a human ruling + a `CLAUDE.md` line. Not this branch.

## If resuming

Nothing open. I signalled readiness to ship. Do not re-run gates — verified at `712a73c`.
