---
closed_iso: 2026-08-07T20:46:29Z
id: nid_6eust4js4l85s163nezeq3v3g_e
title: 'Local pinning UI: second pin control, icons, wiring, e2e'
status: closed
deps: [nid_2zm28ijiqp786yw6grwbvmffv_e, nid_56ggaa2iz70di7xc3h8objt8n_e]
links: [nid_ndoy0bq50w1p1qzd2i9di2fxo_e, nid_2zm28ijiqp786yw6grwbvmffv_e, nid_56ggaa2iz70di7xc3h8objt8n_e]
created_iso: '2026-08-07T19:30:55Z'
status_updated_iso: 2026-08-07T20:46:29Z
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

**2026-08-07T20:46:22Z**

RESOLVED 2026-08-07. Local pinning UI shipped.

Pure model: src/view/nodePinAction.ts gains planNodeLocalPinAction(isLocallyPinned) -> {kind:"local-pin"|"local-unpin", title:"Pin for this note"/"Unpin for this note", iconId:"map-pin"/"map-pin-off"} (distinct lucide glyph per Q1). Tests in nodePinAction.test.ts incl. distinct-icon (both-pinned) assertion.

Node UI: src/view/NoteNode.tsx renders a SECOND hover chip (.vicinity-graph-local-pin-button) beside the global pin (reads LOCAL GLOBAL GEAR) and a second context-menu entry, both driven by the pure model. Both withheld on the MAIN node (data.tier==="main", decision Q4). Both-pinned shows both indicators (each toggle reflects its own flag). CSS placement in src/view/graph-view.css (var-based, flush at every density rung). Covered by NoteNode.component.test.tsx (second button, both-pinned, hidden-on-MAIN, click routing, menu order/omission).

Ports/wiring: viewPorts.ts ControlsActionsPort gains localPinNode(path)/localUnpinNode(docid) + new ActiveMainProvider port. src/view/ControlsActions.ts implements both via settingsWritePipeline.runGuarded with the existing "pinned-set" subject (ONE failure policy, no new catch/notice). Refused local pin (either doc not persistable, or no active main) = store-unchanged, skips rebuild like a refused global pin; a rejected persist repaints + one notice. GraphViewController.activeMainPath() supplies MAIN context; wired in VicinityGraphView.tsx. Guarded-outcome tests added to ControlsActions.test.ts (land/refuse-target/refuse-main/no-main/persist-reject for pin, and unpin).

flowMapping: renders from isGloballyPinned/isLocallyPinned flags already carried by the core ticket (flowMapping.test.ts flag coverage pre-existing).

E2E: new sibling e2e/localPinScenario.e2e.ts — locally pin a neighbor (becomes central), DISCONNECTED case per owner note 6 (pin lp_b via pinned-central traversal, unpin lp_a so hub no longer reaches lp_b by any link, lp_b stays central), switch MAIN away (drops out) / back (central again), and a real-restart persistence check. Green.

Docs: README.md Pinning section split into Global vs Local pin. high-level-plan.md already documented local pinning (core ticket) incl. the two per-node flags + toggles — verified, no change needed.

Gates: npm run check (0), npm test (1791 passed), npm run test:e2e -- localPinScenario.e2e.ts (2 passed) + regression run of pinnedCentralScenario/vicinityGraph/nodeResize/nodeContentOverride (51 passed).
