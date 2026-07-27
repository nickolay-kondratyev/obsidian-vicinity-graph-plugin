# PRIVATE memory — node-sizing-image-space (IMPLEMENTATION_WITH_SELF_PLAN)

## State: COMPLETE. Nothing pending. Not committed (top-level agent commits).

All plan steps done, `npm test` 1090/1090, `npm run check` clean, no e2e (unavailable).
No change_log entry written (top-level agent owns that).

## Exact diff surface (branch `node-sizing-image-space`, working tree)

- `src/engine/constants.ts` — added `THUMBNAIL_VISIBLE_MIN_NODE_PX = 104` after
  `CENTRAL_SIZE_SCORE`, in the "Non-settings tuning constants" section (deliberately
  NOT in `SETTINGS_SPEC`: it is not user-facing).
- `src/engine/index.ts` — re-export added to the `./constants` export block.
- `src/engine/NodeSizer.ts` — import broadened to a multi-line block; class jsdoc gained
  a line; `computeSizes` now calls `NodeSizer.withImageSpace(...)` for `sizePx`; new
  `private static withImageSpace(node, sizePx, settings)` at the end of the class.
- `src/engine/NodeSizer.test.ts` — new `describe("NodeSizer image-bearing height floor")`
  inserted immediately BEFORE the preference-independence describe; import of the constant.
- `src/view/thumbnailDensityThreshold.test.ts` — NEW guard test (fs-reads `graph-view.css`).
- `src/view/graph-view.css` — comment only, above `@container (min-height: 72px)`.
- `docs-internal/plan/high-level-plan.md` — one bullet in "### Sizing", one sentence
  appended to the "Where that decision lives" rendering bullet.
- `docs-internal/tickets/ticket-dev-vault-recognizable-thumbnail.md` — corrected stale
  "cropped cover" criterion.
- `docs-internal/tickets/ticket-thumbnail-contain-vs-cover-decide.md` — NEW `[decide]` ticket.
- `README.md` — one clause under Global defaults → Sizing.
- CLAUDE.md untouched (no stable-knowledge change at that altitude).

## Things a clone must not re-litigate

1. `NodeSizer.test.ts:325+` "node preview preference independence" is a hard invariant.
   The floor MUST key off `node.firstImagePath`, never off `nodePreviewChoice`/preference.
2. Do not floor `sizeScore` — it feeds `GraphTruncator`/`NodePriorityChain` ranking.
3. The clamp order `Math.max(sizePx, Math.min(FLOOR, maxPx))` is deliberate; a trailing
   `Math.min(_, maxPx)` breaks under inverted `minPx > maxPx` (permitted by
   `clampSizingSettings`, which clamps fields independently).

## Useful mechanics learned

- `FakeLinkProvider` fixture: declare the image as a file (`{ path: "pic.png" }`) and
  link a note to it; `.png` is non-node-bearing → becomes an `AttachmentRef{isImage:true}`
  → `TraversedNode.firstImagePath`. Linking to an UNDECLARED path fails construction loudly.
- Repo tickets are hand-written markdown in `docs-internal/tickets/` — the `ticket` CLI
  is NOT used here (no `.tickets/` dir). Follow the file convention.
- CSS block regex that works on this stylesheet:
  `/@container \(min-height:\s*(\d+)px\)\s*\{\n([\s\S]*?)\n\}/g` — body ends at a
  column-0 `}` because inner rules are tab-indented.
- Verbose output → `.tmp/` (`red.txt`, `green.txt`, `test-all.txt`, `check.txt`,
  `test-final.txt`). Bash tool prints a long env-setup preamble; ignore it.

## If asked to extend

- A "legibility" floor larger than 104 (e.g. thumbnail slot + 2 title lines) would need
  the CSS density budget to change TOO, or the guard test goes red — that is the guard
  working as designed, not a bug. Change both numbers together.
- Per-view sizing overrides (future) must apply the floor after resolution, i.e. keep it
  inside `NodeSizer.computeSizes`, which already receives the resolved settings.
