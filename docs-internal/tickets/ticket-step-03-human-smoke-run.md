# Ticket: Step-03 human smoke run in real Obsidian

**Status:** DONE — observed 2026-07-18 (see result below)
**Origin:** step-03-adapters-and-persistence (exit criteria include a real-vault verification; the dev environment has no Obsidian GUI, so this is human-only).

Steps (dev vault `.dev-vault/`):
1. `npm run setup:dev-vault` (recreates fixtures if missing + builds + copies artifacts into the dev vault), open the vault in Obsidian, enable the plugin.
2. Open `note1.md` → run "Neighborhood Graph: Debug: log neighborhood graph for active file" → expect nodes note1/note2/note3 + test.canvas, attachment `pic.png` as first image.
   - The command now also logs a **backlink provenance** block: it queries Obsidian core directly (`getBacklinksForFile` + `resolvedLinks` .canvas-key count) alongside our provider, and names the delta. On this install expect `canvasCapability=[fallback-required]`, core canvas backlinks `NO`, and `test.canvas` appearing under `[OUR fallback only]` — proving the canvas edge comes from our parser, not core.
3. Leave the vault open ~15s after plugin load → confirm the console shows `neighborhood-graph: orphan sweep complete ...` (the completion log, with per-category removed counts), delayed + chunked, no errors.

Note: `.dev-vault/` fixtures are gitignored — recreate from the description in
`.ai_out/step-03-adapters-and-persistence/03-adapters-and-persistence/IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md`
if missing (or decide to track fixtures in a future step).

Close by recording the observed result here.

## Observed result (2026-07-18)

- **Graph (step 2):** ✅ `main=[note1.md] nodes=[4] edges=[4] hiddenByTruncation=[0]`; nodes note1/note2/note3 + test.canvas; note1 `firstImage='pic.png'`; edges note1→note2, note1→note3, note2→note1, test.canvas→note1. No console errors.
- **Sweep (step 3):** ✅ `neighborhood-graph: orphan sweep complete docDataFilesRemoved=[0] pinsRemoved=[0] centralEntriesRemoved=[0] ownersRewritten=[0]` — delayed, no errors.
- **Canvas provenance — KEY FINDING:** on this install canvas is **`core-indexed`** (`resolvedLinks` .canvas-key count=**1**), NOT the fallback. `getBacklinksForFile(note1)` returns `[note2.md, test.canvas]` **directly from Obsidian core**; our provider matches exactly (`[OUR fallback only]` delta empty). This contradicts the 2026-07-17 `count=0` snapshot and matches the documented ≥1.12.4 core behavior. The adaptive detection correctly selected the core path. See step doc note #1 CORRECTION. The fallback parser is therefore NOT exercised on a ≥1.12.4 real vault — it stays covered by unit tests only.
