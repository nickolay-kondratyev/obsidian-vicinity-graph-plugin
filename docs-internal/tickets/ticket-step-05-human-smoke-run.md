# Ticket: Step-05 human smoke run in real Obsidian (rich rendering)

**Status:** OPEN — awaiting human run
**Origin:** step-05-rich-rendering (visual polish is human-judged; automated coverage already exists — see below).

## What is ALREADY verified automatically (no need to re-check functionally)

`npm run test:e2e` (18 Playwright tests against real Obsidian 1.12.7, headless, run + independently re-run green in the dev environment): view mount, node tiers (MAIN/pinned/regular classes), breadcrumb on ungrouped nodes, folder group + "+N" badge, corner "+N hidden" overlay, directed arrowheads themed in light AND dark (never RF's stock `#b1b1b7`), "×N" collapsed-edge badge, icon-strip counts, thumbnail `app://` src, ctrl/cmd-click new-tab gesture without multi-select conflict.

## What needs HUMAN eyes (visual/native-feel judgment)

Full checklist: `.ai_out/step-05-rich-rendering/main/QA_CHECKLIST.md`. Focus areas:

1. `npm run setup:dev-vault` → open `.dev-vault` in Obsidian → open `note1.md` + the graph view.
2. **Does a node answer "what is this note" at a glance?** — title (frontmatter-title fixture note shows its frontmatter title), thumbnail (note1 → pic.png), attachment icon chips with counts, size emphasis on MAIN.
3. **Aesthetics/legibility on the dense fixtures**: folder group boxes (neutral styling, label readable, not overlapping children), edge arrowheads + mirrored A↔B curvature legible, badges not cluttered.
4. **Native feel**: icon chip click → Obsidian `Menu` feels native; entries open files; hover on a node → native page preview appears (check "Page preview" core plugin source registered).
5. **Theme pass**: switch light ↔ dark → everything (incl. arrowheads) follows the theme with zero plugin reloads.
6. **Arrowhead size judgment** (deferred from Phase B review NIT): are arrowheads a good size at typical zoom levels?

Record observations inline here (step-04 ticket pattern) and disposition.
