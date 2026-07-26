# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE (rehydration notes)

## Decision (settled 2026-07-26, hard evidence)

**The TEST is stale. Do NOT implement the breadcrumb.** This CONTRADICTS both exploration
agents, who only looked at current `src/` + the historical step-05 doc and concluded
"specified but never built". They missed the git history.

Smoking gun: commit `998fdac` "feat(node-real-estate): snug capped node width +
**remove folder prefix**" (2026-07-23) deliberately deleted the breadcrumb end-to-end:
- `NoteNode.tsx` — the `<span className="vicinity-graph-node__breadcrumb">` render
- `FlowNodeData.breadcrumbFolder` + threading in `flowMapping.ts` / `elkMapping.ts`
- `breadcrumbFolderOf()` in `graphIdentity.ts` **and its unit tests**
- the `.vicinity-graph-node__breadcrumb` CSS rule + reserved width
- **`docs-internal/plan/high-level-plan.md:59`** — the design source of truth, rewritten
  to the snug-capped-width model with no breadcrumb mention.

`grep breadcrumb docs-internal/plan/high-level-plan.md` → **0 hits today**. The only
docs still mentioning it are historical: `plan/steps/step-05-rich-rendering.md` (superseded
step spec) and old tickets. The `998fdac` PUBLIC file explicitly says historical docs were
left as record and "Only the authoritative `high-level-plan.md` Sizing section updated."

So: feature removed by design; `npm test` stayed green because the unit tests were removed
with it; the e2e file was simply missed (e2e is not part of `npm test`).

## Why the old ticket's "do not weaken the test" does not bind

`docs-internal/tickets/ticket-e2e-gamma-breadcrumb-fails-headless.md:41-42` says
"Do NOT weaken or delete the test — singleton-folder breadcrumb is covered behavior."
That was written under the mistaken belief the feature was live (its own "Leads" section
guesses at viewport culling and even notes `breadcrumbFolderOf` "moved during the node
width floored change" — it was **deleted**, not moved). The plan-doc evidence overrides it.

## Trimming half — already correct, no src change

`ObsidianLinkProvider.ts:301-318` `frontmatterTitleOf()` trims (`value.trim()`), and it is
already unit-covered: `ObsidianLinkProvider.test.ts:286` "WHEN the title has surrounding
whitespace THEN it is trimmed". So the trimming assertion is the genuinely valuable half of
the e2e test and must be KEPT.

## Plan

1. `e2e/vicinityGraph.e2e.ts:85-87` — the vacuous `toHaveCount(0)` on a class that exists
   nowhere. Replace with a vault-wide "no node renders a folder prefix" regression guard
   that names the removal commit/date, so it is honest rather than accidentally-passing.
2. `e2e/vicinityGraph.e2e.ts:160-165` — drop the `solo/` breadcrumb expectation and the
   `solo/` title prefix; keep the trimmed-frontmatter-title assertion.
3. `:144` section comment — drop "breadcrumb".
4. `ObsidianLinkProvider.ts:313` — stale "and breadcrumbs" in a WHY comment.
5. Close `ticket-e2e-gamma-breadcrumb-fails-headless.md` (same root cause, now known).
6. Run `npm test`, `npm run check`, `npm run build`, `npm run test:e2e` (the real gate).

**No unit tests added**: nothing in `src/` changes. Adding a unit test asserting a deleted
symbol's absence would be theatre. The e2e guard covers "the prefix stays gone".

## Env notes
- e2e is slow (~several min). Obsidian 1.12.7 cached at `.tmp/obsidian/obsidian-1.12.7/obsidian`.
- `npm run test:e2e` re-runs `setup:dev-vault` and wipes/recopies `.tmp/e2e/vault` each run.
- Redirect all verbose output to `.tmp/`.

---

## Iteration 1 (fresh instance, 2026-07-26) — rehydration notes

Rehydrated from: project `CLAUDE.md`, this file, `IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md`,
`IMPLEMENTATION_REVIEW__PUBLIC.md`, and `git diff f45082d..HEAD` (`60b6383`, `c2ea883`).
Did NOT read `IMPLEMENTATION_REVIEWER__PRIVATE.md` (other role's private file).

**State: DONE.** Commit `1635709` on `e2e-breadcrumb-red-gate`; working tree clean; all four
gates green. Full write-up in `IMPLEMENTATION_ITERATION__PUBLIC.md` — read that first.

Facts worth carrying forward if anyone picks this up again:

- The breadcrumb guard now lives at `e2e/vicinityGraph.e2e.ts:177`, in the **note1** section.
  Its placement is load-bearing, not cosmetic: it is only non-vacuous where an ungrouped
  non-root node (`solo/gamma.md`) is in the rendered vicinity. Moving it back into the alpha
  section silently disarms it. The JSDoc says so.
- Mutation-testing recipe (used to prove non-vacuity, ~1 min): add
  `breadcrumbFolderMUTATION?: string` to `FlowNodeData`, populate it in the `noteNodes` map of
  `flowMapping.ts` when `groupFolder === undefined && node.folder !== ""`, render it as
  `<span className="vicinity-graph-node__breadcrumb">` inside `.vicinity-graph-node__title` in
  `NoteNode.tsx`, then `npm run test:e2e -- vicinityGraph.e2e.ts`. Revert with `git checkout --`.
  Naive variants that prefix grouped nodes too will trip the alpha title assertion first and,
  because the file is serial, abort before reaching the guard.
- e2e is serial per file: an early failure strands everything after it. Always read the
  numbered `✓/✘/-` lines, not just the summary count.
- Two ticket systems coexist (`_tickets/` via the CLI vs `docs-internal/tickets/` per CLAUDE.md).
  Flagged in the PUBLIC file as a human call; not resolved here.
- No `change_log` entry written — TOP_LEVEL_AGENT owns that.
