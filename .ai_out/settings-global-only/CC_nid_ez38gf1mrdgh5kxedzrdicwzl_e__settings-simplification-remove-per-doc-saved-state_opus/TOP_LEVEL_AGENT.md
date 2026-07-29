# TOP_LEVEL_AGENT — settings-global-only (ticket nid_ez38gf1mrdgh5kxedzrdicwzl_e)

Goal: remove ALL per-doc saved graph state. Settings global-only; pins stay global; ONE global depth drives MAIN + every pinned central.

Dep ticket nid_wimjq4ewgbg21n4zx9d4qq3a0_e: CLOSED (descriptor model landed). OK to proceed.

Decision (from ticket, no human input needed): stale `doc-data/` dirs are IGNORED (simplest), release note documents the discard.

## Phases
1. PHASE_1 code removal (persistence/engine/adapters/view) + unit tests + `npm test` / `npm run check` green.
2. REVIEW_PHASE_1 → ITERATION_PHASE_1.
3. PHASE_2 docs/specs/e2e/release-note/tickets.
4. REVIEW_PHASE_2 → ITERATION_PHASE_2.
5. TOP_LEVEL: change_log entry, close/annotate tickets.

## Owner answers (real human input)
- 2026-07-29, re: ratified guard wording (settings.md:73-78 naming the now-deleted `ViewSettingsResolver.resolve()`):
  **ACCEPT THE RESTATEMENT.** PHASE 2 rewords the standing decision so completeness is stated as
  compile-forced by the descriptor model (`ParsedViewFields` / `satisfies Record<keyof ViewSettings, ...>`),
  since no site enumerates `ViewSettings` fields anymore. Tickets 4/5/6 inherit the reworded bar.

## Log
- PHASE_1 (code removal): done, 5 commits, gates green (verified independently by reviewer: 1085 tests, check exit 0).
- REVIEW_PHASE_1: APPROVE w/ 1 BLOCKING (stale e2e reset-copy assertion) + 4 SHOULD-FIX.
- ITERATION_PHASE_1 spawned.
