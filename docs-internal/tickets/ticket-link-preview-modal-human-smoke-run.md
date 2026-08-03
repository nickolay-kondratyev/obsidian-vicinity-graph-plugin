# Ticket: human smoke run — link-preview modal gestures in a REAL Obsidian

**Status:** OPEN — needs a human with a real Obsidian window and a real vault.
**Origin:** ticket `nid_z2k1eebic1nilpz9z3r65cnrx_e` (gesture wiring, part 4/4 of
parent `nid_tohotgq2s92dvd1iov1rd0umv_e` — "show the preview of the links").
**Precedent:** `ticket-node-preview-pill-human-smoke-run.md`.

What IS automated: the model builders (`linkPreviewModel.test.ts`), the rendered
modal content (`LinkPreviewContent.component.test.tsx`), the collapse state
machine (`contextRowCollapse.test.ts`), and the controller's gesture → model →
seam pipeline (`GraphViewController.test.ts`, "link previews" describe). What a
unit test cannot settle is the modal INSIDE a real Obsidian window: real metadata
cache, real editor navigation, real theme chrome.

**Behavior change to be aware of:** plain node click no longer opens the note —
it opens the preview modal (human-aligned 2026-07-31). Ctrl/Cmd-click opens the
note in a new tab.

## Setup

`npm run setup:dev-vault`, open `.dev-vault/` in Obsidian, open the vicinity
graph, and pick a MAIN note that has: headings, several outgoing links (one
linked twice from the same note, if the vault has it), and backlinks from ≥2
notes.

## Checklist

1. **Node modal content.** Plain-click a node. The modal opens titled with the
   note's name and shows, in order: its heading **outline**, its **Links**
   (outgoing occurrences, document order — a note linked twice appears twice),
   and its **Backlinks** grouped per source note. A note with no headings shows
   no outline section stub weirdness; empty sections read intentionally.
2. **Edge modal scoping.** Click an edge A→B. The modal is titled "A → B" and
   lists ONLY the occurrences of links from A to B — none of A's other links,
   none of B's. The row count matches the edge's count badge.
3. **Expand/collapse.** Each context row expands to its surrounding context and
   collapses back; the **Expand all** / **Collapse all** buttons act on every
   row and disable themselves when there is nothing left to do.
4. **GO — outgoing link.** Expand an outgoing-link row, hit **GO**: the modal
   closes and the editor opens the SOURCE note positioned at that occurrence's
   line (the line is visible, not below the fold).
5. **GO — backlink (recenter).** From a node modal's backlink row, hit **GO**:
   the editor opens the BACKLINK SOURCE note at the linking line — and because
   the active file changed, the graph recenters on that source note.
6. **Ctrl/Cmd-click still opens the note** — in a NEW tab, no modal.
7. **Unchanged neighbours.** Hover pops NOTHING (the native page preview was
   removed, ticket `nid_jnw75pg24q4itujs8vfgqj4mh_e`);
   right-click still shows the pin/unpin menu; attachment chips still open their
   menu (no modal from any of these). Folder-group boxes stay inert on click.
8. **Theme pass.** Repeat 1–2 once in light and once in dark; the modal pulls
   theme variables, so both should just work.

Close this ticket with a note per item (OK / issue + screenshot into `.out/`).
