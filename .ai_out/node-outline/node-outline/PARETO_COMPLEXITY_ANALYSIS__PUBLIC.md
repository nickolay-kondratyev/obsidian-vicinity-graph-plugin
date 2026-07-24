# PARETO_COMPLEXITY_ANALYSIS — node-outline

Role: `PARETO_COMPLEXITY_ANALYSIS`. Inputs: `CLARIFICATION__PUBLIC.md` (binding,
4 rounds), `DETAILED_PLANNING__PUBLIC.md`, the four IMPLEMENTATION/ITERATION
PUBLIC docs, and the shipped diff `git diff main...HEAD -- src/ e2e/`
(50 files, +1861/−114) read directly.

Verification run locally: `npm test` → **815 passed / 3 failed**, the 3 being
the pre-existing `collidePaddingPx` baseline failures already tracked by
`docs-internal/tickets/ticket-settings-baseline-tests-stale-after-spacing-change.md`.
Nothing this branch added is red.

---

## Verdict: **JUSTIFIED WITH TRIMS**

The requirements, not the implementation, are what cost the money here. Once you
accept the clarified spec — position-based image-vs-outline rule, nested-list
hierarchy, inline-markdown stripping for display, click-to-heading, a 1–6 depth
slider, a dedicated component boundary — the shipped shape is close to the
minimum that satisfies it inside this repo's layering and its no-RTL/jsdom
testing reality. Production code is **~350 new lines** across 7 new small
modules plus ~120 lines of mechanical plumbing; nothing here is a framework, a
plugin system, or an abstraction awaiting a second implementer.

Three concrete trims are worth taking (two are dead/vestigial code, one removes
a real cross-file CSS trap). None of them block merge on correctness grounds.

---

## 1. Complexity inventory

| Artifact | Purpose | Weight for a maintainer | Verdict |
|---|---|---|---|
| `src/shared/FileKinds.ts` +`isMarkdownPath`/`isOutlineBearingPath` | excalidraw exclusion (Q4) | ~5 lines in a file that already owns file-kind knowledge; also DRYs up a duplicated `MARKDOWN_EXTENSION` | **Essential, net negative complexity** |
| `src/adapters/obsidianPorts.ts` `HeadingPort` | structural slice so `CachedMetadata` satisfies the port without importing obsidian into the test path | 6 lines, identical in shape to `ReferencePort` | **Essential** |
| `src/adapters/ReferenceOrder.ts` `orderedReferences` + `FRONTMATTER_REFERENCE_OFFSET` | offsets the image-vs-outline rule compares against heading offsets | Moderate: the `-1` frontmatter sentinel is a real concept a reader must absorb. `orderedLinkTexts` was correctly collapsed onto it, so there is still ONE ordering truth | **Essential** |
| `ObsidianLinkProvider.outlineOf` + `referencesImageAbove` | the whole image-vs-outline decision | **This is where cognitive load concentrates on the data side.** Two coordinate spaces, resolved-vs-unresolved references, an early-stop scan. Well documented, 14 tests | **Essential** |
| `ObsidianLinkProvider.orderedMarkdownReferences` + `ResolvedReference` | *intended* to share one resolution pass between attachments and the image rule | **Vestigial.** The image rule ended up calling `ReferenceOrder.orderedReferences` directly, so `ResolvedReference.offset` has **zero readers** (`ObsidianLinkProvider.ts:11-15, 184-194, 214`) | **SIMPLIFY NOW** |
| `OutlineEntry` on `types.ts`/`LinkProvider`/`TraversedNode`/`GraphNode`/`FlowNodeData` | one required array through 4 layers | Low — required field, so a dropped hop is a compile error; mirrors `attachments` exactly | **Essential** |
| `outlineMaxDepth` settings plumbing (7 touch points) | the mandated 1–6 slider (Q1/Q5) | One mechanical line per touch point in the *existing* `globalView` cascade. No new store method, command kind, or shape. This is what any setting costs in this repo | **Essential** |
| `DEFAULT_OUTLINE_MAX_DEPTH` (`engine/constants.ts:38`, re-exported `index.ts:94`) | — | **Zero consumers anywhere.** Every sibling `DEFAULT_*` has 3–8 | **CUT NOW** |
| `src/view/outlineTree.ts` (53 l) | flat → nested `<ul>` (Q8) | Low. Single-pass stack, ill-formed-tree rules stated explicitly, 6 tests | **Essential (Q8)** |
| `src/view/outlineEntryLabel.ts` (53 l) | markdown stripping for display (Q7) | Low-moderate. 8 regexes; the value is the doc comment's explicit **NOT handled** list, which is what stops this from growing into a parser | **Essential (Q7)** |
| `src/view/nodePreviewChoice.ts` (25 l) | 3-way slot arbitration | ~10 lines of real logic. Earns its keep: it fixed the `data-preview="thumbnail"`-on-a-node-with-no-thumbnail lie, and CSS (`[data-preview="outline"]`) and e2e now both key off it | **LEAVE AS IS** |
| `src/view/nodeOpenIntent.ts` (34 l) | ctrl/cmd = new tab, shared | `opensInNewTab` is a genuine DRY win (node body + entries can no longer disagree). `outlineEntryOpenOptions` is a 1-line constructor — marginal but free | **LEAVE AS IS** |
| `NoteOpenPort` + `NoteOpenContext.ts` (21 l) | reach the controller from inside a React Flow-instantiated node | One-method port, one implementation (an inline lambda). *Some* channel is structurally forced; this one is the third instance of an idiom already used twice (`GraphUiContext`, `ControlsActionsContext`) | **LEAVE AS IS** |
| `src/view/NodeOutline.tsx` (95 l) | the mandated component boundary (Q9) | Low. Three small functions, props are a string + POJO array, no callbacks | **Essential (Q9)** |
| `src/view/node-outline.css` (80 l) + 20 l in `graph-view.css` | scroll container, hover-only scrollbar, nesting knob, ellipsis | **This is where cognitive load concentrates on the view side** — see §4 | **SIMPLIFY NOW (one rule)** |
| `OUTLINE_RENDER_LIMIT = 40` | DOM bound per node | 1 constant, 1 line, 2 tests. Not requested, but the depth filter alone does not bound a generated 500-heading note × up to 100 nodes | **LEAVE AS IS** |
| 78 new vitest cases | correctness of the pure core (no RTL/jsdom in this repo) | See §3 | **Mostly justified** |
| `e2e/nodeOutline.e2e.ts` (313 l) + 2 harness helpers | the DOM/pointer half that vitest cannot reach | Moderate but load-bearing; every case is mutation-verified per `IMPLEMENTATION_ITERATION_PART2__PUBLIC.md` | **LEAVE AS IS** |

**Where the cognitive load actually sits** — two places, both named above:

1. `ObsidianLinkProvider.outlineOf` / `referencesImageAbove`: the only genuinely
   non-obvious algorithm, and the only place where two Obsidian coordinate
   spaces are compared. It is heavily commented and has 14 colocated tests.
2. The CSS slot arbitration: three mechanisms interact (container-query reveal,
   flex arbitration between title zone / outline / attachment strip, cross-file
   cascade order). This layer produced **both** real bugs found during the work.

Everything else in the diff is either mechanical plumbing or a ≤55-line pure
function with tests.

---

## 2. Essential vs accidental complexity

**Essential** (the clarified requirements leave no cheaper option):

- Heading data must cross the `LinkProvider` seam as an engine POJO — the import
  guard makes anything else a test failure, not a style preference.
- The image rule is *defined* positionally ("first image before first heading"),
  so document offsets must exist somewhere. `ReferenceOrder.orderedReferences`
  is the minimum that exposes them without a second ordering implementation.
- Nested `<ul>` (Q8) ⇒ `outlineTree.ts`. Display stripping (Q7) ⇒
  `outlineEntryLabel.ts`. Both were explicitly chosen over the cheaper
  alternatives (padding ladder / render raw) by the human.
- Depth slider (Q5, re-confirmed) ⇒ the 7-touch-point cascade. That price tag
  belongs to `SETTINGS_SPEC`, not to this feature.
- Dedicated `NodeOutline.tsx` (Q9) is a *structural requirement*, stated as
  non-negotiable.
- No RTL/jsdom ⇒ decisions must be extracted into pure modules to be testable at
  all. That is the reason there are 7 new files rather than 2, and it is the
  right trade in this repo.

**Accidental** (how we chose to build it):

- `ResolvedReference` + `orderedMarkdownReferences` — a plan-era shape the
  implementation outgrew and did not clean up. Dead field, extra type, extra
  indirection that only forwards.
- `DEFAULT_OUTLINE_MAX_DEPTH` — an export added for symmetry with siblings that
  have consumers; this one has none.
- The `graph-view.css` ⇄ `node-outline.css` `display` tie-break (§4).
- Five plumbing-echo tests (`FakeLinkProvider` ×2, `VicinityTraversal` ×2,
  `VicinityEngine` ×1). They *can* fail — `assemble()` could hardcode `[]` and
  still compile — so they are not vacuous, just low-yield. Not worth churning.

**Not found** (checked for, honestly absent): no speculative "we might need this
later" abstraction; no config knob beyond the one the human mandated; no
interface with one implementation that is not structurally forced; no test that
asserts on internal call sequences or private shapes.

---

## 3. Value per unit of complexity

**Carries its weight easily:**

- `outlineOf` + `referencesImageAbove` (~40 lines): delivers the entire
  headline behaviour *and* the human's documented escape hatch. 14 tests cover
  a case table that is genuinely 8 branches wide.
- `outlineEntryLabel` (~25 lines of logic): turns unreadable
  `## Status of [[note1]] **today**` into `Status of note1 today` for the price
  of eight regexes, with the failure mode bounded to "a few stray characters" —
  never a broken link. Excellent ratio.
- `outlineTree`: 20 lines of stack algorithm for the hierarchy the human asked
  for, with the ill-formed-document rules written down instead of discovered.
- The e2e file: 11 cases, each mutation-verified red. This is the only coverage
  that exists for the DOM half, and it caught/pinned two real bugs.

**Marginal but cheap enough to keep:**

- `outlineEntryOpenOptions` — a 1-line object constructor with 2 tests. Its
  sibling `opensInNewTab` is the real win.
- `nodePreviewChoice` — 3 states, 3 tests. Justified less by the logic than by
  giving the CSS and e2e a name to key off.
- `NoteOpenContext` — 21 lines to avoid `NoteNode` growing a prop per future
  outline interaction. Consistent with two existing contexts.

**Does not carry its weight:**

- `ResolvedReference.offset` (0 readers) and the wrapper that produces it.
- `DEFAULT_OUTLINE_MAX_DEPTH` (0 readers).

---

## 4. Under-engineering / fragility — is the CSS layer sound now?

**Better than it was, but one trap remains.** The layer produced both real bugs
in this work:

- **Bug 1 (fixed, M1):** `[data-preview="outline"] .…__preview-zone { flex: 0 0 auto }`
  sat *outside* the `@container (min-height: 104px)` block, so on a 72–104px node
  — where the outline is `display: none` and can absorb nothing — it unpinned the
  attachment strip. Now inside the block, with the WHY written down, and guarded
  by a dedicated e2e case that asserts the *user-visible* fact (≤1px dead space)
  after forcing the node into that band via a new `setMaxNodeSizePx` harness
  lever. That is a proper fix, not a patch.

- **Bug 2 (mitigated, not removed):** the reveal. `node-outline.css` declares
  `.vicinity-graph-outline { display: none }`; `graph-view.css` declares
  `.vicinity-graph-node .vicinity-graph-outline { display: block }` inside the
  container query. `styles.css` concatenates graph-view **before** node-outline
  (`esbuild.config.mjs:47-51`), so the reveal only wins because of the
  deliberately-redundant `.vicinity-graph-node ` ancestor prefix. Both files
  carry comments explaining this, and an e2e `toBeVisible()` assertion now
  guards it (mutation-verified red).

Bug 2's residual risk is real but bounded: the failure mode is a maintainer
"tidying" the redundant-looking ancestor selector, or inserting a CSS file
between the two. It fails **loudly in e2e** — but e2e is a release gate, not
`npm test`, so it would survive a normal edit-test loop.

The reviewer's suggested fix (move the reveal *into* `node-outline.css`) was
rejected on ladder-readability grounds, and I agree with that rejection. But
there is a third option nobody costed, which is strictly better than either:
**move the base `display: none` UP into `graph-view.css`, next to the reveal.**
Then both directions of "when is the outline shown" live in the density ladder,
`node-outline.css` becomes purely about appearance, and the specificity
tie-breaker and the file-order dependence both disappear. Three lines moved.

Nothing else in the diff reads as fragile: no order-dependent module init, no
hidden temporal coupling, no clever TypeScript. `NodeOutline`'s deliberate
absence of `useMemo` is correct and the WHY-NOT is written down.

---

## 5. The 80/20 counterfactual

**Against the requirements as clarified, there is no materially simpler shape.**
I looked for one and did not find it — saying so plainly rather than
manufacturing criticism. The three obvious "simplifications" are all things the
human explicitly ruled out:

| Cheaper shape | Saves | Why it is not available |
|---|---|---|
| Flat list with a `data-level` indent class | `outlineTree.ts` + 6 tests (~75 lines) | Q8 explicitly moved *away* from an indentation ladder to real nesting |
| Render heading text raw | `outlineEntryLabel.ts` + 9 tests (~100 lines) | Q7 explicitly requires stripped display text |
| Fixed depth 2, no setting | ~50 lines + 10 tests + a settings card | Q1 and again Q5 explicitly require the slider |

The **one** place where a real 80% option existed and was traded away:

- **The image rule could have read `cache.embeds[0].position.start.offset`
  directly** instead of resolving references. That deletes
  `ReferenceOrder.orderedReferences`, `FRONTMATTER_REFERENCE_OFFSET`,
  `referencesImageAbove` and the frontmatter-link case — roughly 45 lines and
  4 tests. It is wrong only when an *unresolvable* `![[missing.png]]` or a
  frontmatter image precedes the first heading; the shipped version avoids a
  silently blank node in that case. Given the change also collapsed
  `orderedLinkTexts` onto a single ordering truth (a DRY improvement to
  pre-existing code), I judge the shipped choice defensible — but it is the only
  genuinely discretionary ~45 lines in the diff, and it is worth the human
  knowing that.

Everything else scales down only by scaling down the requirements.

---

## 6. Recommendations

### `CUT NOW`

**R1 — delete `DEFAULT_OUTLINE_MAX_DEPTH`.**
`/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1/src/engine/constants.ts:38`
and its re-export at `src/engine/index.ts:94`. Zero consumers in `src/` or
`e2e/` (every sibling `DEFAULT_*` has 3–8). `EngineDefaults.viewSettings()`
reads `SETTINGS_SPEC…default` directly and does not go through it.
**What breaks:** nothing — `npm run check` is the whole verification.

### `SIMPLIFY NOW`

**R2 — collapse `ResolvedReference` / `orderedMarkdownReferences`.**
`/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1/src/adapters/ObsidianLinkProvider.ts`
lines 11-15 (the interface), 184-194 (the helper), 214 (its only call site).
The helper's `offset` field has no reader: the image rule went to
`ReferenceOrder.orderedReferences` directly (line 172), so this is plan-era
scaffolding the implementation outgrew. Have the helper return
`readonly string[]` (or inline it into `resolvedOutgoingPaths`) and delete the
interface. ~15 lines out, one type fewer to explain.
**Risk:** low. The behavioural hazard here (attachment reordering silently
moving `firstImagePath`) is already pinned by the ordered-array assertion
`"WHEN a file carries an outline THEN its attachments keep their exact reference order"`.

**R3 — put both `display` rules for the outline in `graph-view.css`.**
Move `.vicinity-graph-outline { display: none }` out of
`/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1/src/view/node-outline.css:18`
up next to the reveal at
`/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1/src/view/graph-view.css:233-236`,
and drop the `.vicinity-graph-node ` specificity tie-breaker with it. This keeps
the density ladder whole (the reason MINOR 3 was rejected — that rejection was
right), makes `node-outline.css` purely about appearance, and removes the
file-concatenation-order dependence entirely. Three lines moved.
**Risk:** low; the existing `toBeVisible()` e2e case is exactly the regression
detector, and both explanatory comments shrink rather than grow.

### `FOLLOW-UP TICKET`

**R4 — re-tune the nesting/entry budget after real-vault use.** The plan's
"≈3 entries at 104px, ≈6 at 160px" is arithmetic from the CSS, never measured.
`node-outline.css:47-49` is deliberately the single knob. The existing
`ticket-node-outline-heading-jump-smoke-run.md` is the natural place to also
record "did 3 entries feel cramped?" — no new work now.

**R5 — the five plumbing-echo tests** (`FakeLinkProvider.test.ts` ×2,
`VicinityTraversal.test.ts` ×2, `VicinityEngine.test.ts` ×1) are low-yield: a
required field means most breakages are compile errors first. They are not
vacuous (a hardcoded `[]` in `assemble()` would compile), so **do not remove
them** — just do not replicate the pattern for the next field. Note it in the
repo conventions if anywhere; not worth a ticket of its own.

### `LEAVE AS IS`

- `NodeOutline.tsx`, `outlineTree.ts`, `outlineEntryLabel.ts` — each is a small,
  documented, well-tested implementation of an explicitly mandated requirement.
- `nodePreviewChoice.ts` — pays for itself as the shared name behind the JSX
  branch, the `[data-preview]` CSS hook and two e2e assertions.
- `NoteOpenPort` / `NoteOpenContext.ts` — the channel is structurally forced by
  React Flow, and this is the third use of an existing idiom, not a new one.
- `nodeOpenIntent.ts` — `opensInNewTab` removes a genuine duplication of the
  ctrl/cmd rule.
- The full `outlineMaxDepth` cascade — the alternative (a `nodeExclusion`-shaped
  global-only store) is *more* code and would not reach `flowMapping`.
- `OUTLINE_RENDER_LIMIT` — a real DOM bound, one constant, honest comment.
- The e2e suite and its two new harness helpers — every case mutation-verified.
- The three pre-existing `collidePaddingPx` failures — untouched, correctly, and
  already ticketed.

---

## Questions for the human

#QUESTION_FOR_HUMAN: R3 moves the outline's base `display: none` from `node-outline.css` into `graph-view.css` so the reveal no longer depends on stylesheet concatenation order plus a redundant ancestor selector. It is a strictly smaller version of the MINOR-3 concern the implementation rejected (and rejected for a good reason — keeping the density ladder in one file). Do you want it taken before merge, or is the existing comment + mutation-verified e2e guard sufficient for you?

#QUESTION_FOR_HUMAN: The image-vs-outline rule resolves references (~45 lines: `orderedReferences`, `FRONTMATTER_REFERENCE_OFFSET`, `referencesImageAbove`) rather than reading `cache.embeds[0]` raw. The extra cost buys correctness for two rare cases only — an unresolvable `![[missing.png]]` before the first heading, and a frontmatter image. It is the only genuinely discretionary complexity in the diff. Keep as shipped (my recommendation, since it also unified the ordering truth), or is that a trade you would rather not have paid for?
