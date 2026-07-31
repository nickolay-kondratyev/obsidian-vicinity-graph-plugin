---
closed_iso: 2026-07-31T17:37:06Z
id: nid_biwdtykvazsk3ejcqqli8o9j7_e
title: "Settings writes: in-memory state keeps a value the disk write rejected"
status: closed
deps: []
links: [nid_itpt4tf0kkhsbbz0np304a558_e]
created_iso: 2026-07-30T05:53:42Z
status_updated_iso: 2026-07-31T17:37:06Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [settings, robustness, ux]
---

Surfaced while implementing the settings-write failure policy (ticket nid_itpt4tf0kkhsbbz0np304a558_e), deliberately out of its scope.

OBSERVED: `src/persistence/PluginDataStore.persist()` moves in-memory state BEFORE the serialised disk write (documented as intentional: "In-memory state moves NOW, the disk write is serialised"). So when `saveData` rejects:
- the pipeline now shows ONE notice naming the setting ("Vicinity graph couldn't save X"), and
- every open view is refreshed from `PluginDataStore`, which still holds the NEW value.

Net effect: the user is told the setting was not saved, yet the graph and both settings surfaces keep showing (and using) the new value for the rest of the session; it is lost on restart. That is not a lie in either direction on its own, but the two halves read as contradictory.

OPTIONS (needs an owner decision):
1. Keep as is, and soften the notice copy in `src/view/settingsWriteFailureNotice.ts` to say the change applies for this session only but was not saved to disk.
2. Roll the in-memory value back when the persist rejects (`PluginDataStore` would need to keep the pre-write snapshot), so the notice, the store and the optimistic controls all agree — at the cost of throwing away a change the user made.

No behavior change is shipped for this until decided.

## Decision (2026-07-31, owner)

**Option 1 — keep the optimistic in-memory apply, soften the notice copy.** New copy
(implemented in `src/view/settingsWriteFailureNotice.ts`, pinned by
`src/view/settingsWriteFailureNotice.test.ts`):

> Vicinity graph couldn't save "SUBJECT" — the change applies for this session but will
> be lost when Obsidian restarts. See the developer console for details.

Rationale:
- Copy-only change in the ONE file that owns write-failure copy; the template applies
  identically to settings rows, reset scopes and the pinned set.
- Option 2 (rollback) has a correctness landmine on top of its stated cost: writes are
  serialised and each `persist()` snapshots the WHOLE `PluginData`, so a later successful
  write already carries the failed write's value to disk — rolling memory back would then
  disagree with disk in the OPPOSITE direction. Doing it right means versioned snapshots
  interleaved with the chain: real complexity for a rare failure path (locked vault, full
  disk) whose cause would likely make a redone write fail again anyway.
- "will be lost when Obsidian restarts" is a deliberate simplification: a later successful
  write rescues the value (strictly better than promised), so the sentence never
  under-delivers; hedging on the rescue would bury the actionable fact. Recorded in the
  WHY doc on `SettingsWriteFailureNotice.notice()`.

## Acceptance Criteria

The notice copy and the in-memory state agree about what happened after a rejected persist, with the chosen option recorded. ✅ Done — copy shipped, decision recorded above.

