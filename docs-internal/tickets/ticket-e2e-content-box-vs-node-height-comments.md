# e2e comments confuse the CSS content-box thresholds with node heights

**Status:** open · **Type:** cleanup (comments + constant names only, no behavior)

`e2e/nodeOutline.e2e.ts` describes the density ladder's 72/104 as **node** sizes:

- `:17-18` — "above the 104px threshold that reveals the outline"
- `:58-61` — `BELOW_OUTLINE_THRESHOLD_PX = 96`, `ATTACHMENTS_ONLY_BAND_PX = { min: 72, belowMax: 104 }`

Those numbers are **content-box** heights. `.vicinity-graph-node` is
`box-sizing: border-box` with a 1px border and 8px padding, and React Flow sizes
it to exactly `sizePx`, so a size container query sees `sizePx - 18`. In node px
the bands are really 90–121 (attachments only) and 122+ (thumbnail / outline).
See `PREVIEW_VISIBLE_MIN_NODE_PX` / `ATTACHMENT_ROW_VISIBLE_MIN_NODE_PX` and `src/view/nodeDensityThresholds.test.ts`.

The tests still **pass** — they assert the hidden side at 96 and the visible side
at 160 and never probe the boundary — so this is a comprehension trap, not a bug.
It was left alone deliberately during `node-sizing-image-space` rather than
patched inline in an unrelated diff.

**Done when:** the comments and the two constants read in node px (and say which
box they mean), and `npm run test:e2e` is still green.
