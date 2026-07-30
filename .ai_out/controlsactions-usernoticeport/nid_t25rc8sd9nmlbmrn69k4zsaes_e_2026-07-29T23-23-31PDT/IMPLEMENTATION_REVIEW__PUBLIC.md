# Review — ControlsActions pin notice through UserNoticePort (HEAD `ad7fd66`)

## Verdict: **READY**

Behavior-neutral, correctly wired, honestly tested. No BLOCKING or IMPORTANT findings.

## Independently verified

| Check | Result |
|---|---|
| `npm test` | PASS — 94 files / 1245 tests (`.tmp/rev-test.log`) |
| `npm run check` | PASS — `tsc -noEmit` + `check:e2e` clean (`.tmp/rev-check.log`) |
| `grep -rn "new Notice(" src/ e2e/` | exactly one hit: `src/main.ts:62` |
| `grep -rn 'from "obsidian"' src/view/` | remaining hits are `ItemView`/`Menu`/`Modal`/`PluginSettingTab`/`setIcon`/`stripHeadingForLink` — no `Notice` |
| `grep -rn 'vi.mock("obsidian"' src/` | zero hits repo-wide |
| `sanity_check.sh` | not present in this repo |

Acceptance criteria hold literally.

## Correctness / behavior neutrality

- Trigger condition unchanged: `ControlsActions.persistOutcome` still keys off
  `identity.kind === "not-persistable"` (`src/view/ControlsActions.ts:91`); only the sink
  changed from `new Notice(message)` to `this.notices.show(message)`.
- Copy unchanged: `NOT_PINNABLE_NOTICE` at `src/view/ControlsActions.ts:23` is byte-identical
  to the pre-change constant; the diff never touched the string.
- Pin semantics untouched — `pinNode`/`unpinNode` bodies and the `WriteOutcome` gate on
  `refreshEveryView()` are unmodified.
- Only construction site of `VicinityGraphView` is `src/main.ts:88`, so the widened ctor
  has no missed caller (and `tsc` would have caught one).

## Test honesty (the thing most worth checking here)

The new assertions are **not vacuous and not silently-passing**:

- `src/view/ControlsActions.test.ts` — "WHEN a pin is refused as not-persistable THEN the user is
  told why" asserts `expect(notices.messages).toEqual([NOT_PINNABLE_MESSAGE])`. `FakeUserNotices`
  accumulates (`src/view/FakeUserNotices.ts`), so dropping the `show()` call turns this into
  `[] vs [msg]` — a hard fail, no fallback path.
- The paired negative — "WHEN a pin lands THEN the user is told nothing" (`toEqual([])`) — is what
  makes the pair decisive: together they prove the message is produced on the refusal path *only*,
  so the notice can neither be dropped nor become unconditional.
- The fixture reaches the assertion for real: `ID_LESS_PATH` is resolvable by `VAULT`
  (`RESOLVABLE_PATHS`, line 42) and marked unidentifiable on `FakeDocIdPort` (line 53), so
  `pinNode` gets past the `getFileByPath === null` early return and lands on the refusal verdict.
- Deliberate copy duplication in the test's own `NOT_PINNABLE_MESSAGE` const is a user-visible-copy
  tripwire, mirroring `settingsWriteFailureNotice.test.ts`. Not knowledge duplication — correct call.

## Architecture / CLAUDE.md compliance

- The wiring genuinely mirrors `ViewsRefreshPort`: same shape (interface in `src/view/viewPorts.ts`,
  single impl in `src/main.ts`, `Fake*` for tests), threaded main → `VicinityGraphView` → collaborator
  as an appended ctor param. No parallel mechanism invented, no new fan-out, no new chain.
- The **ONE failure policy is not muddied**. The pipeline's policy (`settingsWritePipeline.write()`)
  is about a *rejected persist* of a settings write, with copy derived from the declared row/reset
  label. A pin refusal is a different thing entirely: a `PersistableIdentity` **verdict**, not an
  exception, on a non-settings write, with one call site and no row to name. Routing it through the
  same `UserNoticePort` *instance* is exactly the "one user-visible message surface" the port exists
  for; it adds no second catch and no second failure notice.
- Agreed with the maker's decision **not** to move the copy into `settingsWriteFailureNotice.ts` —
  that module's reason to exist is deriving copy from the declared settings model, which a pin refusal
  has no part of. Moving it would be indirection removing no duplicated knowledge (and would violate
  SRP for that module).
- Doc comments were kept truthful: the stale "This is one of the few view files allowed to import
  `obsidian`" line was removed rather than left lying, and `main.ts`'s `notices` doc was widened to
  name both producers.

## MINOR

1. **Ticket not closed.** `_tickets/controlsactions-route-its-pin-notice-through-usernoticeport.md`
   is still `status: open` at HEAD even though `ad7fd66` completes it. The maker flagged this as
   intentionally left to the committing agent. Fix: `ticket close nid_t25rc8sd9nmlbmrn69k4zsaes_e`
   (plus a `change_log` entry) in a follow-up commit.
2. **Optional doc touch.** `docs-internal/architecture-map.md:55-57` describes `UserNoticePort` as
   "the one user-visible message surface" — still accurate, but it now has **two** producers
   (`settingsWritePipeline.write()` and `ControlsActions.persistOutcome`). One clause naming the
   second producer would keep the map current. Not blocking; the existing text is not wrong.

## Explicitly NOT demanded

- **No source-scan test** ("only `main.ts` may construct `Notice`"). I agree with the maker that its
  absence is not blocking: the ticket is a scoped chore, the desired state is achieved and verified
  by grep, and the realistic regression (someone re-adding `new Notice` in a view file) is a
  low-frequency, easily-reviewed event. If it is ever wanted it belongs alongside the existing
  `settingsRowParity.test.ts`-style scans, not bolted onto this change.

## Guardrails

- No `ap_XXX_E` anchors touched. No behavior-capturing test removed — the only deletion is the
  `vi.mock("obsidian", …)` scaffold, whose sole purpose was making the module importable, plus a
  comment that documented that scaffold. Two tests were **added**, none weakened.
- No security surface: no new input, no secret, no serialisation change.

## Documentation Updates Needed

None required. `docs-internal/architecture-map.md:55-57` is the one optional nicety (MINOR #2).
