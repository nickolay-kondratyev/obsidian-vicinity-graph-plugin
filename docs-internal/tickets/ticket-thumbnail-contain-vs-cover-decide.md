# Ticket: Node thumbnail — `contain` vs `cover` [decide]

**Status:** OPEN — needs a human visual decision
**Origin:** `node-sizing-image-space` (image-bearing node height floor), where the
inconsistency surfaced.

## The decision

`src/view/graph-view.css` → `.vicinity-graph-node__thumbnail img` currently uses:

```css
object-fit: contain; /* show the whole image, never crop */
```

The original acceptance wording (QA_CHECKLIST §1, echoed by
`docs-internal/tickets/ticket-dev-vault-recognizable-thumbnail.md`) called for a
"fixed-height cropped **cover**". Only one of the two can be right.

**Nothing was changed here** — the shipped `contain` behavior stands until a human
picks. This ticket exists because the choice just became more visible: the new
preview-reveal height floor (`PREVIEW_VISIBLE_MIN_NODE_PX`, `src/engine/NodeSizer.ts`)
means every note with an image now renders a thumbnail, where before only
high-scoring notes did.

## Tradeoff

- **`contain` (today):** whole image always visible; a wide/tall image letterboxes
  against `--background-secondary`, so the slot can look half-empty.
- **`cover`:** the slot is always filled and the graph reads as a uniform grid, but
  the image is cropped — a diagram or screenshot can lose its point.

A middle option: keep `contain` but shrink the letterbox by letting the slot's
aspect follow the image (more CSS, more layout variance — probably not worth it).

## Doing it

One-line CSS change plus its WHY comment; no TS, no test changes. Then re-verify
in `.dev-vault/` (`pic.jpg` is a wide Earth photo, `pic2.jpg` a portrait-ish
moon photo — the two shapes exercise both failure modes).
