# The inboard pin can cover a wide-but-short node's centre-click target

**Status:** open · **Type:** bug (CSS/UX, introduced by the pin→top-right move) · **Severity:** low

Moving the pin chip beside the gear (`_tickets/move-the-pin-next-to-the-gear-to-the-right.md`,
commit `eaf934b`) placed the pin **inboard** of the gear: its `right` offset is
`inset + size + gap`, so its far (leftward) edge reaches `inset + 2·size + gap`
into the node's padding box — versus the gear's corner reach of `inset + size`.

The centre-clearance ladder in `src/view/graph-view.css` — and the guard
`chipCentreCoveredContentBoxPx` in `src/view/nodeDensityThresholds.test.ts` —
models every chip as a **corner** chip with reach `inset + size`, applied
symmetrically on both axes. The step-down / withhold rungs fire only when
**both** the node's width and height are small (`@container (max-height: …) and
(max-width: …)`). That is correct for the gear, but the pin now reaches ~twice
as far **horizontally**, so:

- **Vertical** clearance is unchanged (both chips share the top edge → reach
  `inset + size` down from the top).
- **Horizontal** clearance is not guarded for the pin. On a node whose content
  box is short (≤ ~32px tall, so the pin's top-anchored box straddles the
  vertical centre) **and** moderately wide (≈ 36–76px, so the step-down does NOT
  fire because width > 32px), the hover-revealed pin sits over the node's
  horizontal centre. Its `onClick` `stopPropagation`s, so a click there toggles
  the pin instead of opening the note.

**Reachability:** auto-sized nodes are square and ≥ 40px, so they never land in
this band (a small square node hits the compact/withhold rungs). Only a manual
drag-resize to a wide-and-short shape (hard min `NODE_OVERRIDE_HARD_MIN_PX` =
24px) reaches it. Non-destructive — the pin toggles and is trivially undone, and
the rest of the node still opens the note. Filed rather than fixed to avoid
redesigning the ladder for a narrow edge.

**Likely fix (if pursued):** treat the two adjacent top-right chips as one
bounding footprint — reach `inset + 2·size + gap` on the width axis, `inset +
size` on the height axis — and make the step-down / withhold rungs asymmetric
(a wider `max-width` than `max-height`). This means the ladder and its
`chipCentreCoveredContentBoxPx` guard must model the pin's horizontal offset,
not just a symmetric corner reach.

**Done when:** a hover-revealed pin never overlaps the centre-click target of any
node the size ladder still renders chips on (asserted by the density-threshold
suite over the pin's actual horizontal reach, not just the gear's corner reach).
