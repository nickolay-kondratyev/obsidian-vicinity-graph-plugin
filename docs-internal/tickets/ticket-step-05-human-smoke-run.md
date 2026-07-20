# Ticket: Step-05 human smoke run in real Obsidian (rich rendering)

**Status:** RUN 2026-07-20 — core rich-rendering verified. Functional features pass; four polish/scope items dispositioned to follow-up tickets (see below). Light/dark theme pass (§7) not manually performed — automated e2e covers arrowhead theming both themes.
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

## Observed result (2026-07-20)

Raw annotated checklist: `.ai_out/step-05-rich-rendering/main/QA_CHECKLIST.md`.

### ✅ Verified as-is
- **Rich nodes (§1):** frontmatter titles (alpha + trimmed gamma title), MAIN accent ring + bolder title, subtle 1px regular border, size varies with note size (40–160px), container-query density (title-only → attachment strip → thumbnail), muted `folder/` breadcrumb on ungrouped nodes with none on root notes.
- **Attachment strip (§2):** one chip per extension with counts + distinct icons; hover tooltip ("1 pdf file"); chip click opens the **native Obsidian menu** of files (not the note); menu entry opens the attachment in the default viewer.
- **Folder groups (§3):** `projects` container (subtle border, secondary-bg fill, top label, no color); alpha+beta nested with label not overlapped; singleton `solo/gamma` renders WITHOUT a group; clicking group background is inert.
- **Edges (§4):** every edge has an arrowhead; alpha→note1 shows a "×2" badge; single-link edges show no badge.
- **Interactions (§5):** hover fires the native page-preview popover; Tab reaches nodes with an accent focus ring.
- **Step-04 regressions (§8):** active-file switch rebuilds (last-switch-wins), link edit updates after reindex latency, small edits refresh data without position jumps.

### 📌 Dispositioned to follow-up tickets
1. **Thumbnail unverifiable — placeholder image not recognizable (§1).** `pic.png` is a synthetic placeholder, so the thumbnail feature could not be judged. → [[ticket-dev-vault-recognizable-thumbnail]].
2. **Arrowheads don't render cleanly + "×N" badge wants cleaner styling (§4).** Direction/pairing/count are functionally correct and e2e-asserted, but the human can't see arrowheads well and the mirrored A↔B pair reads unclean; the "×2" badge works but wants polish. Visual quality is not automation-covered. → [[ticket-edge-arrowhead-and-badge-visual-polish]] (absorbs the deferred Phase-B arrowhead-size NIT).
3. **Node/group drag not working (§2, §3).** Two checklist items assumed drag; manual repositioning was never a step-05 requirement and no usable drag exists (elk relayout overwrites, no position persistence). **Resolved 2026-07-20: out of V1** — drag explicitly disabled (`nodesDraggable={false}`) so there's no half-working drag; §2/§3 drag items are moot for V1. → [[ticket-node-drag-reposition]] (CLOSED).

### ✅ Accepted / by-design (no change)
- **Click behavior (§5):** clicking a node opens the note AND recenters the graph on it — **expected**: opening the note makes it the active file, and the neighborhood graph re-centers on the active file (step-04 pipeline). Clicking arrows/edges does nothing (edges carry no open action) — fine.
- **Ctrl/cmd-click (§5):** opens a new tab with that node centered; no lingering multi-selection accent ring (the RF multi-select-on-modifier conflict was disabled). As intended (CLARIFICATION Q2).
- **Empty state on close-all (§8):** closing all files leaves the last graph up. **By design** — `decideActiveFileRebuild` ignores a `null` active path so that focusing an image/PDF (or closing files) never blows away the graph (step-04 MAIN-gating rule). Human: "ok for now." Revisit only if an explicit "clear on no-note" behavior is wanted.

### ⏳ Not exercised
- **Truncation badges (§6)** and the corner "+N hidden" overlay: the ~7-note dev vault can't hit the 100-node cap; covered by unit + Phase-C e2e.
- **Light/dark theme pass (§7):** not manually performed this run. Arrowhead theming in both themes is e2e-asserted; a manual light/dark glance is still worth doing before release.

## Disposition summary

Step-05 rich rendering functionally verified in real Obsidian. No correctness bugs found; the flagged items are visual polish + a fixture gap + a scope question, all ticketed. Remaining human step before release: a quick light/dark theme glance (§7).
