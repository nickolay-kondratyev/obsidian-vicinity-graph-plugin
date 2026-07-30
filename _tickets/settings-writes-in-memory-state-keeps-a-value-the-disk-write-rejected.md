---
id: nid_biwdtykvazsk3ejcqqli8o9j7_e
title: "Settings writes: in-memory state keeps a value the disk write rejected"
status: open
deps: []
links: [nid_itpt4tf0kkhsbbz0np304a558_e]
created_iso: 2026-07-30T05:53:42Z
status_updated_iso: 2026-07-30T05:53:42Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [settings, robustness, ux, decide]
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

## Acceptance Criteria

The notice copy and the in-memory state agree about what happened after a rejected persist, with the chosen option recorded.

