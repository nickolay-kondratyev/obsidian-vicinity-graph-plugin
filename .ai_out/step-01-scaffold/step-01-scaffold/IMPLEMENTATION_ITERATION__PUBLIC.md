# IMPLEMENTATION_ITERATION — step-01-scaffold — PUBLIC

Iteration over IMPLEMENTATION_REVIEW findings (VERDICT was APPROVED; 1 SHOULD_FIX + 3 NITs).

## Per-finding disposition

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | SHOULD_FIX | ESLint follow-up lived only in `.ai_out` (not durable) | INCORPORATED — created `docs-internal/tickets/ticket-eslint-adoption.md` (new `docs-internal/tickets/` convention; no prior convention existed). References the submodule README's matching follow-up (DRY: one pass for both). NOTE: reviewer suggested `docs-internal/plan/follow-ups.md`; a `tickets/` dir was mandated by the orchestrator and scales to future tickets. |
| 2 | NIT | No-op `constructor(leaf) { super(leaf); }` in `NeighborhoodGraphView` | INCORPORATED — deleted, plus the now-unused `WorkspaceLeaf` import in that file. |
| 3 | NIT | `docIdService` field implicitly public with no external consumers | INCORPORATED — made `private` (cheap, better encapsulation; tsconfig has no `noUnusedLocals`, so a write-only private field does not break `check`). Doc comment notes step-03 decides final visibility. |
| 4 | NIT | `test:sublib` uses `npm install` not `npm ci` (theoretical lockfile drift) | REJECTED (matches reviewer's own "No action required") — `npm ci` wipes node_modules every `npm test` run (slow); tree verified clean today; switch to `npm ci` only if the submodule tree ever shows dirty. |

All dispositions in commit on branch `step-01-scaffold` (this commit; see `git log -1`).

## Verification (actual runs, 2026-07-16, logs in .tmp/iter-*.log)

- `npm run build` → exit 0 (tsc -noEmit + prod bundle + dev-vault copy).
- `npm test` → exit 0 (our suite 2 tests passed; sublib suite 69 tests passed).
- `npm run check` → exit 0.

## Still outstanding (unchanged from review)

- Human GUI check: open `.dev-vault/` in Obsidian >= 1.12.4, run "Open neighborhood graph" → renders "hello graph", no console errors.

CONVERGED: yes
