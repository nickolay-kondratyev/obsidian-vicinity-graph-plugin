# IMPLEMENTATION_TRIMS__PRIVATE — rehydration memory

## State at exit

- Branch `node-outline`, tree **clean**, one new commit `40a67de` on top of
  `6816f7c` (the PARETO analysis doc commit).
- Files changed: `src/adapters/ObsidianLinkProvider.ts`, `src/engine/constants.ts`,
  `src/engine/index.ts`, `src/view/graph-view.css`, `src/view/node-outline.css`.
  +78 / −58. No test file, no doc, no ticket, no CHANGELOG.
- All four approved trims applied. Nothing deferred, nothing blocked, no
  `#QUESTION_FOR_HUMAN`.

## Verification actually run (not inferred)

| Command | Result | Log |
|---|---|---|
| `npm run check` | exit 0 | `.tmp/check.txt` |
| `npm test` | 815 passed / 3 failed (pre-existing `collidePaddingPx`) | `.tmp/test.txt` |
| `npm run test:e2e` (full) | 36 passed / 2 failed / 7 did not run | `.tmp/e2e.txt` |
| `npm run test:e2e -- nodeOutline.e2e.ts` | 11 passed | `.tmp/e2e-outline-recheck.txt`, `.tmp/e2e-final.txt` |
| mutation: delete the 104px reveal | 1 failed (`toBeVisible`) on case 1 only | `.tmp/e2e-mutation.txt` |

The full e2e run happened before two cosmetic post-build edits (extracting
`references` and `firstHeadingOffset` locals), so `nodeOutline.e2e.ts` was re-run
on the **final** tree afterwards — that is what `.tmp/e2e-final.txt` is.

## Traps hit — worth remembering

- **`git checkout <file>` after a mutation restores from HEAD, not from the
  working tree.** Restoring `src/view/graph-view.css` that way silently reverted
  the R3 edit as well as the mutation. Caught by `git status` (the file showed
  unmodified) and re-applied. If a future instance mutates a file that already
  carries uncommitted work, snapshot it to `.tmp/` first — or commit before
  mutating.
- The dev-vault holds a build of whatever was on disk when `test:e2e` started;
  after a mutation run, re-run `setup:dev-vault` (or another e2e) before trusting
  a manual look at the app.

## Design decisions inside the dedupe (if it is ever revisited)

- The shared value is the **raw** `readonly OrderedReference[]`, not a resolved
  list. Resolving once and sharing that would also work and would be marginally
  cheaper, but it would resurrect the `offset`-carrying type R2 was approved to
  delete, and it would cost `referencesImageAbove` its early stop.
- `orderedReferencesOf` returns `null` (rather than `[]`) deliberately: `[]` is a
  legitimate answer for a cached markdown file with no links, and conflating the
  two would silently route such files to the `resolvedLinks` fallback.
- `outgoingPathsOf` takes `file`, not `path`, so its three branches read from one
  object; `getOutgoingLinks` now does the `getFileByPath` null check itself.

## If asked to do more here

Out of scope by explicit instruction: R4 (re-tune the nesting/entry budget after
real-vault use — belongs on `ticket-node-outline-heading-jump-smoke-run.md`) and
R5 (do not remove the five plumbing-echo tests; just do not replicate the pattern).

On the two `#QUESTION_FOR_HUMAN:` lines still printed in the PARETO doc: this
pass's task list (relayed by TOP_LEVEL_AGENT as human-approved) directs R3 to be
taken, and directs the image rule's reference-resolution to STAY — R2 removes only
the vestigial wrapper around it. I did not see the human's answers first-hand, so
treat the PARETO doc's questions as answered-by-the-task-list, not as answered
in writing anywhere in `.ai_out/`.
