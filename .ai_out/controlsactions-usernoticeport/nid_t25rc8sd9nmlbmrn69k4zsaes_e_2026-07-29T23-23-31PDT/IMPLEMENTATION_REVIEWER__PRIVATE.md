# PRIVATE — IMPLEMENTATION_REVIEWER, nid_t25rc8sd9nmlbmrn69k4zsaes_e (COMPLETE)

Verdict: **READY**. Public review: `IMPLEMENTATION_REVIEW__PUBLIC.md`.

## What I ran myself (not trusted from the maker)
- `npm test` → exit 0, 94 files / 1245 tests (`.tmp/rev-test.log`).
- `npm run check` → exit 0, incl. `check:e2e` (`.tmp/rev-check.log`).
- `grep -rn "new Notice(" src/ e2e/` → only `src/main.ts:62`.
- `grep -rn 'from "obsidian"' src/view/` → no `Notice` among the survivors.
- `grep -rn 'vi.mock("obsidian"' src/` → zero.
- `grep -rn "new VicinityGraphView" src/ e2e/` → only `src/main.ts:88` (no missed caller).
- No `sanity_check.sh` in this repo.

## Reasoning I want preserved
- **Test non-vacuity** established by the PAIR of new tests (refusal → `[msg]`, landing pin → `[]`),
  plus fixture proof that `ID_LESS_PATH` is resolvable in `VAULT` yet unidentifiable on
  `FakeDocIdPort`, so `pinNode` actually reaches `persistOutcome`. Did not mutate source to
  mutation-test (role is read-only for code); the pair + accumulating `FakeUserNotices` is decisive.
- **Failure-policy question I deliberately chased**: `ControlsActions.pinNode` runs inside
  `settingsWrites.runSerialised(...)`, which does NOT pass through the pipeline's `write()` try —
  so a *rejected* `pinDoc` persist still has no catch and no notice. That is PRE-EXISTING and
  already ticketed as `_tickets/pin-writes-bring-the-pinned-set-persist-under-the-settings-failure-policy.md`,
  so I did not raise it against this commit. Do not let a later reviewer mistake it for a regression.
- Concluded the CLAUDE.md "ONE failure policy, reported ONCE" rule is *settings-write* scoped; a pin
  refusal is a `PersistableIdentity` verdict, not a rejected persist. Sharing the port instance is
  the intent of the port, not a second policy.
- Agreed with the maker on the two judgement calls (copy stays local, no source-scan lint test) and
  said so explicitly in the public review so it is not re-litigated.

## Open, handed to the committing/top-level agent
1. Ticket file still `status: open` at HEAD — needs closing + `change_log`.
2. Optional: `docs-internal/architecture-map.md:55-57` could name the second `UserNoticePort`
   producer. Not blocking.
