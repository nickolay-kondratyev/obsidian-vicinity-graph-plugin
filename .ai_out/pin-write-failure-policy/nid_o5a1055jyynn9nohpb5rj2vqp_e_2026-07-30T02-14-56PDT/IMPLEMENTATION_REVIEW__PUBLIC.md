# IMPLEMENTATION REVIEW — `b3a7220` (pinned-set persist under the one failure policy)

## Summary

`pinNode`/`unpinNode` moved from `SettingsWritePipeline.runSerialised` (uncaught) to a new
`runGuarded(subject, task)` seam. The pipeline's single `try` was extracted from `write()`
into a private `guarded(failureNotice, body)`; both the settings body and the foreign pin
body pass through it. Copy stays in `settingsWriteFailureNotice.ts` behind a closed
`NonSettingsWriteSubject` union + a label map, so `ControlsActions` types no user-visible
text. The rejecting `PluginDataPort` test double was promoted out of
`settingsWritePipeline.test.ts` into `src/persistence/RejectingPluginDataPort.ts` and reused
by the new `ControlsActions` failure tests.

Verified myself (logs in `.tmp/review-test.log`, `.tmp/review-check.log`):

- `npm test` — 96 files / **1290 tests passed**, exit 0.
- `npm run check` (`tsc -noEmit` for `src/` and `e2e/`) — exit 0.
- No `sanity_check.sh` in the repo.

Acceptance criteria: met. Exactly-one notice is asserted through `FakeUserNotices` at BOTH
levels (`settingsWritePipeline.test.ts:254`, `ControlsActions.test.ts:155-171`), the void-ed
caller's promise resolves (`ControlsActions.test.ts:161-166`), the queue-survives-a-failure
property is re-asserted for the guarded path, and no second `try` was added anywhere
(`grep 'try {' src/view/*.ts` still shows only the pipeline's one plus the three
pre-existing, unrelated, documented catches).

**No functionality was removed or weakened.** The only deletion is the local
`RejectingPluginDataPort` class in `settingsWritePipeline.test.ts`, which was moved verbatim
(plus an injectable failure and a doc comment) — every pre-existing pipeline and pinning
test survives unchanged.

**No success-path regression.** The fan-out for a landing pin was always
`ControlsActions.refreshEveryView()` INSIDE the task body, and it still is
(`src/view/ControlsActions.ts:80-95`); `runGuarded` only wraps. The two behaviour tests that
pin this (`ControlsActions.test.ts:107,113` — "WHEN a node is pinned THEN EVERY open view is
refreshed", same for unpin) are untouched and green. So `runGuarded` NOT fanning out is
correct for the success path.

## 🚨 CRITICAL Issues

None.

## ⚠️ IMPORTANT Issues

### MAJOR — the "WHY-NOT fan out" rationale conflates a REFUSED pin with a REJECTED persist, and nothing tests the case it now owns

`/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/src/view/settingsWritePipeline.ts:137`

> `WHY-NOT fan out here like {@link write} does: the task owns its own fan-out, because a
> write that never happened (a refused pin) must rebuild nothing.`

and `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/src/view/ControlsActions.ts:23`

> `NOTHING rebuilds when the write did not land: no rendered state changed…`

Those two sentences are true of the case they were written for (`not-persistable` → nothing
in memory moved) and **false of the case this commit newly brings under the seam**. On a
rejected persist, `PluginDataStore.persist()` has ALREADY moved `this.data` before
`port.saveData` (`src/persistence/PluginDataStore.ts:79-82`), so the pin IS in memory when
the task rejects, `refreshEveryView()` is skipped, and the screen and the store now disagree.
That is the exact divergence the settings half of the same policy refuses to allow —
`write()` fans out after `guarded()` precisely so "views must repaint from what the STORE
holds" (`settingsWritePipeline.ts:190`, pinned by the test at
`settingsWritePipeline.test.ts:278`). So the commit unified the catch and the copy but left
the two halves on OPPOSITE fan-out rules, while the comment asserts there is one reason.

User-visible consequence: click pin on an unwritable vault → notice appears, node still
renders unpinned, and then some unrelated later rebuild (switching notes) makes it render
pinned even though it never reached disk — a state change the user can no longer connect to
the notice they saw.

Also: there is **no test either way** for the failure-path fan-out. `viewsRefresh` is
returned by `actionsUnderTest` but the three new tests never assert on it, so whichever
behaviour is intended is currently unpinned and free to flip.

Suggested fix (either is fine, but pick consciously and say so):
1. Preferred, and consistent with the settings half: have the pin path repaint what the
   store holds after a rejected persist — e.g. `runGuarded` takes the fan-out decision the
   way `write()` does, or `ControlsActions` keeps its `refreshEveryView()` in a `finally`-
   equivalent position that only the `not-persistable` early return skips. Then assert
   `WHEN a pin's persist rejects THEN every open view is refreshed anyway`.
2. Or keep today's behaviour, but split the WHY-NOT into its two distinct cases (refused =
   nothing moved, rejected = memory moved and we deliberately defer the repaint), add
   `WHEN a pin's persist rejects THEN nothing is refreshed` so the choice is captured, and
   link it to the open rollback ticket `nid_biwdtykvazsk3ejcqqli8o9j7_e`, which is the ticket
   that will settle it.

## 💡 Suggestions

### MINOR — `runGuarded` converts ANY throw in the task body into "couldn't save Pinned notes"

`src/view/settingsWritePipeline.ts:140` catches the whole `ControlsActions` body, not just the
persist: a throw from `vault.getFileByPath`, `PathDocIdMap`, or a future bug in
`persistOutcome` is reported to the user as a `data.json` save failure. Before this commit
those surfaced as unhandled rejections (bad in a different way). Not worth a second policy;
worth one sentence in `runGuarded`'s doc stating that the guarded body should contain the
write and little else, so a caller does not grow logic under it.

### MINOR — the failure-message literal now lives in two places

`src/persistence/RejectingPluginDataPort.ts:15` defaults to
`new Error("data.json could not be written")` and `src/view/settingsWritePipeline.test.ts:195`
still declares `const SAVE_FAILURE = new Error("data.json could not be written")`. Two
distinct `Error` objects with the same text in one suite is a small trip hazard. Export the
default from the port (`RejectingPluginDataPort.SAVE_FAILURE`) and have the test inject/reuse
it.

### NIT — `SerialSettingsWrites` does not carry `runGuarded`

`src/view/settingsWritePipeline.ts:78`. `ControlsActions` depends on the concrete
`SettingsWritePipeline` (pre-existing), so nothing is broken; but the interface that exists
for DIP now describes only half of the "run on the chain" surface.

### NIT — the CLAUDE.md sentence is now hard to parse

`CLAUDE.md:41`: `…is caught in the pipeline's ONE guarded() — which runGuarded(subject, task)
lends to data.json writes the pipeline does not plan (the pinned set, from ControlsActions),
so those never grow a policy of their own — reported ONCE through UserNoticePort…` — the
em-dash clause separates "is caught" from "reported ONCE". Content is accurate (and the
"no call-site try/catch … three pre-existing catches" clause remains true); consider
splitting into two sentences.

## Documentation Updates Needed

- `CLAUDE.md:41` reads correctly on substance; only the split above is suggested.
- `src/view/settingsWritePipeline.ts:137` and `src/view/ControlsActions.ts:23` need the
  refused-vs-rejected correction from the MAJOR item — these are the load-bearing docs for
  the seam, and as written they justify the failure-path fan-out with a reason that does not
  apply to it.

## Verdict

**CHANGES_REQUESTED** — for the MAJOR item only. The catch, the copy seam, the tests and the
ACs are all sound and I found no regression; what is required before this lands is that the
failure-path fan-out be either aligned with the settings half or explicitly documented AND
covered by a test, so the seam's own rationale stops describing a different case than the one
it now owns. The MINOR/NIT items are optional.
