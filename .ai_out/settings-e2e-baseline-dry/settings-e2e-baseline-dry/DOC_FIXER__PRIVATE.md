# DOC_FIXER — private working notes

## State: DONE

All 3 findings applied, `npm run check` green (exit 0), single doc commit made.
Nothing left in flight. If rehydrated: verify the commit exists, then stop.

## Rehydration facts

- No prior `DOC_FIXER__PRIVATE.md` existed — this was a cold start.
- Branch `settings-e2e-baseline-dry`. OUT DIR
  `.ai_out/settings-e2e-baseline-dry/settings-e2e-baseline-dry/`.
- Ground truth read at start (do not re-derive):
  - `package.json`: `"check": "tsc -noEmit && npm run check:e2e"`,
    `"check:e2e": "tsc -noEmit -p e2e/tsconfig.json"`, `"build": "npm run check && ..."`.
  - `scripts/run-e2e.sh` L39-41 already carries the WHY-NOT for the deleted tsc line;
    that block was intentionally left as-is.

## Judgement calls worth remembering

1. **README `build` row also drifted**, beyond the literal `README.md:215` the finding
   named — it said `tsc -noEmit` type check. Rewrote it as `npm run check` so the two
   rows cannot drift apart again (single source of truth in the table).
2. **Added `check:e2e` as its own row.** The finding made this conditional on the table
   listing scripts individually — it does, so the row was warranted.
3. **Docker note**: it is a historical setup recipe, so the temptation was to leave it.
   Took the fix anyway because it is a *wrong* recipe for this repo now, and added the
   WHY-NOT comment inside the quoted snippet so the note stays self-consistent with the
   real script if someone diffs them.
4. **run-e2e.sh header**: the review suggested it "could just say builds". Went slightly
   further — "builds (which type-checks src + e2e)" — because dropping the type-check
   mention entirely would lose the reason a spec type error fails an e2e run. Comment
   lines only; zero executable change, confirmed with `bash -n`.

## Explicitly NOT done (per instructions)

- No `CLAUDE.md` edit (Commands block already correct — spot-checked, it is).
- No change_log entry — TOP_LEVEL_AGENT owns it.
- No code/test edits. `git diff --stat` on the doc commit covers exactly 3 files
  (+ the 2 OUT DIR files).

## Risk notes for whoever reads next

- R2-4 (production bundle now fails on e2e-only type errors) is a real new coupling and
  is documented nowhere user-facing. The review called it a chosen property, so I did
  not editorialize — but if it ever bites, README's `build` row is the place to note it.
