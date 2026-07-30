# DOC_FIXER (PRIVATE) — rehydration notes

## State on exit

Branch `nid_x6hgehsu5il1d1shuraz3ufqy_e_2026-07-29T19-51-59PDT`. One commit from me,
docs only: `CLAUDE.md`, `docs-internal/notes/settings.md`,
`docs-internal/architecture-map.md`. `npm run check` exit 0 after the edits
(`.tmp/doc-check.log`). TOP_LEVEL_AGENT was writing `_tickets/` in parallel — I did NOT
stage those paths, so `git status` may show its in-flight ticket edits; that is expected,
not my dirt.

## Decisions and their reasons

1. **One CLAUDE.md bullet, not an extension of an existing one.** The prompt allowed
   extending; I judged the natural neighbours ("Settings writes", "Settings rows") are
   each about a WRITE/RENDER contract, and folding a testing rule into either would blur
   the SRP the section is built on. Placed the new bullet directly after "Settings rows"
   so the three ONE-X rules read as a block, before "Persistence".
2. **Architecture map: added a bullet.** The gate was "does the map already track tests
   at that granularity". It does — three existing bullets name a guard test inline. I
   attached the new one to `engine/SettingsSpec.ts` (the thing guarded), which had no
   bullet despite being the value contract the whole chain derives from.
3. **notes/settings.md: new per-ticket section, not a table edit.** The chain table's
   column is "why this position" and carries no status; done-ness in this file is
   recorded as `### What ticket N added to the family` sections plus satellite
   strikethroughs. Followed that. Left the mermaid graph and satellite list untouched.
4. **Marked the stale standing decision rather than rewriting it.** The owner's "KEEP a
   small number of literal assertions" is still the owner's word; deleting it would erase
   the very instruction the pending `decide` ticket is about. Appended a pointer instead.

## Loose ends a successor may want

- `nid_5rdya0nr660n9sru1zhfs51ic_e` (`decide`, all-21 vs SMALL): when the owner rules,
  update BOTH places in `docs-internal/notes/settings.md` (the step-5 section's "Open
  owner decision" paragraph and the "Tests" standing-decision bullet), and drop the word
  "provisional".
- Satellite `nid_ek3wrqoh1rsftk6ulg836mghf_e` (e2e types into a settings input) was goal 3
  of the step-5 ticket and did NOT land — e2e was untouched this round. I left it listed as
  "behind tests (5)"; whoever closes step 5 should decide whether it is now simply
  unblocked and say so in the note.
- Reviewer NIT 2 (the "4 of 7 geometry-observable" prose duplicated across three code
  comments) is a real DRY smell but lives in `src/`; needs an implementer pass or a ticket.
