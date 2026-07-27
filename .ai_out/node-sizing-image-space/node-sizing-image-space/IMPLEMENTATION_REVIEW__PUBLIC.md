# IMPLEMENTATION REVIEW — `node-sizing-image-space` (commit `898c48f`)

## Gate results (run by me, not reported second-hand)

| Command | Result |
|---|---|
| `npm test` | **PASS** — 81 files, 1090 tests (`.tmp/review-npm-test.txt`) |
| `npm run check` | **PASS** — strict tsc for `src/` and `e2e/` (`.tmp/review-npm-check.txt`) |
| `npm run test:e2e` | not run (excluded from this review) |

No `sanity_check.sh` in this repo.

## Summary

`NodeSizer` now floors `sizePx` (never `sizeScore`) for any node whose
`firstImagePath` is defined, at `min(THUMBNAIL_VISIBLE_MIN_NODE_PX, maxPx)`, so a
low-relevance note with an image is supposed to be tall enough for the stylesheet
to reveal its thumbnail. Plus a CSS-parsing drift guard, doc updates, and a new
`[decide]` ticket for `contain` vs `cover`.

The **shape** of this change is right, and several of its judgement calls are
genuinely good: keying on the stable `firstImagePath` fact rather than the
resolved preview kind (preserving the `nodePreviewPreference` independence
invariant), moving pixels only and leaving `sizeScore` pure for
`NodePriorityChain`, capping by the user's `maxPx`, and recognising the duplicated
104 as knowledge that needs a guard. I verified each of those claims
independently and they all hold.

The problem is the number itself. **104 is the wrong constant, and at 104 the
feature does nothing at all** — measured, not reasoned. Details below.

---

## BLOCKING

### B1. The floor does not reveal the thumbnail — CSS container queries measure the CONTENT box

`src/engine/constants.ts:85` (`THUMBNAIL_VISIBLE_MIN_NODE_PX = 104`) ·
`src/engine/NodeSizer.ts:91-96` · `src/view/graph-view.css:240`

`@container (min-height: 104px)` is evaluated against the query container's
**content box**. `.vicinity-graph-node` (`graph-view.css:72-92`) is
`box-sizing: border-box` with `padding: var(--size-4-2)` (8px) and a `1px` border,
and React Flow sizes it to exactly `sizePx` (`graphIdentity.ts:53-58` →
`flowMapping.ts:188-194`). So:

```
content box height = sizePx - 2*1(border) - 2*8(padding) = sizePx - 18
```

A node floored at `sizePx = 104` has an 86px content box — **below** the query —
so `.vicinity-graph-node__thumbnail` stays `display: none`. The floor changes
node geometry and shows nothing.

I measured this in real Chromium against the shipped `styles.css` with the exact
`NoteNode.tsx` markup and Obsidian's spacing variables (`--size-4-N = 4N px`),
sweeping node heights 60→170px:

- attachment strip (`min-height: 72px`) first appears at node height **90**
- thumbnail (`min-height: 104px`) first appears at node height **122**

At 104 the computed `display` is `none` in every configuration (title short/long,
attachment strip present/absent). Probe scripts: `.tmp/probe-threshold.mjs`,
`.tmp/probe-usable.mjs`.

**Suggested resolution** — make the arithmetic explicit and single-sourced rather
than silently assuming border-box:

```ts
// src/engine/constants.ts
/** CSS content-box height at which graph-view.css reveals the thumbnail. */
const THUMBNAIL_REVEAL_CONTENT_BOX_PX = 104;
/** .vicinity-graph-node chrome outside the container-query box: (1px border + 8px padding) * 2. */
const NODE_VERTICAL_CHROME_PX = 18;
export const THUMBNAIL_VISIBLE_MIN_NODE_PX = THUMBNAIL_REVEAL_CONTENT_BOX_PX + NODE_VERTICAL_CHROME_PX;
```

and extend `thumbnailDensityThreshold.test.ts` to parse the node's
`padding`/`border-width` from the same stylesheet so the `+18` cannot drift either
(see B2). Note `[data-tier="main"]` / `[data-tier="pinned-central"]`
(`graph-view.css:110-118`) use a **2px** border → chrome 20 — centrals are at
`maxPx` anyway, so I would document that rather than model it.

### B2. The drift guard pins the wrong invariant, so it passes while the feature is broken

`src/view/thumbnailDensityThreshold.test.ts:36-38`

Mechanically the guard is well built — I tried to break it and could not in the
usual ways. `REVEALS_THUMBNAIL` cannot accidentally match
`.vicinity-graph-node__thumbnail img` (the `\s*\{` after the class name rules that
out), and the "exactly one container query reveals the thumbnail" assertion means
a selector rename or a `display` change collapses the match count to 0 and fails
loudly rather than vacuously. Credit where due.

But it asserts `cssThreshold === engineConstant`, and the true relationship is
`engineConstant === cssThreshold + verticalChrome`. It is therefore a green test
guarding a feature that does nothing — the precise failure mode a guard is
supposed to prevent.

**Suggested resolution:** assert the real relationship (parse the container-query
threshold AND the `.vicinity-graph-node` padding/border from the stylesheet), and
add ONE real rendering proof. This class of bug is invisible to any test that does
not run a layout engine; the repo already has the Playwright harness for exactly
this. An e2e in the spirit of `nodeOutline.e2e.ts` — a *non-central, low-scoring*
image-bearing note whose `.vicinity-graph-node__thumbnail` is
`toBeVisible()` with a non-zero bounding box — is the only guard that would have
caught this, and it is cheap given the existing fixtures (`pic.jpg`,
`outline-cover.md`).

---

## SHOULD-FIX

### S1. Even the corrected 122 is a knife edge — the title squeezes the thumbnail

Measured visible thumbnail height (clipped at the node's bottom padding edge) for
a **narrow** node (the floored width, ~120px), a title that wraps to 2 lines, and
an attachment strip present:

| node height | thumbnail visible px (slot wants 56) |
|---|---|
| 104 | 0 (`display: none`) |
| 122 | 35 — clipped |
| 130 | 43 |
| 140 | 53 |
| ~143 | 56 (full slot) |

Why: `.vicinity-graph-node__title` is `flex-shrink: 0` with `-webkit-line-clamp: 4`
(`graph-view.css:136-147`), so the title takes its lines first and the thumbnail's
`min-height: 56px` (`:155`) overflows into `overflow: hidden`. A wide node (250px,
title on one/two lines) does reach the full 56px at 122, so the bad case is a
*medium-length* title on a floored-width node — which is a common note title, not
an exotic one.

The ticket says "enough space to **actually display** the image". 35px of a 56px
slot is arguably not that.

**Suggested resolution:** pick one and state it in the plan doc —
(a) size the floor as `chrome + titleAllowance + gap + thumbnailSlot` (≈140) and
name the parts, or (b) inside the `@container` block let the title shrink when a
thumbnail is present (drop `flex-shrink: 0` / clamp to 2 lines), which keeps the
floor at the reveal threshold. (b) is the cheaper, more robust option and matches
the repo's "prefer CSS over JS" rule. Either way, prove it with the B2 rendering
test rather than arithmetic.

### S2. The JSDoc claims inverted-settings robustness that no test covers

`src/engine/NodeSizer.ts:86-89` explicitly claims the floor holds "even under
inverted `minPx > maxPx` settings, which the per-field clamp permits". I
hand-verified it is true (min 200 / max 50 ⇒ floor `min(104,50)=50`, sizePx ∈
[50,200], never lowered) — but a load-bearing claim in a comment with no test is
how the next refactor breaks it. `clampSizingSettings` (`constants.ts:171-187`)
clamps each field independently, so the state is reachable at the engine boundary.

**Suggested resolution:** one BDD case in the existing new describe block —
`WHEN sizing settings are inverted (minPx > maxPx) THEN the image floor never
shrinks a node`.

### S3. Stale content-box misconception in the e2e comments (pre-existing, now load-bearing)

`e2e/nodeOutline.e2e.ts:17-18, 58-61` describe 72/104 as **node** sizes
("the 72–104px band", "the 104px threshold"). Same misreading as B1. Those tests
stay green only because they assert the hidden side at 96px and the visible side
at 160px, never the boundary. Since this change makes the number authoritative,
correct the comments in the same pass (`ATTACHMENTS_ONLY_BAND_PX` is really
90–121 in node px).

I confirmed the new floor does **not** break E7: it sets `maxPx = 96`, and the
floor is `min(104, 96) = 96`, so nothing moves.

### S4. Docs assert behavior that does not currently happen

- `README.md:63-66` — "a note that has an image is never sized below the height
  where its thumbnail fits". Today it is sized to a height where the thumbnail
  still does not fit. Accurate only after B1.
- `docs-internal/plan/high-level-plan.md:61` — same, plus it calls 104 "the 104px
  container-query threshold below", which reads as a node height throughout the
  doc. Worth one explicit sentence: the CSS number is a **content-box** height and
  the engine constant is that plus the node chrome.

Otherwise the doc edits are good: succinct, placed with the knowledge they
describe, and the WHY (`keys off the fact, not the preference`) is exactly the
thing a maintainer would otherwise "simplify" away.

### S5. No `change_log` entry

Per the repo/global convention, top-level changes get a `change_log` entry; the
newest entry is still the canvas fix. Add one when this lands.

---

## NIT

- `src/engine/NodeSizer.test.ts:355-365` — "WHEN an image note is central THEN it
  still gets full central height, not the floor" cannot fail via the floor
  (`maxPx = 160 > 104`, and the floor only grows). It is a fine central-sizing
  regression test, but its stated behavior is not the one it captures. Either
  rename it, or make it bite by setting `maxPx` below the floor so the assertion
  distinguishes "central path" from "floor path".
- `src/engine/constants.ts:75-86` — the constant's name says `MIN_NODE_PX` while
  its value is the CSS content-box number. Renaming per B1 removes the ambiguity
  at the same time.

---

## Things I checked and found correct — no action needed

- **`sizeScore` untouched.** `NodeSizer.ts:63-69` floors pixels only; the
  truncation tiebreaker in `NodePriorityChain` is unaffected, and the new test at
  `NodeSizer.test.ts:367-373` pins it.
- **`nodePreviewPreference` independence holds.** Keying on `firstImagePath`
  rather than the resolved preview kind is the right call and the existing
  invariant test (`NodeSizer.test.ts:375+`) stays green.
- **Settings clamped before the floor** (`NodeSizer.ts:53`), so `settings.maxPx`
  in the cap is already bounded — no non-finite geometry can reach the router.
- **Relayout behavior is sane.** Gaining an image (40 → floor) exceeds
  `SIZE_RELAYOUT_THRESHOLD` and relayouts, which is correct since geometry really
  changed; losing one shrinks and reuses layout (`GraphStructureDiff.ts` only
  triggers on growth). No spurious relayouts from a preference flip.
- **Layering intact.** Engine stays pure; the constant is exported through
  `src/engine/index.ts:104`; the CSS-parsing test correctly lives in `src/view/`.
- **No behavior-capturing tests removed or weakened**, no anchor points touched.
  The `contain`/`cover` inconsistency was correctly escalated as a `[decide]`
  ticket instead of being silently "fixed" — that is exactly the right instinct.
- **Security / resource / concurrency:** nothing relevant in this diff.

---

## Documentation Updates Needed

- `README.md:63-66` and `docs-internal/plan/high-level-plan.md:61` — correct once
  B1 lands (see S4); add the content-box-vs-node-height distinction explicitly so
  the next person does not repeat it.
- `e2e/nodeOutline.e2e.ts:17-18, 58-61` — comments (S3).
- No `CLAUDE.md` change required.

---

**VERDICT: NEEDS-ITERATION** — B1 alone means the shipped requirement is not met:
at the chosen constant the thumbnail is still `display: none`. The engineering
around it is solid and should be kept nearly as-is; fix the number, fix what the
guard asserts, and add one rendering-level proof.
