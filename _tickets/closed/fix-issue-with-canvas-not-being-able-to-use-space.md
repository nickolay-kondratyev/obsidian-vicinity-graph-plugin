---
closed_iso: 2026-08-01T18:26:10Z
id: nid_156zg4bvhjc7nnl0gwut20bvs_e
title: Fix issue with canvas not being able to use space
status: closed
deps: []
links: [nid_5f1o7z2iyis3sgbbpeu7j8oor_e]
created_iso: '2026-08-01T18:14:18Z'
status_updated_iso: 2026-08-01T18:26:10Z
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Right now now there is an issue with canvas when the vicinity plugin is enabled, in the canvas the 'space' inside nodes stops working.

The way to repros is to start the vicinity plugin,
Navigate to a note, then navigate to a canvas, then try to create a NODE in the canvas and try typing space. 
EXPECTED: being able to use space as usual.
ACTUAL: Space does not work at all.

Let's make sure we end e2e test for this. And a follow up ticket to add e2e tests for core canvas and note functionality to work while the vicinity graph plugin is enabled, also note for the follow up ticket this issue particurly happened after navigating the canvas while vicnity view is open.

## Resolution (2026-08-01)

**Root cause.** React Flow (the library rendering the vicinity graph) installs WINDOW/DOCUMENT-level `keydown` handlers for its default key bindings — `panActivationKeyCode: 'Space'`, `selectionKeyCode: 'Shift'`, `deleteKeyCode: 'Backspace'`, zoom/multi-select modifiers — and calls `event.preventDefault()` on a match, app-wide, for as long as the vicinity view is mounted. RF does exempt focused input fields / contenteditables, but Obsidian renders canvas text cards inside a CONTROLLED EMBED IFRAME and forwards their keystrokes to the main document (so app hotkeys work); the forwarded event's target is not a contenteditable, so the exemption never fires and RF's Space binding cancelled the keystroke before Obsidian handed it back to the card editor. Confirmed by e2e repro: typed `hello world` into a canvas card arrived as `helloworld` with the vicinity view open, and typed fine without it.

**Fix.** `src/view/VicinityGraphFlow.tsx`: pass `deleteKeyCode={null}`, `selectionKeyCode={null}`, `panActivationKeyCode={null}`, `zoomActivationKeyCode={null}` on `<ReactFlow>` (`multiSelectionKeyCode` was already null). The graph is read-only, so it needs none of these bindings — pan/zoom stay pointer-driven. A WHY comment at the prop site says the bindings must stay null.

**Test.** New `e2e/canvasSpaceKey.e2e.ts` (written FIRST, red before the fix, green after): opens the vicinity view, renders a note's vicinity, navigates to a canvas, creates a text card via the canvas API, types through the controlled iframe, asserts the space survives.

**Verified.** `npm run check` clean; `npm test` 1462/1462; `npm run test:e2e -- vicinityGraph.e2e.ts canvasSpaceKey.e2e.ts` 26/26.

**Hardening (same day).** The null-list was allowlist-by-hand: an RF upgrade adding a NEW default binding would re-grab keys with no compile error. Now the bindings live in ONE constant (`src/view/reactFlowKeyBindings.ts`, spread into `<ReactFlow>`), and `src/view/reactFlowKeyBindings.component.test.tsx` mounts the REAL `<ReactFlow>` under jsdom with window/document `addEventListener` wrapped, asserting ZERO key listeners register (with a control case proving RF defaults DO register — so the recorder cannot rot vacuous). Runs on every `npm test`.

**Follow-up.** `nid_5f1o7z2iyis3sgbbpeu7j8oor_e` — broader e2e coverage that core canvas + note editing keeps working while the plugin is enabled (Space/Backspace/Shift typing, canvas node deletion, and the navigate-then-edit sequence from this repro).
