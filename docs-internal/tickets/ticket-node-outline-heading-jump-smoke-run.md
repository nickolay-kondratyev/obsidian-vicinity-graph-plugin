# Ticket: human smoke run — clicking an outline entry jumps to that heading

**Status:** OPEN — post-merge smoke test.
**Origin:** `node-outline` CLARIFICATION Round 4, decision #10 (binding: merge on
the automated coverage, file this so the visual confirmation is not forgotten).

## Why this is not automated

The e2e suite pins **our** side of the contract: `e2e/nodeOutline.e2e.ts` asserts
the exact linktext handed to `workspace.openLinkText` (built from the RAW heading
text), that the note becomes active, and that the node-level "open at the top of
the note" handler does **not** also fire. What happens next — Obsidian resolving
the subpath, scrolling the editor to that heading and flashing it — is Obsidian's
own behaviour, and headless Electron gives no honest way to observe it.

## Do this (needs a GUI Obsidian)

1. `npm run setup:dev-vault`, open `.dev-vault`, enable the plugin.
2. Open `outline-note.md` and its vicinity graph; its MAIN node shows the outline.
3. Click an entry **late in the note** (e.g. `Conclusion`), so a jump is visibly
   different from opening at the top. Confirm Obsidian scrolls to that heading
   and flashes it.
4. Repeat in **reading view** (the heading jump uses a different code path there).
5. Click `Status of outline-cover today` — the heading carrying inline markdown.
   It must land on that heading too: the link key is the raw heading text, so
   this is the case where a display-vs-link mix-up would surface.
6. Ctrl/cmd-click any entry: new tab, still positioned at the heading.

## Record the result here

Pass → close the ticket. Fail → capture which step, which view mode, and the
linktext the plugin sent (devtools: it is `${path}#${stripHeadingForLink(raw)}`).

## Out of scope

Duplicate-heading behaviour: a link jumps to the FIRST match. That is Obsidian's
own semantics for `[[Note#Heading]]` and is documented as a V1 limit in README.
