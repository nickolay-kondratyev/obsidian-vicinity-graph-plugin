# QA_CHECKLIST — step-05 Rich Rendering (human smoke run, dev vault)

Status: **NOT EXECUTED** — written by Phase B; Obsidian cannot be launched in the
implementation environment. Execute in `.dev-vault` after `npm run setup:dev-vault`
(idempotent; also builds and copies the plugin). Check items off as you verify.

Fixtures already in the dev vault (Phase A iteration): `note1/2/3.md`, `test.canvas`,
`pic.png` (embedded by note1), `projects/alpha.md` + `projects/beta.md` (2-member
folder group; alpha↔beta bidirectional; alpha→note1 linked TWICE; frontmatter
title; png/pdf/csv attachments), `solo/gamma.md` (singleton folder, padded
frontmatter title), `assets/data.csv`, `assets/report.pdf`.

Open the graph: command palette → "Open neighborhood graph", then focus `note1.md`
or `projects/alpha.md` as noted.

## 1. Rich note nodes (focus `projects/alpha.md`)
- [x] Titles come from frontmatter where present: alpha shows its `title:` value, not "alpha"; `solo/gamma.md` shows its trimmed frontmatter title.
- [x] MAIN node (alpha) has a solid accent ring and a bolder title.
- [x] Regular nodes have a subtle 1px border. (Pinned-central dashed accent ring cannot be produced yet — the pin affordance ships in step 06; verify no node shows it spuriously.)
- [x] Node size varies with note size (bigger notes = bigger squares), 40–160px.
- [x] Small nodes show title only; larger nodes progressively reveal the attachment strip and then the thumbnail (CSS container-query density).
- [NOT_CHECKED] `note1.md` (embeds `pic.png`) shows the image thumbnail (fixed height, cropped cover) once the node is large enough. No "+N" image badge with a single image.
  - WHY: The PIC is not very recognizable at all lets add some open source image that we can pull while creating the dev vault, (ok to bring down small open source image into source as well)
- [x] Ungrouped non-root nodes show a muted `folder/` breadcrumb before the title (e.g. `solo/…` on gamma when it renders ungrouped); root notes (note1) show NO breadcrumb.

## 2. Attachment icon strip (focus `projects/alpha.md`)
- [x] Alpha's node shows one chip per extension (png / pdf / csv) with counts; distinct icons per type.
- [x] Hovering a chip shows a tooltip like "1 pdf file".
- [x] Clicking a chip opens a NATIVE Obsidian menu listing those files by name (with icons) — and does NOT open the note itself.
- [x] Clicking a menu entry opens that attachment in Obsidian's default viewer (current tab).
- [ ] Dragging a node starting on a chip does not drag/pan (chip is inert for drag).
  - Note sure what you mean to test here.  

(Not producible in the dev vault: menus cap at 20 entries with a disabled
"…and N more" trailing item — unit-tested in `attachmentMenu.test.ts`; alpha's
largest group has 1 file.)

## 3. Folder groups
- [x] `projects` renders as a group container: subtle border, secondary-background fill, "projects" label at the top — NO folder color.
- [x] alpha + beta render INSIDE the container; the label is not overlapped by member nodes (elk top padding).
- [x] `solo/gamma.md` (singleton) renders WITHOUT a group — folder identity only via its breadcrumb.
- [NO] Dragging the group container moves its members with it.
  - we dont have drag working right now
- [x] Clicking the group background does not try to open a note (no error, nothing happens).
 

## 4. Edges: direction, pairs, multi-link badge
- [x] Every edge has an arrowhead showing link direction.
- [NO] alpha↔beta renders as TWO curved edges bowing to opposite sides (no overlap), each with its own arrowhead.
  - I dont see the arrowheads well, they arent rendering cleanly
- [x] alpha→note1 (linked twice) shows a "×2" badge at the edge midpoint.
  - I would like this styled to be cleaner though
- [x] Single-link edges show NO badge.


## 5. Interactions
- [ ] Click node → note opens in the current main-area tab (step-04 behavior intact).
  - Clicking on arrows does not do anything,
  - clicking on the node does open that node and makes it the center node in the graph.
- [ ] Ctrl/Cmd-click node → note opens in a NEW tab — and the node does NOT stay marked selected in the graph (no lingering accent ring; repeated ctrl-clicks never accumulate a multi-selection).
  - Opens the new tab with the node centered.
- [ ] Hovering a node fires Obsidian's native page preview popover (Page preview core plugin must be enabled; "Neighborhood graph" appears in its settings list).
  - yes preview shows up 
- [ ] Keyboard: Tab reaches nodes; focused node shows an accent focus ring (not a default browser outline).
    - yes tab appears to work.
    
## 6. Truncation badges — LIMITED manual coverage
The dev vault (~7 notes) cannot hit the 100-node cap, so the "+N" group badge and
the corner "+N hidden" overlay cannot be produced here (no settings UI until
step 06). They are covered by unit tests and Phase C e2e. Manual check:
- [ ] With nothing truncated, NO group "+N" badge and NO corner overlay badge render.

## 7. Theme pass (repeat the visual checks)
- [ ] Light theme: nodes/groups/badges/edges legible; RF zoom controls and dots background match the theme (no white buttons).
- [ ] Dark theme (Settings → Appearance → Dark): same — zero plugin changes needed; text readable, borders subtle, accent rings visible.
- [ ] Edge arrowheads match the edge line color in BOTH light AND dark (no fixed light-gray arrowheads — React Flow's `#b1b1b7` default is overridden in CSS).

## 8. Step-04 regressions
- [x] Switching active files rebuilds the graph (last switch wins; no stale graph).
- [x] Editing a link updates the graph after the ~2-3s debounce/reindex latency (known step-04 behavior).
- [x] Small note edits refresh node data WITHOUT jumping positions (reuse-layout path).
- [no] Empty state (focus a canvas-less non-note or close all files): centered muted message.
    I closed all files and still the old file is there, which is ok for now.