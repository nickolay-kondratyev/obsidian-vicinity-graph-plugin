# IMPLEMENTATION_REVIEWER — private working notes

Branch `node-sizing-image-space`, single commit `898c48f`. Iteration 1 of review.

## Verification actually performed (not inferred)

- `npm test` → **PASS**, 81 files / 1090 tests (`.tmp/review-npm-test.txt`).
- `npm run check` → **PASS** (tsc strict + e2e tsconfig) (`.tmp/review-npm-check.txt`).
- `npm run test:e2e` NOT run (out of scope per task).

## The decisive experiment

Probes written to `.tmp/probe-threshold.mjs` and `.tmp/probe-usable.mjs` — real
Chromium (playwright chromium-1228, same engine family as Obsidian's Electron),
loading the SHIPPED `styles.css` plus Obsidian's spacing variables
(`--size-4-N = 4N px`), with the node markup `NoteNode.tsx` renders and a
wrapper sized like React Flow sizes it (`nodeDimensionsPx`).

Swept node heights 60→170px, read `getComputedStyle(thumbnail).display`:

- attachments (`min-height: 72px`) first appear at node height **90**
- thumbnail (`min-height: 104px`) first appears at node height **122**

Cause: CSS size container queries evaluate against the container's **content
box**. `.vicinity-graph-node` is `box-sizing: border-box` with
`padding: var(--size-4-2)` (8px) + `1px` border ⇒ content box = `sizePx - 18`.
So `sizePx = 104` ⇒ content box 86 ⇒ query does not match ⇒ `display: none`.

Second probe (usable area, thumbnail visible height clipped by node padding
edge), narrow node (120px wide), 2-line title, attachment strip present:

| node h | thumbnail visible px |
|---|---|
| 104 | 0 (display none) |
| 122 | 35 (clipped; slot wants 56) |
| 130 | 43 |
| 140 | 53 |
| ~143 | 56 (full slot) |

Wide node (250px, single/2-line title) reaches the full 56px slot at 122.
So even the corrected content-box arithmetic (122) is a knife edge; ~140 is the
honest "the image is actually displayed" number for the narrow case.

## Claims by the implementer that I verified TRUE

- `sizeScore` untouched by the floor (`NodeSizer.ts:63-69`); truncation ranking in
  `NodePriorityChain` unaffected.
- Keyed on `node.firstImagePath`, not on the resolved preview kind ⇒ the
  `nodePreviewPreference` independence invariant holds (its pinning test at
  `NodeSizer.test.ts:375+` still green).
- Floor never shrinks a node, including under inverted `minPx > maxPx`
  (outer `Math.max`). Hand-checked: min 200/max 50 ⇒ floor `min(104,50)=50`,
  sizePx ∈ [50,200] ⇒ never lowered. (Claimed in JSDoc, NOT covered by a test.)
- `clampSizingSettings` runs before the floor (`NodeSizer.ts:53`), so `settings.maxPx`
  in the cap is already bounded [1,400].
- Engine purity intact; `THUMBNAIL_VISIBLE_MIN_NODE_PX` exported via `src/engine/index.ts`;
  the new CSS-parsing test lives in `src/view/`, importing from `../engine` (allowed).

## Guard-test robustness assessment

`src/view/thumbnailDensityThreshold.test.ts` is NOT vacuous-passable in the usual
ways: test 1 asserts exactly ONE container query reveals the thumbnail, so a
selector rename / `display` change collapses the match count to 0 and fails.
`REVEALS_THUMBNAIL` cannot accidentally match `.vicinity-graph-node__thumbnail img`
(the `\s*\{` after the class name rules it out). Good regex hygiene.

BUT it pins the WRONG relationship: `cssThreshold === engineConstant`. The true
relationship is `engineConstant === cssThreshold + verticalChrome`. So it is a
guard that passes while the shipped feature does nothing — exactly the failure
mode the prompt warned about, arrived at by a different route.

## Other observations

- No `change_log` entry for this change (top entry is still the canvas fix).
- e2e `nodeOutline.e2e.ts:58-61` already encodes the same content-box
  misconception ("72–104px band" as NODE sizes). It does not go red because it
  only asserts the HIDDEN side at 96px and the visible side at 160px. Pre-existing;
  worth correcting alongside.
- E7 (`setMaxNodeSizePx(96)`) is safe under the new floor: `min(104, 96) = 96`.
- Central-node test is near-tautological (160 > 104 either way) — NIT only.

## Verdict reached

NEEDS-ITERATION. Design/architecture/tests are good work; the single number the
whole feature rests on is wrong by the node's chrome, so the requirement is not
met. Everything else is minor.
