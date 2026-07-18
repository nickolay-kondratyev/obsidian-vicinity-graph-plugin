# CLARIFICATION__PUBLIC — step-05-rich-rendering (branch: main)

Human-aligned decisions, 2026-07-18. These are BINDING for implementation/review.

## Q1 — Edge count badge / engine change
**APPROVED**: extend engine `GraphEdge` with `count: number`; `EdgeAccumulator` accumulates duplicate-link multiplicity instead of discarding it (thread through `EdgeVisibility` paths too).

## Q2 — ctrl/cmd-click
Ctrl/cmd-click opens the note in a **NEW tab** (`getLeaf(true)`). Plain click stays current-tab (`getLeaf(false)`).

## Q3 — Attachment-icon dropdown
Native Obsidian `Menu`. Clicking an entry opens that file via Obsidian's default handling (attachments open in Obsidian's default viewer).

## Q4 — Truncation badges
- Per-folder "+N" badge on rendered folder groups (from `hiddenNodeCountsByFolder`).
- Folders whose members were ALL truncated (no group rendered): counts aggregate into **one graph-corner overlay badge "+N hidden"**, with per-folder breakdown in its tooltip/title. Nothing silently disappears.

## Q5 — Visual QA / e2e
- Manual QA checklist = smoke test (light + dark), human smoke-run ticket pattern as step 04.
- **IN SCOPE**: Playwright e2e harness driving Obsidian (Electron) on the dev-vault, asserting **DOM/state** (node counts, badge text, CSS classes, edge markers) — no screenshot/LLM judgment; re-runnable at release.
- If launching Obsidian proves infeasible in this environment: deliver harness + docs and STOP to inform human (no faking).

## Palette — HUMAN-APPROVED DEVIATION from step doc
- **NO folder colors in step 05.** No color hashing, no palette, no folder-color-hash unit test. Color UX deserves a deliberate design pass → follow-up ticket "Folder color UX — deliberate design pass".
- Groups: neutral Obsidian theme styling — subtle border, `--background-secondary`-style fill, folder-name label on the group.
- Singletons/ungrouped nodes: folder identity via **breadcrumb in the node title**: `<folder-name>/<node-title>` (muted folder part, clearly a folder).
- Spec docs adjusted to record this as human decision.

## NEW requirement (from Q&A, human-added)
**Node title source**: if the note's frontmatter has a `title` or `name` property, use that value as the display title; otherwise filename without extension. (Currently engine title = basename — requires adapter/engine title sourcing change.)

## Thumbnails (default, confirmed)
Port method → `vault.getResourcePath`; no extra cache; re-resolved per rebuild.

## Tiers (default, confirmed)
Pinned central = `isCentral && !isMain`; no engine change.
