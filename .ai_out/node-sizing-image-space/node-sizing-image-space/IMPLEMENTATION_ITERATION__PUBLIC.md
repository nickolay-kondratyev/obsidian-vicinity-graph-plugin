# IMPLEMENTATION_REVIEW — iteration 2 (verification pass)

Reviewed: `afed443` ("fix(sizing): account for node chrome in the image-space floor,
enforce the title budget"), on top of iteration 1 `898c48f`.
Iteration-1 record stays in `IMPLEMENTATION_REVIEW__PUBLIC.md`.

## Gates I ran myself

| Command | Result | Log |
|---|---|---|
| `npm test` | **PASS** — 81 files, **1093 tests** (was 1090; +3 new) | `.tmp/rev2-npm-test.txt` |
| `npm run check` | **PASS** — `tsc -noEmit` for `src/` and `e2e/`, no output | `.tmp/rev2-npm-check.txt` |
| `npm run test:e2e` | NOT run (needs real Obsidian) — see *Merge gate* | — |

No `sanity_check.sh` in this repo.

## How I verified (independent, not from the implementer's notes)

Rebuilt the shipped stylesheet the way `esbuild.config.mjs` does
(`@xyflow/react/dist/style.css` + `graph-view.css` + `node-outline.css` +
`settings-tab.css` + `segmented-control.css` → `.tmp/rev2-styles.css`; the
repo's `styles.css` is untracked and was stale, so I did not measure it),
rendered the real `NoteNode` markup in Playwright Chromium with Obsidian's
spacing/font variables, and swept node heights. Probes: `.tmp/rev2-probe*.mjs`,
screenshots in `.out/`.

---

## 1. B1 — chrome derivation and the 122 floor — **RESOLVED**

Chrome derivation checked against the source of truth
(`src/view/graph-view.css:72-92`): `.vicinity-graph-node` is `box-sizing:
border-box`, `container-type: size`, `border: 1px solid …`, `padding:
var(--size-4-2)` (= 8px). Vertical chrome = `2 * (1 + 8)` = **18**. Matches
`NODE_VERTICAL_CHROME_PX` (`src/engine/constants.ts:159`) exactly.

Measured reveal boundary on the rebuilt CSS — `getComputedStyle(thumbnail).display`
per node height, six markup variants (narrow 120px / wide 250px × short / long
title × 0, 2, 6, 12 chips):

| node height | 104 | 118 | 120 | **121** | **122** | 130 |
|---|---|---|---|---|---|---|
| thumbnail `display` | none | none | none | **none** | **block** | block |

122 is exactly the first height that reveals, in every variant. The constant is
the smallest correct value, with no slack and no over-shoot.
`THUMBNAIL_VISIBLE_MIN_NODE_PX = 104 + 18 = 122` (`src/engine/constants.ts:177`).

## 2. B2 — the guard test — **RESOLVED**

`src/view/thumbnailDensityThreshold.test.ts` now pins the right relation
(`:65-67`, `engine === parsedCssThreshold + NODE_VERTICAL_CHROME_PX`) plus
`parsedNodeVerticalChromePx() === NODE_VERTICAL_CHROME_PX` (`:61-63`) as its own
case, so neither half can drift alone.

Vacuous-pass analysis — it cannot:
- `thumbnailRevealBlocks()[0]?.minHeightPx ?? 0`: the `?? 0` looks like a soft
  fallback, but the sibling case asserts `toHaveLength(1)`, and `0 + 18 = 18 ≠ 122`
  would fail anyway. Same for `?? ""` in the line-clamp case.
- `REVEALS_THUMBNAIL` still cannot match `.vicinity-graph-node__thumbnail img`
  (the `\s*\{` guard), so a selector rename collapses the count to 0 and fails.

CSS-refactor survival of the new parses (`:34-36`) — every plausible refactor
fails **loudly** via the `throw`, none degrades silently:

| refactor | outcome |
|---|---|
| `padding: var(--size-4-2) var(--size-4-3)` (shorthand, 2 values) | still parses top/bottom correctly — **right answer** |
| `padding-top`/`padding-bottom` per side | no match → `throw` → red |
| `padding: 8px` (literal) | no match → `throw` → red |
| `border-width: 1px` / `border: var(--x)` | no match → `throw` → red |
| `.vicinity-graph-node` rule renamed/removed | `throw` → red |

One residual gap (NOT blocking, see follow-ups): the guard does not pin
`container-type: size` on the node root. Switching it to `inline-size` would make
the min-height query never match — thumbnails invisible at every size — and all
four cases would still be green.

## 3. S1 — the usable 56px slot at 122 — **RESOLVED**

Measured visible thumbnail height (clipped by the node's `overflow: hidden`
padding box), plus a per-pixel `elementFromPoint` hit test down the thumbnail's
centre line to catch *occlusion*, not just clipping:

| case (node height 122) | thumbnail box | unobstructed px |
|---|---|---|
| narrow 120px, long title, 2 chips | 56 | **56 / 56** |
| narrow 120px, long title, **6 chips (wraps to 3 rows)** | 56 | **56 / 56** |
| narrow 120px, long title, **12 chips (wraps)** | 56 | **56 / 56** |
| wide 250px, long title, 12 chips | 56 | **56 / 56** |
| narrow, long title, no chips | 70 | 70 |

So the worst case I built in iteration 1 (which measured **35/56**) is fixed, and
the case the implementer flagged as unmeasured — a **wrapping multi-row
attachment strip** — also keeps the full 56px slot. I additionally swept
`--font-ui-smaller` 11→20px: the slot stays 56/56 at 122 throughout (the title is
clamped by *lines*, and the excess is absorbed by the strip, not the thumbnail).

Clamp scoping verified by computed style, not by reading the selector:
`-webkit-line-clamp` = **2** for `data-preview="thumbnail"`, **4** for
`data-preview="outline"` and for `data-preview="none"`. Correct
(`src/view/graph-view.css:256-258`).

Trade-off judgement: truncating a long title to 2 lines *only when the image is
showing* is the right call versus a ~150px floor against a default `maxPx` of 160
— that would have pinned nearly every image-bearing note at maximum size. The
full title remains in the element's `title` tooltip (`NoteNode.tsx:92`). Accept.

## 4. Regression check — **INTACT**

`src/engine/NodeSizer.ts` is untouched by iteration 2; re-verified on the current
tree:
- `sizeScore` is the pure composed score; the floor moves `sizePx` only
  (`NodeSizer.ts:62-69`) → `NodePriorityChain` truncation ranking unaffected.
- Keyed on `node.firstImagePath`, not the resolved preview kind
  (`NodeSizer.ts:91-96`) → `nodePreviewPreference` independence holds.
- `clampSizingSettings` runs first (`:53`); the outer `Math.max` keeps the floor a
  floor under inverted `minPx > maxPx` — and that is now covered by a test that
  actually bites (`NodeSizer.test.ts:358-362`), closing iteration 1's S2.
- Engine purity intact: `constants.ts` gained no imports; the CSS-parsing guard
  lives in `src/view/`; `importGuard.test.ts` green.

## 5. The two new tickets — **correct to defer, and actionable**

- `docs-internal/tickets/ticket-e2e-content-box-vs-node-height-comments.md` —
  correct to defer: it is pre-existing comment/constant drift in
  `e2e/nodeOutline.e2e.ts`, the tests genuinely pass (they probe 96 and 160, never
  the boundary), and patching it inline would have widened this diff. States the
  exact lines and the right numbers. Actionable.
- `docs-internal/tickets/ticket-e2e-thumbnail-floor-rendering-proof.md` — the
  judgement call to file rather than write an e2e blind (no real Obsidian
  available here) is sound: an unrunnable e2e on the release gate is worse than a
  ticket. Names fixtures (`outline-cover.md` / `pic.jpg`), the selector, and the
  56px assertion. Actionable. This is the ticket that closes the "no layout
  engine runs in `npm test`" hole — including the `container-type` gap in §2.

## 6. Documentation — **ACCURATE**

- `README.md:62-66` — "shown in full (122px) … set max below 122 and thumbnails
  stay hidden". Verified true: `min(122, maxPx)` with `maxPx < 122` leaves the
  content box under 104, so the query does not match.
- `docs-internal/plan/high-level-plan.md:59-61, 100` — content-box-vs-node-height
  distinction, the `104 + 18` composition, and the title-clamp rationale are all
  stated and all match the code.
- `src/view/graph-view.css:229-238` and `node-outline.css:17-22` comments corrected.

---

## Follow-up ticket suggestions (none blocking)

1. **Pin `container-type: size` in the guard test.** One extra regex in
   `thumbnailDensityThreshold.test.ts` closes the last silent-degradation path
   (`inline-size` would hide every thumbnail with all four cases green). Cheap,
   and squarely in the spirit of B2.
2. **Multi-row attachment strip overlaps the title (pre-existing).** At 122px with
   3+ attachment extension groups on a narrow node, the strip (`flex-wrap: wrap`
   + `flex-shrink: 0`) overflows and paints over the title —
   `.out/rev2b-h122-n12.png`. I confirmed this is **not** introduced here: forcing
   the old 4-line clamp reproduces it identically (`.out/rev2c-old-clamp4.png`).
   The thumbnail slot survives intact either way. Worth its own ticket.
3. **Central-node chrome edge case.** `constants.ts:156-158` says centrals
   (2px border ⇒ chrome 20) "never need the floor". True only for `maxPx ≥ 124`:
   at `maxPx` 122–123 a central image note hides its thumbnail while a
   non-central one at 122 shows it. Narrow, pre-existing, but the comment
   overstates.
4. **No `change_log` entry** for `node-sizing-image-space` (top entry is still the
   canvas fix). Raised in iteration 1, still open — should land before merge.

## Merge gate (not a review finding)

`npm run test:e2e` has not been run in either iteration and needs a real Obsidian.
I scanned `e2e/` for exposure: E7's `setMaxNodeSizePx(96)` is safe by construction
(`min(122, 96) = 96`, still under the reveal), and no e2e asserts a node height in
the 104–122 band. Still, image-bearing nodes now grow 104→122, so a full e2e pass
is required before merge.

---

**Verdict: READY**
