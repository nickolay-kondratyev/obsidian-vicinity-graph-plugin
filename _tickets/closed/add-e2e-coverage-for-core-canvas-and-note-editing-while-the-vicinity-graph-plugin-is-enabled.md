---
closed_iso: 2026-08-06T20:58:42Z
id: nid_5f1o7z2iyis3sgbbpeu7j8oor_e
title: Add e2e coverage for core canvas and note editing while the vicinity graph
  plugin is enabled
status: closed
deps: []
links: [nid_156zg4bvhjc7nnl0gwut20bvs_e]
created_iso: '2026-08-01T18:25:40Z'
status_updated_iso: 2026-08-06T20:58:42Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-3
---
The vicinity graph view mounts React Flow, which installs WINDOW/DOCUMENT-level key handlers; ticket nid_156zg4bvhjc7nnl0gwut20bvs_e showed it eating Space inside core canvas text nodes app-wide (root cause: RF default panActivationKeyCode=Space preventDefault()s forwarded keystrokes from Obsidian's controlled embed iframes; fixed by nulling deleteKeyCode/selectionKeyCode/panActivationKeyCode/zoomActivationKeyCode in src/view/VicinityGraphFlow.tsx, gated by e2e/canvasSpaceKey.e2e.ts).

Follow-up: broaden e2e coverage so CORE functionality keeps working while the plugin is enabled, beyond the single Space/canvas case:
- Canvas: typing all of Space/Shift+chars/Backspace into a canvas text node; deleting a selected canvas node with Backspace/Delete still works (RF deleteKeyCode must not grab it); creating/editing node after NAVIGATING to the canvas while the vicinity view is open (the original repro emphasized the navigation step).
- Markdown note editing in the main pane with the vicinity view open: Space, Backspace, Shift-typing.
- Consider a generic guard: assert no window/document keydown listener calls preventDefault() for plain typing keys while the vicinity view is mounted.

Build on e2e/canvasSpaceKey.e2e.ts (canvas card creation recipe via canvas.createTextNode + frameLocator into the controlled embed iframe) and e2e/obsidianHarness.ts.

## Acceptance Criteria

npm run test:e2e passes with new specs covering: canvas text-node typing (Space/Backspace/Shift), canvas node deletion, and markdown note typing — all while the vicinity graph view is open and rendering a non-empty graph.

## Resolution (2026-08-06)

Added `e2e/coreEditingWhileGraphOpen.e2e.ts` (serial, its own `core-edit/` fixtures:
`note.md` → `[[target]]`, plus an empty `board.canvas`). `beforeAll` opens the graph
view and the note so a real `.vicinity-graph-node` is rendered throughout. Six specs:

1. **Canvas typing — Shift + Space.** Creates a text node via `canvas.createTextNode`
   (focus:true), types `"Hello World"` into the controlled-iframe `.cm-content`, asserts
   `toHaveText("Hello World")` — capitals prove Shift survived, the middle space proves
   `panActivationKeyCode` no longer eats it.
2. **Canvas typing — Backspace.** Continues on the same card, 6 Backspaces, asserts
   `toHaveText("Hello")`.
3. **Canvas node deletion — Backspace.** New node (focus:false), selected via the canvas'
   own `selectOnly` + `wrapperEl.focus()` (a Playwright pixel click is intercepted by
   `.canvas-node-content-blocker`; `selectOnly` is the same selection path minus the
   pointer math, matching `canvasSpaceKey.e2e.ts`'s `createTextNode` rationale), then a
   REAL `Backspace` keypress; asserts `canvas.nodes.size` drops by one (RF `deleteKeyCode`
   must not grab it).
4. **Canvas node deletion — Delete.** Same, with the `Delete` key.
5. **Markdown note editing in the main pane.** Re-navigates to the note (the repro
   emphasised NAVIGATING with the view open), types onto a fresh trailing line, asserts
   Space/Shift landed and Backspace deleted.
6. **Generic guard.** With `.vicinity-graph-flow` still mounted, dispatches a cancelable
   `keydown` for each RF-bound editing key (Space/Backspace/Delete/Shift/Control/Meta + a
   plain letter) on `document.body` and asserts NONE is `defaultPrevented` — a re-grabbed
   RF binding would go red here.

Verification: `npm run check` (clean), `npm test` (1669 pass), `npm run test:e2e` — all 6
new specs green (also green in isolation). One UNRELATED flake surfaced once in the full
run (`nodeResize.e2e.ts:433`, a pin-chip measurement assertion) but passes 15/15 in
isolation; each e2e spec launches its own fresh Obsidian + vault copy, so the new spec
cannot influence it — a pre-existing headless-render timing flake, filed as out of scope
for this ticket.
