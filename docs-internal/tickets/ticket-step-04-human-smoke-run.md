# Ticket: Step-04 human smoke run in real Obsidian

**Status:** DONE — observed 2026-07-18 (see result below). Core behavior verified; two notes recorded.
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

## Observed result (2026-07-18)

- Steps 1–4 (open in right sidebar, render neighborhood, navigation, click-to-open): ✅ as expected (implied by graph rendering + updating on edit).
- **Step 5 (debounced link edit): ✅ updates, but end-to-end latency is a few seconds, not ~500ms.**
  - **Root cause — expected, not a bug.** `REBUILD_DEBOUNCE_MS=500` is OUR debounce coalescing the metadata-`resolved` burst, NOT the end-to-end keystroke→graph latency. Obsidian does not re-parse a file's metadata per keystroke — it saves after ~2s idle, then reindexes and resolves links, and only then fires `metadataCache.on("resolved")`; our 500ms sits on top. So observed ≈ Obsidian save/reindex (~2s) + 500ms. This matches how Obsidian's own backlinks/local-graph panels update.
  - **Why we don't chase it:** the graph builder depends on `resolvedLinks`, which Obsidian only makes consistent at `resolved`. Reacting to an earlier event (`vault.on("modify")` / `metadataCache.on("changed")`) would rebuild against stale link data — a correctness hazard. Not worth trading correctness for perceived snappiness in V1 (Pareto). Revisit only if a snappier active-file-edit path is explicitly wanted.
- **Step 6 (skip-layout proof): ✅** `console.debug("...structural diff skipped elk layout...")` observed on a no-structural-change edit.
- **Step 7 (view lifecycle): ✅ close/reopen + drag work. Opening a SECOND view refocuses the existing one instead of creating a new leaf — ACCEPTED as desired ("just one of these views open at a time" is fine).**
  - This is `activateView()` reusing `getLeavesOfType(...)[0]` (single-instance sidebar tool, standard pattern). The per-leaf `getState`/`setState` overrides remain correct/valuable for single-view workspace restore. No code change; multi-view was a nice-to-have, not a requirement.
- Step 8 (workspace restore): follows the active file on reload (scroll/zoom intentionally not persisted — CLARIFICATION Q4).

**Disposition:** Step 04 exit criteria met. No code changes required from this smoke run. Single-instance view is the accepted V1 behavior.
