# CLARIFICATION__PUBLIC — Markdown outline inside graph nodes

Human-approved decisions. **These are requirements, not suggestions.** Deviating needs human approval.

## Original task (verbatim intent)

Show the Markdown heading outline inside graph nodes that have enough space, for **plain markdown notes only** (not excalidraw, not canvas).

Image-vs-outline rule:
- Note's first image appears **before the first heading** → show the **image**.
- Note's first image appears **after/within a heading** → show the **outline**.

Overflow rules:
- Outline fits horizontally but not vertically → **scrollable**, with the vertical scrollbar visible **only on node hover** (hidden otherwise; scrolling must still work).
- A single outline entry too wide for the node → **ellipsis (…)**, other entries render normally.

Interaction:
- Clicking an outline entry opens the note **positioned at that heading**.

## Human decisions (this clarification round)

| # | Question | Decision |
|---|---|---|
| 1 | Outline depth | **Configurable max depth** — a setting (slider, range 1–6, default 2) controls how many heading levels render. Entries are indented by level. |
| 2 | Feature on/off gate | **No enable/disable setting.** The feature is always active for eligible notes. Users who want image-only put the image before the first heading — that is the documented escape hatch. |
| 3 | Outline staleness | **Accept for now.** Ship without a `metadataCache.on("changed")` trigger; outlines refresh on the next natural rebuild (active-file switch / rename / delete). **File a `docs-internal/tickets/` ticket** for a debounced live-refresh follow-up. |
| 4 | Excalidraw exclusion | **Filename suffix `.excalidraw.md`.** Excalidraw files **stay in the graph** as nodes — they are excluded from **outline parsing/rendering only**. |

## Interpretation note (flagged to human; correct if wrong)

Answers 1 and 2 combine as: **no on/off toggle for the feature, but a "max outline depth" setting does exist** (default 2). If the human intended literally zero new settings, the depth becomes a hard-coded constant of 2 and the settings plumbing is dropped.

## Binding constraints from exploration (see `EXPLORATION_PUBLIC.md`)

- Engine purity: no `obsidian` types in `src/engine/` — translate `HeadingCache[]` → an engine-owned POJO in `ObsidianLinkProvider`.
- "Enough space" must be decided by **CSS container queries** (`container-type: size`, existing 72px/104px breakpoints), not JS measurement — matches the only level-of-detail mechanism the codebase has.
- Canvas files have no headings → gate outline extraction to markdown, mirroring `frontmatterTitleOf`'s early return.
- No persisted-shape version bump for outline data (live-recomputed). A **new setting** does need persistence-parse wiring.
- No RTL/jsdom: decision logic (eligibility, image-vs-outline choice, depth filtering, click→heading target) must live in pure colocated `*.test.ts` modules; DOM behavior is e2e-only.
- `flowMapping` memo-stability contract: an outline **array** on `FlowNodeData` must not defeat `useMemo`/diffing.
