# Plan Review — `neighborhood` → `vicinity` rename (script-driven)

Reviewer: PLAN_REVIEWER. Target: `DETAILED_PLANNING__PUBLIC.md` (branch `vicinity-rename`).
All claims below were validated against the live repo (read-only).

## Executive Summary
The plan is correct, complete, and safe. Every quantitative claim it makes was
independently reproduced against the repo (case counts, plural hits, the 12 renamed
files, id occurrences). The ordered-literal replacement design is sound and the
substring-safety argument (bare `neighbor` lacks `hood`, so it can never be touched) is
valid. Two minor gaps were found and fixed inline. **APPROVED WITH MINOR (inline) revisions
— PLAN_ITERATION can be SKIPPED.**

## Verification results (plan claim → actual)

| Plan claim | Verified? | Actual |
|---|---|---|
| `neighborhood` 317 / `Neighborhood` 167 / `NEIGHBORHOOD` 15 / British 0 | ✅ exact | 317 / 167 / 15 / 0 |
| 4 plural `neighborhoods` hits | ✅ exact | README.md:24, high-level-plan:10, step-02:52, step-07:21 |
| 12 files with `neighborhood` basename | ✅ exact | matches §4 list one-for-one |
| id `obsidian-neighborhood-graph` sites | ✅ | manifest/package/harness/manifest.test/DocDataStore.test/OrphanSweeper.test/README/CHANGELOG/RELEASE_CHECKLIST/step-01 |
| description holds `neighboring` (bare term, must be hand-removed) | ✅ | both manifest.json:6 + package.json:5 |

## Correctness of the rename rules — CONFIRMED

1. **Never touches bare `neighbor`/`neighbors`/`neighboring`/`neighbour(s)`** — CONFIRMED.
   The literal `neighborhood` is never a substring of the graph term (no `hood`), so
   literal find/replace cannot reach it. 40 bare-neighbor hits exist and are all safe.
2. **Plural `neighborhoods` → `vicinities`** — CONFIRMED. Rules 2/3 run before the singular
   rules 5/6, so `vicinitys` cannot occur. Verified there is **no upper-case `NEIGHBORHOODS`**
   and **no cap `Neighborhoods`** in the repo, so rule 4 (`NEIGHBORHOOD`→`VICINITY`) has no
   plural to mangle — the ordering is robust for every casing actually present.
3. **id → `vicinity-graph` (NOT `obsidian-vicinity-graph`)** — CONFIRMED. Rule 1 is a
   special-case literal applied first. I also confirmed there is **no `neighborhood-graph-plugin`
   slug** anywhere, so rule 1 cannot over-match a longer token into `vicinity-graph-plugin`.
4. **All casings incl. UPPER + kebab** — CONFIRMED. The 15 UPPER hits are all
   `VIEW_TYPE_NEIGHBORHOOD_GRAPH` (rule 4); kebab `neighborhood-graph[-view]`, CSS classes,
   and camelCase `neighborhoodGraph…` are all handled by rule 6; Pascal by rule 5.

## Completeness — CONFIRMED (nothing load-bearing missed)

- **`.idea/` project files** — NOT tracked (`git ls-files` empty for it) and its contents do
  not contain `neighborhood` (the `.iml` already carries the new repo dir name). Not a gap.
- **`versions.json`** — keyed only by the version string `0.1.0`; contains no `neighborhood`.
  Correctly left untouched.
- **Untracked / hidden files** — there are **no untracked files containing `neighborhood`**,
  so the `git ls-files`-based selection is complete; nothing escapes both the script and the
  acceptance grep.
- **Root `_tickets/`** — tracked, contains `neighborhood` (e.g. `.neighborhood-graph-pin-button`,
  `e2e/neighborhoodGraph.e2e.ts`). It is NOT excluded, so the mechanism covers it — but the
  plan's prose never named it. Fixed inline (§9 note added).
- **Hardcoded-id tests** — `manifest.test.ts` (expected value + assertion prose),
  `DocDataStore.test.ts`, `OrphanSweeper.test.ts`, `e2e/obsidianHarness.ts` all confirmed
  present and all fixed by Pass 1 rule 1/6.

## Idempotency / safety — CONFIRMED
- No target among the 12 renames collides with an existing file; no two sources map to one
  target. No `git mv` hazard.
- Content-first (Pass 1) then rename (Pass 2) is the correct order: imports point at the new
  basenames before the physical move, so the post-Pass-2 `tsc` is the single convergence gate.
- Re-runnability contract (write-only-on-change, skip `git mv` when source gone/target present)
  is sound. `git grep` in the acceptance checks reflects the working tree, so it sees Pass 1
  edits pre-commit.

## Acceptance criteria — sufficient & machine-checkable
The grep-zero check is correctly scoped (excludes `submodules/**`, `.ai_out/**`,
`package-lock.json`, `ask.dnc.md`) and matches the rename scope exactly, so it cannot pass
falsely on an out-of-scope leftover. Identity, description-phrase, `tsc`, and test-count gates
are all concrete. Description strings correctly keep **"local graph"** + **"nearby notes"** and
drop **"neighboring"** per CLARIFICATION.

## Minor Suggestions (both applied inline — no iteration needed)
1. **Test-count "~559" was unverifiable here** because `node_modules` is absent in this
   checkout (`npx vitest` bootstrap-failed on `vitest/config`). This is an env prerequisite,
   not a plan defect. Softened criterion #7 to: run `npm ci`, capture the ACTUAL pre-rename
   count, assert equality post-rename (rather than trusting the literal 559).
2. **Root `_tickets/` was unnamed** in the scope prose though the mechanism covers it. Added a
   completeness note to §9.

## Strengths
- Quantitative claims are accurate to the digit — the planner actually measured.
- The two genuine correctness traps (plural-first, id-special-first) are identified with the
  right fix and ordering.
- The substring-safety rationale is the crux of "don't touch graph vocabulary" and it is
  stated correctly, removing any need for fragile `\b` regex tricks.
- Clean separation of mechanical (Pass 1/2) vs. manual (description) work.

## Verdict
- [ ] APPROVED
- [x] APPROVED WITH MINOR REVISIONS (applied inline — PLAN_ITERATION SKIPPED)
- [ ] NEEDS REVISION
- [ ] REJECTED
