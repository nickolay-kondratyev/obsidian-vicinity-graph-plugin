---
closed_iso: 2026-08-07T19:31:25Z
id: nid_ndoy0bq50w1p1qzd2i9di2fxo_e
title: Add ability to do local pinning
status: closed
deps: []
links: [nid_2zm28ijiqp786yw6grwbvmffv_e, nid_56ggaa2iz70di7xc3h8objt8n_e, nid_6eust4js4l85s163nezeq3v3g_e]
created_iso: '2026-08-07T19:24:26Z'
status_updated_iso: 2026-08-07T19:31:25Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-3
---
TASK: **PLAN**. Lets clarify any gaps that exist for this ticket
  (if you need to explore code base use cheaper Explore-cheap sub-agent)
  ask human any questions that come up that require human decision.
  Finally create detailed plan with requirements of what we want to achieve
  and steps of execution and put it into a new ticket 
  (or multiple tickets if it warrants a split across multiple tickets).
  Close this ticket after planning is complete.


What is local pinning it's when a node is pinned ONLY in the context of the main node.

We still retain global pinning functionality, and we will add another icon to represent LOCAL pinning.

A locally pinned note is seen as a PINNED note in the context of the MAIN(active) note. 
A note can be globally pinned AND locally pinned at the same time, or just one type of pinned.

We want to persist the pinned of the notes that are locally pinned for the note so we will want to save the IDs of the notes that are locally pinned under the settings for main id note.

## Notes

**2026-08-07T19:31:24Z**

RESOLUTION (planning complete):
- Explored current pinning end-to-end (persistence PinnedDocEntry/PluginDataStore, PersistenceServices eligibility seam, GraphRequestAssembler pinnedDescriptors, engine pinned-root traversal, NoteNode PinButton/nodePinAction, forgetDocs/OrphanSweeper).
- Created plan tickets:
  - nid_2zm28ijiqp786yw6grwbvmffv_e (decide): 5 human questions with recommended defaults (icon/UX, docid minting on MAIN, shared pinned depth trio, no self-local-pin, edit scope). Also mirrored in .out/current_decision.md.
  - nid_56ggaa2iz70di7xc3h8objt8n_e (feature, deps: decide): core — data.json localPins map keyed by main docid, PluginDataStore/PersistenceServices APIs, forgetDocs both-positions pruning, adapter merge of global+local pins into one pinned-root list (engine unchanged), isGloballyPinned/isLocallyPinned flags.
  - nid_6eust4js4l85s163nezeq3v3g_e (feature, deps: decide + core): UI — second pin button/icon, context menu, ControlsActions wiring through the one guarded pipeline, component tests + e2e, README + design-doc updates.
- Design-doc note: local pinning is the first sanctioned per-main-doc layer (supersedes the 2026-07-29 global-only decision for PINS only); core ticket includes updating high-level-plan.md.
