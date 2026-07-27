# A wrapping attachment strip paints over the node title on narrow nodes

**Status:** open · **Type:** bug (pre-existing, CSS-only) · **Severity:** low

On a narrow node (~120px wide) at node height 122 with **3+ attachment extension
groups**, the attachment strip wraps to multiple rows and overflows its flex
track, painting on top of the title text.

- `.vicinity-graph-node__attachments` (`src/view/graph-view.css:181-189`) is
  `flex-wrap: wrap` **and** `flex-shrink: 0`, so once it wraps it claims more
  height than the node column has. Its own `overflow: hidden` clips chips
  horizontally but does not cap the number of ROWS.
- Reproduced in Chromium against the real stylesheet during the
  `node-sizing-image-space` review: `.out/rev2b-h122-n12.png`. The exact
  overlap mechanism (overflow vs. negative free space in the column) was not
  isolated — reproduce before choosing the fix.

**Confirmed pre-existing**, NOT introduced by the image-space height floor:
forcing the previous 4-line title clamp reproduces it identically
(`.out/rev2c-old-clamp4.png`). The thumbnail slot keeps its full 56px in both
cases — only the title is obscured. Filed rather than fixed to keep the sizing
diff scoped.

**Likely fix:** cap the strip to a single row (a one-row `max-height`, or
`flex-wrap: nowrap`) so surplus extension groups are clipped by the existing
`overflow: hidden` rather than claiming a second row.

**Done when:** a narrow 122px node with 12 attachment chips shows an unobstructed
title, the thumbnail slot is still 56px, and the wide-node layout is unchanged.
