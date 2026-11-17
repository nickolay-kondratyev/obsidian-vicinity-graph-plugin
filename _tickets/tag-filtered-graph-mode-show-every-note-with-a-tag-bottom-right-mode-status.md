---
id: nid_aimlia0wjp0ms0uzd4fvhbomo_e
title: "Tag-filtered graph mode: show every note with a tag + bottom-right mode status"
status: open
deps: [nid_mr42m1k8cmyeusemmvmxuuaxb_e]
links: []
created_iso: 2026-11-17T20:32:45Z
status_updated_iso: 2026-11-17T20:32:45Z
type: task
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [tags-v1]
parent: nid_xhed75cwiy0ui4fokv6l02cxf_e
profile: higher
---

## Goal
A graph view can switch from "vicinity of the active note" to "every note tagged #X", and always shows which mode it is in. Use case 2 of the epic, minus the entry points (ticket `nid_6qj8n7uc7zz126l3ix8czfymq_e` adds the right-click menu / command / in-graph click on top of the API this ticket exposes).

Part of epic `nid_xhed75cwiy0ui4fokv6l02cxf_e`. Read `_agent_decisions/needs_review/tags-v1-product-decisions.md` (sections 9-12) first.

## Done criteria
- A per-view graph MODE: `note` (today's behavior, follows the active file) or `tag` (a tag). In tag mode the graph shows every note carrying the tag or a nested child tag (shared rule from `nid_mr42m1k8cmyeusemmvmxuuaxb_e`), with the links between them as edges; node exclusion and the node cap still apply; pins add nothing; no node is MAIN. Truncation in tag mode keeps the most-linked notes (deterministic tie-break) — the MAIN-distance ranking does not apply.
- The engine stays pure: the tag build is an engine entry point (or request variant) fed through `LinkProvider` (add a "notes carrying tag" fact; the Obsidian adapter answers it from the metadata cache — mark the per-build vault scan ceiling in a comment). Unit-tested with `FakeLinkProvider`.
- Tag mode is sticky per view: opening other notes (incl. clicking a node) does NOT change the graph; tag edits elsewhere (metadata resolved) rebuild it. The mode is saved in the view's per-leaf state (`src/view/VicinityGraphView.tsx` `getState`/`setState`, empty today) so it survives an Obsidian restart.
- A public method on the plugin/view layer to enter tag mode for a tag in the graph view (opening the view if none is open, reusing `src/view/GraphViewOpener.ts`) and to exit back to note mode — the entry-points ticket calls it. Also add ONE command-palette command for e2e/accessibility ONLY IF cheap; otherwise leave commands to the entry-points ticket.
- A status pill in the graph's BOTTOM-RIGHT (free today; React Flow `<Controls>` sits bottom-left) that ALWAYS shows the mode: note mode "Vicinity of <note title>", tag mode "Tagged #tag · N notes" plus an exit button ("Back to active note"). Hover explains the mode in plain words (note mode follows the open note via links; tag mode shows every tagged note regardless of links and does not follow the open note). Empty tag (no notes) shows a clear empty state, not a blank canvas.
- Tests: unit tests for the engine tag build, controller mode switching and stickiness; component test for the pill; a NEW long-term e2e spec (e.g. `e2e/tagFilterMode.e2e.ts`) covering enter tag mode (via the public method/command) ⇒ only tagged notes render; opening another note keeps the filter; exit ⇒ back to the active note's vicinity; mode survives `relaunch`. No CSS/look assertions.
- `npm run check`, `npm test`, touched e2e specs + `vicinityGraph.e2e.ts` green.
- Update `docs-internal/plan/high-level-plan.md` (new section) and `docs-internal/architecture-map.md`.

## Context
- `src/engine/VicinityEngine.ts` (`GraphBuildRequest` requires `main` today), `src/engine/GraphTruncator.ts`, `src/engine/CrossLinkSweep.ts` (induced edges among visible nodes — likely reusable), `src/engine/NodeSizer.ts`.
- `src/view/GraphViewController.ts` owns the rebuild pipeline and `handleActiveFileChanged`; `src/view/VicinityGraphView.tsx:145-163` lifecycle + events; `src/main.ts` wiring.
- e2e harness: `e2e/obsidianHarness.ts` (`openGraphView`, `executeCommand`, `relaunch`).

## Constraints
- Layering: `view → adapters → engine (pure)`. Only `GraphViewController` touches Obsidian + the async engine.
- Grouping in tag mode uses whatever grouping mode is set; excluding the filter tag from tag-grouping keys is owned by `nid_6qj8n7uc7zz126l3ix8czfymq_e` (it lands after both this and the grouping ticket).

## Non-goals
- Multiple tags / boolean tag queries; tag mode for the in-graph panel's settings; per-view settings.
