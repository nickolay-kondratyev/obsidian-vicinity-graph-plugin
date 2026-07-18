# Ticket: Step-04 human smoke run in real Obsidian

**Status:** OPEN — awaiting human observation
**Origin:** step-04-view-shell (exit criteria include manual view-lifecycle verification; the dev environment has no Obsidian GUI, so this is human-only).

Steps (dev vault `.dev-vault/`):
1. `npm run setup:dev-vault` (recreates fixtures if missing + builds + copies artifacts into the dev vault), open the vault in Obsidian, enable the plugin.
2. Run command **"Neighborhood Graph: Open neighborhood graph"** → view opens in the **right sidebar**. Open `note1.md` → expect the neighborhood rendered as plain React Flow nodes (note1/note2/note3 + test.canvas), pan/zoom/fit-view working.
3. **Navigation**: click through note1 → note2 → note3 → the graph rebuilds to each active note's neighborhood. Opening a non-eligible file (e.g. `pic.png`) leaves the graph unchanged (MAIN gating — md/canvas only).
4. **Click-to-open**: click a node in the graph → the corresponding note opens.
5. **Debounced link edit**: with the view open on `note1`, add/remove a `[[link]]` in `note1.md` → the graph updates within ~500ms (`REBUILD_DEBOUNCE_MS`).
   -> Graph updated, but it was a few seconds not 500ms

6. **Skip-layout proof**: make a no-structural-change edit (e.g. edit note body text, not links) → open devtools console, expect `console.debug` line `...structural diff skipped elk layout...` (nodes/edges refresh data without a layout jump). Note: `console.debug` is hidden unless the console verbosity includes "Verbose"/"Debug". 
  -> yep saw the console message.

7. **View lifecycle**: close/reopen the view; drag the view from the sidebar into the main editor area and back (draggable view type); open a **second** neighborhood-graph view at the same time → both track their own active file independently, no cross-contamination.

 -> I couldnt open open another view (it woudl refocus existing view), but thats ok to have just one of these views being able to be open at a time. 

8. **Workspace restore**: with the view open, quit & reopen Obsidian (or reload) → the view restores and follows the active file (scroll/zoom intentionally NOT persisted in V1 — CLARIFICATION Q4).

Note: `.dev-vault/` fixtures are gitignored — recreate via `npm run setup:dev-vault` (or from
`.ai_out/step-03-adapters-and-persistence/.../IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md`) if missing.

Close by recording the observed result here.
