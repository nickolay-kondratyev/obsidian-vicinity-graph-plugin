---
id: nid_6eust4js4l85s163nezeq3v3g_e
title: 'Local pinning UI: second pin control, icons, wiring, e2e'
status: in_progress
deps: [nid_2zm28ijiqp786yw6grwbvmffv_e, nid_56ggaa2iz70di7xc3h8objt8n_e]
links: [nid_ndoy0bq50w1p1qzd2i9di2fxo_e, nid_2zm28ijiqp786yw6grwbvmffv_e, nid_56ggaa2iz70di7xc3h8objt8n_e]
created_iso: '2026-08-07T19:30:55Z'
status_updated_iso: '2026-08-07T20:31:13Z'
type: feature
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2
---
UI half of LOCAL PINNING (planned from nid_ndoy0bq50w1p1qzd2i9di2fxo_e; decisions in nid_2zm28ijiqp786yw6grwbvmffv_e; core persistence/adapter work in nid_56ggaa2iz70di7xc3h8objt8n_e — this ticket depends on both).

FEATURE RECAP: a local pin pins a target ONLY in the context of the current MAIN note; global pinning unchanged; a node can carry both pin kinds and shows both indicators.

SCOPE
1. Pure action model: extend src/view/nodePinAction.ts (or sibling module, same pattern) with planNodeLocalPinAction(isLocallyPinned) -> {kind, title, iconId}; distinct lucide icon per decision Q1 (suggested "map-pin"); titles "Pin for this note" / "Unpin for this note". Local-pin control hidden/disabled on the MAIN node itself (decision Q4).
2. src/view/NoteNode.tsx: second hover button beside the existing PinButton + second context-menu entry; both driven by the pure action model. Both-pinned renders both indicators. CSS via Obsidian theme variables in src/view/*.css (styles.css is generated — never hand-edit). Load the obsidian-settings/UI skill guidance if touching visual layout.
3. Ports/wiring: ControlsActionsPort (src/view/viewPorts.ts) gains localPinNode(path)/localUnpinNode(docid) [unpin may need target docid + main context]; src/view/ControlsActions.ts implements both through settingsWritePipeline.runGuarded with the existing "pinned-set" subject pattern (ONE failure policy — no new catch sites, no second notice). GraphViewController supplies the active main file for context. GuardedWriteOutcome semantics: refused local pin (either doc not persistable) = "store-unchanged" and skips rebuild, same as global pin refusal.
4. flowMapping already carries isGloballyPinned/isLocallyPinned from the core ticket — render from those flags; never derive pin state in the view from the persistence store directly.

TESTS: nodePinAction-style pure tests; ControlsActions.test.ts guarded-outcome tests for local pin/unpin incl. refusal; NoteNode.component.test.tsx (jsdom pragma) for the second button, both-pinned rendering, and hidden-on-MAIN; flowMapping.test.ts flag rendering. E2E REQUIRED (view-layer DOM change): extend or sibling e2e/pinnedCentralScenario.e2e.ts — locally pin a neighbor, switch to another note (target no longer central), switch back (target central again), restart-persistence check if the existing spec pattern supports it. Run at minimum npm run test:e2e -- pinnedCentralScenario.e2e.ts plus npm run check and npm test before calling done.

DOCS: README.md pinning semantics section gains local pinning; verify high-level-plan.md was updated by the core ticket and finish it if not.

## Acceptance Criteria

User can locally pin/unpin a neighbor from the graph via button and context menu; distinct icon; both-pinned shows both; local pin only takes effect while its main note is active and survives restart; refusals reported once via the existing notice policy; unit + component + e2e green.


## Notes

**2026-08-07T19:47:45Z**

NOTE (owner decision 6): e2e scenario should include the disconnected case — locally pin a neighbor, remove/lack the link from main, target still renders as central while that main is active.
