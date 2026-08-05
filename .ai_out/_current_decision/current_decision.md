# Decision needed — how big should a node with a SHORT outline be?

Ticket: `nid_1mq3t7706vw2kj2kv7ljqlw6l_e` (tags: ui, decide, sizing)

(Supersedes the resolved node-sizing Q1–Q5 note that stood here; those answers now live in
`docs-internal/plan/node-sizing-rethink.md` section 5.)

## Background (30 seconds)

Content-fit sizing shipped: `sizePx = clamp(sum of the regions the node shows, minPx, maxPx)`.

`src/view/graph-view.css` paints those regions only above container-query rungs:

| region | CSS content-box | = node border-box |
|---|---|---|
| preview slot (outline OR thumbnail) | 104px | 122px |
| attachment chip row | 72px | 90px |

The sizer did NOT know that. A note with 2 renderable headings summed to **75px** — above
its title, below the 122px reveal — so it grew ~35px and then rendered a title, dead space
and **no outline**, at every dial setting. Same for a title-only note with an attachment
(61px, chips hidden). That is a real bug, and it is fixed either way.

## What I did (fixed + tested; unit + e2e green)

`NodeSizer.revealFloorPx`: a node whose preview is not `"none"` is floored at 122px, a node
with attachments at 90px — the same rule the thumbnail already had, now shared by every
counted region. `maxPx` still wins over the floor.

## The trade-off you should rule on

**Option 1 (as landed).** Consistent with the thumbnail rule already decided in the rethink.
Cost: at the shipped 40/160 dials, **every note with even ONE heading now renders at
122..160px** — size stops discriminating much among outline-bearing notes, and graphs get
denser in pixels. A title-only note is still 40px (the Q1 headline win is intact).

**Option 2 — lower the CSS rungs instead** so the outline paints at whatever height the
sizer computed (one entry ≈ 57px border-box). Most faithful to "a node is exactly big
enough for what it shows"; keeps small notes small AND visible. Cost: the density ladder
stops protecting a user-dragged tiny node from a squeezed outline (it scrolls, so it
degrades rather than breaks), and `e2e/nodeOutline.e2e.ts` E7 — the behaviour-capturing
"72–104px band shows attachments but not the outline" test — needs your explicit
re-alignment.

**Option 3 — split them:** keep 104px for the thumbnail (its slot is fixed-height and
really does need the room), lower only the outline's rung.

Related: `nid_tclb98q9hxhmcuonamvr4ig1f_e` (hover pin chip hidden below 90px). Option 1
lifts most content-bearing nodes above that threshold; option 2 leaves more nodes below it.

**Question:** 1, 2 or 3?
