# e2e: prove a low-scoring image note really renders its thumbnail

**Status:** open · **Type:** test coverage

## Why

The preview-reveal floor (`PREVIEW_VISIBLE_MIN_NODE_PX`) is arithmetic over CSS
knowledge: reveal threshold + node chrome, with the title budgeted to 2 lines so
the 56px slot is not clipped. `src/view/nodeDensityThresholds.test.ts` guards
the arithmetic, but **no test in `npm test` runs a layout engine**, so a future
CSS change that quietly re-breaks the reveal (the exact failure this feature was
shipped to fix — the first attempt was off by the node's 18px chrome and rendered
`display: none` at every size) would still go green.

Only a real rendering assertion closes that hole, and the repo already has the
Playwright harness for it.

## Done when

`e2e/` asserts, in the spirit of `nodeOutline.e2e.ts`, that a **non-central,
low-scoring** image-bearing note (fixtures `outline-cover.md` / `pic.jpg` from
`scripts/setup-dev-vault.sh`) has a `.vicinity-graph-node__thumbnail` that is
`toBeVisible()` with a bounding box at least the 56px slot tall — i.e. the floor
is proven end to end, not derived.

## Notes

`.tmp/it2-probe.mjs` (throwaway, not source-controlled) is a standalone
Playwright probe that measures visible thumbnail height against
`src/view/graph-view.css` across node heights, fonts, title lengths and strip
sizes. Useful for re-measuring the budget; it is NOT a substitute for the e2e,
because it renders hand-written markup rather than the real view.
