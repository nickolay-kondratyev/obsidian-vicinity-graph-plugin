# PRIVATE memory — nid_t25rc8sd9nmlbmrn69k4zsaes_e (COMPLETE)

## Goal
`ControlsActions` shows its pin-refusal message through `UserNoticePort`, not `new Notice`.

## Plan (all done)
1. [x] `src/view/ControlsActions.test.ts`: dropped `vi.mock("obsidian")` + the `vi` import, injected one `FakeUserNotices` (shared with the pipeline, as in production), asserted refusal copy.
2. [x] `src/view/ControlsActions.ts`: dropped the `obsidian` import, added a 5th ctor param `notices: UserNoticePort`, `persistOutcome` now calls `this.notices.show(message)`. Removed the class-doc line "This is one of the few view files allowed to import `obsidian`" (no longer true) and lowercased the "can't be pinned Notice" mention in the `WriteOutcome` doc.
3. [x] `src/view/VicinityGraphView.tsx`: 6th ctor param `notices: UserNoticePort`, passed through to `ControlsActions` — mirrors exactly how `viewsRefresh` / `settingsWrites` are threaded.
4. [x] `src/main.ts`: passes the already-existing `this.notices` into `new VicinityGraphView(...)`; widened that field's doc from "a failed settings write" to also cover a refused pin.
5. [x] `npm test` 1245/1245 pass (94 files); `npm run check` clean (logs: `.tmp/test.log`, `.tmp/check.log`).

## Decisions / rationale
- Copy stayed as the private `NOT_PINNABLE_NOTICE` const in `ControlsActions.ts`. NOT co-located with `settingsWriteFailureNotice.ts`: that module exists to DERIVE copy from the declared row/reset model (its whole reason is "never re-type a label"); a pin refusal names no row and has ONE call site, so moving it there would add a hop and buy nothing.
- Test pins the literal string in its own `NOT_PINNABLE_MESSAGE` const (user-visible copy is worth a tripwire; same pattern as `settingsWriteFailureNotice.test.ts`). Deliberate duplication of copy between impl and test, not knowledge duplication.
- Added a negative case too ("a pin that lands tells the user nothing") so the notice can't become unconditional.
- Ctor param order: `notices` appended last in both `ControlsActions` and `VicinityGraphView`, keeping the existing prefix stable.
- NOT added: a source-scan test asserting "no view file but main.ts constructs Notice". Out of ticket scope; the state is achieved. If wanted later it belongs next to `settingsRowParity.test.ts`-style scans.

## State
Working tree has the 4 modified files, uncommitted (TOP_LEVEL_AGENT commits). Ticket `_tickets/controlsactions-route-its-pin-notice-through-usernoticeport.md` still `status: open` — left for the top-level agent to close with the commit, matching the previous ticket's history.
