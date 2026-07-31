---
closed_iso: 2026-07-30T09:37:01Z
id: nid_o5a1055jyynn9nohpb5rj2vqp_e
title: "Pin writes: bring the pinned-set persist under the settings failure policy"
status: closed
deps: [nid_t25rc8sd9nmlbmrn69k4zsaes_e]
links: [nid_itpt4tf0kkhsbbz0np304a558_e]
created_iso: 2026-07-30T06:08:58Z
status_updated_iso: 2026-07-30T09:37:01Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [settings, settings-cleanup, view, persistence]
---

Found by the review of ticket nid_itpt4tf0kkhsbbz0np304a558_e (which put ONE user-visible failure policy on SETTINGS writes, in `src/view/settingsWritePipeline.ts`'s private `write()`).

GAP: the PINNED-SET write does not go through that body. `src/view/ControlsActions.ts` `pinNode()` / `unpinNode()` call `this.settingsWrites.runSerialised(...)` with a NON-writer body (`persistenceServices.pinDoc` / `unpinDoc` → `PluginDataStore.addPin` / `removePins`). `runSerialised` does not catch, so a rejected `data.json` write there:
- rejects the promise the React handler `void`s → an UNHANDLED rejection,
- shows the user NOTHING (no Notice, not even a console.error),
- while the pin is already in memory (`PluginDataStore.persist()` moves `this.data` before `saveData`), so the node keeps rendering as pinned until a restart drops it.

So a failed pin is strictly LESS visible than a failed settings edit, on the same store and the same chain — a POLS violation the failure-policy ticket deliberately left out of scope.

WORK (sketch, not prescriptive): the copy seam already exists — `src/view/settingsWriteFailureNotice.ts` owns WHAT is said and `UserNoticePort` owns the surface. Either give `ControlsActions` the port and catch around the pin body, or (cleaner, and the reason this depends on nid_t25rc8sd9nmlbmrn69k4zsaes_e) give the pipeline a caught seam for a non-settings serialised write so there is still ONE catch. Do NOT add a second ad-hoc try/catch policy: CLAUDE.md says one pipeline, one fan-out, one failure policy.

Test through the seam like `src/view/settingsWritePipeline.test.ts` does: a rejecting `PluginDataPort`, then assert exactly one message on `FakeUserNotices` and that the caller's promise resolves.

## Acceptance Criteria

A rejected pinned-set persist tells the user once (asserted through FakeUserNotices) and does not reject the void-ed caller; no second failure policy is introduced; npm test and npm run check pass.


## Notes

**2026-07-30T09:37:01Z**

Done. `guarded()` in src/view/settingsWritePipeline.ts now owns BOTH the single catch and the single fan-out; new public seam `runGuarded(subject, task)` carries a non-settings serialised write (the pinned set) through it. A rejected pin persist reports ONCE via UserNoticePort with copy from src/view/settingsWriteFailureNotice.ts (closed NonSettingsWriteSubject union, no call-site copy) and the void-ed caller resolves. Fan-out is keyed on GuardedWriteOutcome: a REFUSED pin (no stable id, nothing moved) rebuilds nothing; a REJECTED persist repaints, since PluginDataStore.persist() moves this.data before saveData. No second failure policy — production code now has exactly one refreshAllViews() call (was two); ControlsActions dropped its own ViewsRefreshPort. Tests 1290 -> 1294, none removed; npm run check clean. Reviewed APPROVED (round 2). Commits b3a7220, a2eae3d. In-memory rollback on failed writes stays out of scope: nid_biwdtykvazsk3ejcqqli8o9j7_e.
