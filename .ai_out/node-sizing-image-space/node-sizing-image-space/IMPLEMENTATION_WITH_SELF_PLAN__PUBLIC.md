# Node sizing: guarantee image-bearing nodes have space for their image

**Status: DONE.** Working tree only (not committed, per instructions). `npm test`
1090/1090 pass, `npm run check` clean.

## What was wrong

`sizePx` was purely score-driven and node height = `sizePx` verbatim, while the
thumbnail is only revealed by `@container (min-height: 104px)`. A note that HAS an
image but scores low was sized (down to `minPx`, default 40px) far below that
threshold, so its image was silently never shown.

## What changed

1. **`src/engine/constants.ts`** — new `THUMBNAIL_VISIBLE_MIN_NODE_PX = 104`
   (exported from `src/engine/index.ts`), documented as knowledge mirrored in CSS.
2. **`src/engine/NodeSizer.ts`** — `NodeSizer.withImageSpace(node, sizePx, settings)`
   applies the floor:
   `Math.max(sizePx, Math.min(THUMBNAIL_VISIBLE_MIN_NODE_PX, settings.maxPx))`
   for nodes with `firstImagePath !== undefined`.
3. **`src/view/thumbnailDensityThreshold.test.ts`** (new) — parses `graph-view.css`,
   asserts exactly one container query reveals the thumbnail and that its
   min-height equals the TS constant. Kills the silent CSS/TS drift.
4. **CSS comment** at the density ladder now names the mirroring constant + guard.
5. **Docs** — `high-level-plan.md` "### Sizing" and the rendering/preference bullet;
   one README line under *Sizing*.

## Decisions and rationale

- **Floor moves `sizePx` only, never `sizeScore`.** `sizeScore` is pure relevance and
  is *also* the truncation tiebreaker (`NodePriorityChain`, `GraphTruncator`). Raising
  it would let "has an image" promote a note over more relevant ones and silently
  change which nodes survive the node cap. Covered by a dedicated test.
- **Keyed on `firstImagePath !== undefined`, NOT on the resolved preview kind.** The
  invariant in `NodeSizer.test.ts` "node preview preference independence" (flipping
  the Preview pill must stay a data-only refresh, never cross
  `SIZE_RELAYOUT_THRESHOLD`) forbids `sizePx` moving with `nodePreviewPreference`.
  Consequence, accepted and documented: a note with an image reserves the height even
  while the Preview preference currently shows its **outline** in that slot. That is
  the only option that keeps the invariant; the alternative (key off
  `nodePreviewChoice`) was rejected outright.
- **Clamp form `max(sizePx, min(floor, maxPx))`, not `min(max(...), maxPx)`.** The
  floor is capped by the user's `maxPx` so an explicit maximum is never overruled;
  the outer `max` means the rule can only ever GROW a node — which matters because
  `clampSizingSettings` clamps `minPx`/`maxPx` per field and therefore permits an
  inverted `minPx > maxPx`, where a naive final `min(_, maxPx)` would SHRINK nodes.
  Tested (`already above the floor → untouched`).
- **Centrals need no special case:** score 1 → `sizePx = maxPx >= min(floor, maxPx)`.
  Asserted anyway, since it is the property that matters, not the mechanism.
- **DRY of the 104px:** no repo mechanism exists to share numbers TS→CSS (styles.css
  is a plain concatenation of `src/view/*.css` at build; no CSS-in-JS, no token
  generator). Rather than invent a build step for one number (over-engineering), the
  duplication is guarded by a test in the same style as `importGuard.test.ts`. The
  guard is non-vacuous: it fails if the query disappears, duplicates, or moves.

## Also in scope: `contain` vs `cover`

`ticket-dev-vault-recognizable-thumbnail.md` (resolved) claimed an acceptance
criterion of "fixed-height cropped **cover**"; `graph-view.css` deliberately uses
`object-fit: contain` with a WHY comment. **No visual behavior was changed.** The
stale criterion is corrected in place (code is authoritative) and the genuine visual
question is now a human call in
`docs-internal/tickets/ticket-thumbnail-contain-vs-cover-decide.md` — it matters more
now, since the floor makes thumbnails appear on far more nodes than before.

## Tests

New, all BDD, one behavior each:

- `src/engine/NodeSizer.test.ts` → `describe("NodeSizer image-bearing height floor")`:
  bottom-scoring image note is floored; bottom-scoring non-image note is not; floor
  capped at `maxPx`; already-tall image note untouched; central image note gets full
  central height; `sizeScore` stays the composed relevance.
- `src/view/thumbnailDensityThreshold.test.ts`: exactly-one-query guard + threshold
  equality.

Started red (4 failures incl. the CSS guard), then green. **No existing test was
weakened, changed or deleted** — in particular the preference-independence test still
passes untouched.

`npm run test:e2e` was **NOT run**: it drives a real Obsidian (Electron) and is not
available unattended. A human/e2e pass should eyeball that low-relevance image notes
now render their thumbnail.

## Flag for the human

The floor makes image-bearing nodes at least 104px where they could previously be
40px, so **an image-heavy vicinity lays out larger** (elk gets bigger boxes). This is
the intended trade of the ticket, but it is a real layout-density change worth seeing
in the dev vault.
