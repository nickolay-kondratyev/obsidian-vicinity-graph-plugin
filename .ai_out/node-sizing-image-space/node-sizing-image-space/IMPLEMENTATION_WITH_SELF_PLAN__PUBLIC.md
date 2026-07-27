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

---

# Iteration 2 — responding to the review

**Status: DONE**, working tree only (iteration 1 is committed as `898c48f`).
`npm test` **1093/1093 pass**, `npm run check` **clean** (`.tmp/it2-test-final.txt`,
`.tmp/it2-check-final.txt`). `npm run test:e2e` still NOT run — see *Not verified*.

Both BLOCKING items are resolved, plus S1, S2 and S4. S3 and the rendering proof
are filed as tickets (explicitly out of scope per instruction). No change_log entry.

## B1 — the floor was 18px short, so the feature was inert

Confirmed independently, in real Chromium against `src/view/graph-view.css` with
the real `NoteNode` markup (probe: `.tmp/it2-probe.mjs`). The chrome numbers were
re-derived from the stylesheet, not taken from the review: `.vicinity-graph-node`
is `box-sizing: border-box`, `border: 1px`, `padding: var(--size-4-2)` = 8px, and
a size container query measures the **content** box → `content = sizePx − 18`.

`src/engine/constants.ts` now composes the floor from named parts:

```
THUMBNAIL_REVEAL_CONTENT_BOX_PX = 104   (module-private: it is CSS's number)
NODE_VERTICAL_CHROME_PX         = 2 * (1 + 8)   (exported, so the guard can pin it)
THUMBNAIL_VISIBLE_MIN_NODE_PX   = 104 + 18 = 122
```

Measured result on the shipped CSS: thumbnail `display: none` at node height 120,
`block` with the **full 56px slot** at 122 — i.e. the floor is now exactly the
smallest height that works, no slack.

## B2 — the guard asserted the wrong relation

`src/view/thumbnailDensityThreshold.test.ts` now parses the node's own chrome out
of the same stylesheet (`border: Npx`, `padding: var(--size-4-N)` resolved through
Obsidian's documented `--size-4-N = N*4px` scale) and asserts
`engine === cssThreshold + parsedChrome`, plus `NODE_VERTICAL_CHROME_PX ===
parsedChrome` as its own case. The two strengths the reviewer credited are kept
verbatim: the non-vacuous `REVEALS_THUMBNAIL` match and "exactly one container
query reveals the thumbnail". It went **red** before the fix and green after.

## S1 — fixed in CSS, not by inflating the floor

Measured worst case (narrowest node — width is `max(sizePx, …)`, so width == height
is the floor's own worst case — long title, chip strip, fonts 12/13/14):

| node height | visible thumbnail px (slot wants 56) |
|---|---|
| 120 | 0 (`display: none`) |
| 122 | **30** before / **56** after |
| 150 | 56 before / 72 after |

So "budget the title into the floor" would have meant a floor of ~150 against a
default `maxPx` of 160 — nearly every image-bearing note pinned at maximum size.
Instead the reveal block now **enforces** the 2 title lines its 104px budget
always claimed to allot:

```css
.vicinity-graph-node[data-preview="thumbnail"] .vicinity-graph-node__title {
    -webkit-line-clamp: 2;
}
```

CSS-first per CLAUDE.md, scoped to `data-preview="thumbnail"` so the outline keeps
its 4-line title, and it makes the 56px slot whole at *exactly* the reveal
threshold. Trade-off, stated: a long note title is truncated at 2 lines when the
node shows its image (the full title stays in the node's `title` tooltip) — chosen
over a 28px-taller floor on every image node. Rejected alternative: dropping the
title's `flex-shrink: 0` — `-webkit-line-clamp` counts lines, not pixels, so
shrinking merely clips text mid-line.

Density trade-off (unchanged in kind from iteration 1, larger in degree): image
nodes now floor at 122px instead of a possible 40px, so image-heavy vicinities lay
out noticeably bigger. That is the ticket's intent, but worth eyeballing in the
dev vault.

## S2 / S4 / NIT

- New BDD case: *WHEN sizing settings are inverted (minPx > maxPx) THEN the floor
  never shrinks an image node* — it bites (a naive trailing `min(_, maxPx)` returns
  50 instead of 162).
- `README.md` and `high-level-plan.md` now state 122px and, in the plan, spell out
  the content-box-vs-node-height distinction and why the title is clamped.
- NIT: the central-node test is renamed to what it actually captures
  ("keeps the full central height"), rather than dressed up to bite.
- Bonus: `node-outline.css`'s "would overflow a 104px node" comment carried the
  same misconception and is corrected.

## Filed instead of fixed here

- `docs-internal/tickets/ticket-e2e-content-box-vs-node-height-comments.md` — S3,
  pre-existing, out of scope by instruction.
- `docs-internal/tickets/ticket-e2e-thumbnail-floor-rendering-proof.md` — B2's
  requested rendering proof. **Judgment call:** `npm run test:e2e` needs a real
  Obsidian and cannot run here, and an e2e written blind is a coin flip on the
  release gate — worse than none. I did do the rendering proof *manually* with the
  probe above; the ticket records both the requirement and the probe.

## Not verified

`npm run test:e2e` was NOT run and no e2e result is claimed. E7 is unaffected by
construction (it sets `maxPx: 96`, and `min(122, 96) = 96`), but other suites may
see image-bearing nodes grow from 104 to 122 — worth a full e2e pass before merge.
Also unmeasured: a *wrapping* (multi-row) attachment strip can still crowd the
slot; my 4-chip case did not wrap at the floor's width, so the case is untested
rather than proven safe.

---

# Iteration 3 — closing pass (reviewer verdict was READY; both follow-ups were worth doing)

Scope was exactly the two non-blocking items from `IMPLEMENTATION_ITERATION__PUBLIC.md`
§"Follow-up ticket suggestions" (1) and (3). Nothing else changed.

## 1. Guard now pins `container-type: size` — the last silent-failure path is closed

`src/view/thumbnailDensityThreshold.test.ts` gained one BDD case:

> WHEN the node root is styled THEN it is a SIZE container, so the reveal's
> min-height query can match

**Made to fail first.** Flipping `.vicinity-graph-node` to
`container-type: inline-size` (which would hide EVERY thumbnail at every size)
gives `1 failed | 4 passed` — only the new case bites, confirming the exact
silent-degradation hole the reviewer identified. CSS restored immediately;
`git status` shows `graph-view.css` unmodified.

The matcher is anchored to a line start and applied only to the parsed
`.vicinity-graph-node` rule body, so a `container-type` elsewhere in the
stylesheet cannot satisfy it. A rename/removal of that rule still throws loudly
via the existing `nodeRootDeclarations()` guard.

## 2. Stale comment on `NODE_VERTICAL_CHROME_PX` corrected

`src/engine/constants.ts` previously claimed centrals "never need the floor".
That is only true for `maxPx >= 124` (central chrome is 20, so their content box
is `maxPx - 20` against the 104 reveal). The comment now states the condition,
names the 122–123 band where a central hides its thumbnail while a non-central of
the same height shows one, and records WHY it stays unmodelled (default `maxPx`
is 160; a per-tier floor is not worth 2px of edge case).

## 3. Multi-row chip strip — ticketed, NOT fixed (as instructed)

`docs-internal/tickets/ticket-attachment-strip-overflows-onto-title.md`. It
records the reviewer's proof that this is pre-existing (identical under the old
4-line clamp), points at both `.out/` screenshots, and — honestly — flags that
the overlap MECHANISM was never isolated, so the fixer must reproduce before
choosing between `max-height` and `flex-wrap: nowrap`.

## Verification (real numbers)

| Command | Result | Log |
|---|---|---|
| `npm test` | **PASS** — 81 files, **1094 tests** (baseline 1093, +1 new) | `.tmp/it3-test.txt` |
| `npm run check` | **PASS** — exit 0, `src/` + `e2e/` | `.tmp/it3-check.txt` |
| `npm run test:e2e` | not run (out of scope; still the merge gate) | — |

No commit, no `change_log` entry — both belong to the top-level agent.
