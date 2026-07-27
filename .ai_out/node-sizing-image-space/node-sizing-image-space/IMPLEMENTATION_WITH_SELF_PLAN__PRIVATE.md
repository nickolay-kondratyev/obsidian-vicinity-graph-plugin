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

---

# Iteration 2 (response to IMPLEMENTATION_REVIEW__PUBLIC.md — verdict NEEDS-ITERATION)

## State: COMPLETE. Working tree only (iteration 1 is committed as `898c48f`).
`npm test` 1093/1093, `npm run check` clean. No commit, no change_log entry.

## The one thing that was wrong in iteration 1
`THUMBNAIL_VISIBLE_MIN_NODE_PX = 104` compared a CSS **content-box** number to a
**border-box** `sizePx`. Container queries measure the content box; the node is
`box-sizing: border-box` with 1px border + 8px padding → content = `sizePx - 18`.
So the floor was 18px short and the thumbnail stayed `display:none`. VERIFIED
MYSELF in Chromium, not taken on trust.

## Measurement rig (reusable — this is the useful artifact)
`.tmp/it2-probe.mjs` — Playwright + local chromium (installed: `~/.cache/ms-playwright`,
playwright 1.61.1 is a devDependency). Reads `src/view/graph-view.css` directly
(styles.css is only a concatenation, so no build needed), renders the real
`NoteNode` markup with Obsidian-ish CSS vars, sweeps node height × font size ×
title length × chip count, and reports the WORST visible thumbnail height per
node height. `node .tmp/it2-probe.mjs [extraCandidate.css]` to A/B a CSS patch.
Note: **width = max(sizePx, …) ≥ height**, so width == height is the worst case.

Measured (real CSS, before the title clamp): reveal at node 122, but the slot is
clipped to 30–51px until node **150**. With the 2-line title clamp: full 56px at
exactly **122**, across fonts 12/13/14, short/long title, 0/1/4 chips.

## Decisions a clone must not re-litigate
1. Floor = `THUMBNAIL_REVEAL_CONTENT_BOX_PX (104) + NODE_VERTICAL_CHROME_PX (18)`
   = 122. The 104 stays module-private; the chrome is exported so the guard can
   pin it. Do NOT collapse this back into a literal.
2. The S1 "knife edge" was fixed in **CSS, not by inflating the floor**: inside
   the reveal block, `[data-preview="thumbnail"] .title { -webkit-line-clamp: 2 }`.
   Rejected: floor ≈150 (would push nearly every image node to maxPx 160) and
   dropping the title's `flex-shrink: 0` (line-clamp is line-count based, so
   shrinking just clips text mid-line).
3. Everything iteration 1 got right is untouched: score never floored, keyed on
   `firstImagePath`, `max(sizePx, min(floor, maxPx))` clamp order.

## Still open / handed off
- `docs-internal/tickets/ticket-e2e-content-box-vs-node-height-comments.md` (S3)
- `docs-internal/tickets/ticket-e2e-thumbnail-floor-rendering-proof.md` (B2's
  rendering proof — deliberately NOT written blind, since e2e cannot run here)
- `npm run test:e2e` NOT run. E7 (`maxPx: 96`) is unaffected (`min(122,96)=96`),
  but other suites may see image nodes grow 104 → 122.
- Wrapping (multi-row) attachment strip still clips the slot in principle; my
  4-chip case did not wrap at 104px content width, so it is unmeasured.

---

# Iteration 3 (closing pass on the reviewer's non-blocking follow-ups; verdict was READY)

## State: COMPLETE. Working tree only, no commit, no change_log entry.
`npm test` **1094/1094** (baseline 1093, +1), `npm run check` exit 0. `test:e2e` not run (out of scope).

## Diff surface (3 files)
- `src/view/thumbnailDensityThreshold.test.ts` — new `DECLARES_SIZE_CONTAINER`
  regex + one BDD case pinning `container-type: size` on `.vicinity-graph-node`.
- `src/engine/constants.ts` — comment only, on `NODE_VERTICAL_CHROME_PX`
  (the central-node aside now states the real condition, `maxPx >= 124`).
- `docs-internal/tickets/ticket-attachment-strip-overflows-onto-title.md` — NEW.

## Red-first evidence (do not re-do)
Flipped `container-type: size` → `inline-size` in `graph-view.css`:
`1 failed | 4 passed` — i.e. ONLY the new case bit, which is exactly the silent
degradation the reviewer described. CSS restored via `git checkout --`; log in
`.tmp/it3-red.txt`.

## Regex note
`DECLARES_SIZE_CONTAINER = /(?:^|\n)\tcontainer-type:\s*size;/` is anchored to a
line start and applied to `nodeRootDeclarations()` ONLY, so a `container-type` on
any other rule cannot satisfy it. It uses `(?:^|\n)` rather than the file's
existing `\n\t` style because `container-type` is currently the first declaration
after the custom property and could legitimately move to line 1 of the block.

## Deliberately NOT done
- Multi-row chip strip over the title: ticketed, not fixed (reviewer PROVED it
  pre-existing with the old 4-line clamp). Ticket names the two `.out/` screenshots
  and explicitly says the overlap MECHANISM was not isolated — do not trust a
  mechanism claim that was never measured.
- Nothing else touched. No refactors.
