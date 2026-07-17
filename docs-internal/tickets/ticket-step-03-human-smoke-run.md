# Ticket: Step-03 human smoke run in real Obsidian

**Status:** OPEN
**Origin:** step-03-adapters-and-persistence (exit criteria include a real-vault verification; the dev environment has no Obsidian GUI, so this is human-only).

Steps (dev vault `.dev-vault/`):
1. `npm run build` (copies artifacts into the dev vault), open the vault in Obsidian, enable the plugin.
2. Open `note1.md` → run the debug command ("Neighborhood Graph: debug build") → expect nodes note1/note2/note3 + test.canvas, attachment `pic.png` as first image.
3. Leave the vault open ~15s after plugin load → confirm the orphan sweep runs (delayed, chunked, no errors in console).

Note: `.dev-vault/` fixtures are gitignored — recreate from the description in
`.ai_out/step-03-adapters-and-persistence/03-adapters-and-persistence/IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md`
if missing (or decide to track fixtures in a future step).

Close by recording the observed result here.
