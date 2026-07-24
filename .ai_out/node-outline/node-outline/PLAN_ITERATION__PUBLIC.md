# PLAN_ITERATION — `node-outline`

Iterating PLANNER · Inputs: `DETAILED_PLAN_REVIEW__PUBLIC.md` (verdict **MAJOR**),
`CLARIFICATION__PUBLIC.md` **Rounds 2 + 3** (new binding requirements),
`DETAILED_PLANNING__PUBLIC.md` (with the reviewer's inline annotations).
Output: `DETAILED_PLANNING__PUBLIC.md`, revised in place → **READY FOR IMPLEMENTATION**.

---

## 1. Major feedback — disposition

### M1 · Use Obsidian's `stripHeadingForLink`; the accepted "`#` in a heading opens at top" defect is unnecessary
**INCORPORATED.**

Verified independently: `node_modules/obsidian/obsidian.d.ts:6841`,
`export function stripHeadingForLink(heading: string): string;`, `@public`, no
`@since` tag → safe at `minAppVersion 1.12.4`. The reviewer is right that hand
-joining is *less* correct than Obsidian is with itself, and that shipping a
known-broken click plus a README apology is the wrong trade.

Plan changes (D6, Step 6, §5, §6, Step 10):
- Sanitising moves into `ObsidianNoteNavigator` (the adapter that already imports
  `obsidian`, matching `ControlsActions.ts` / `ObsidianGraphUi.ts`).
- `nodeOpenIntent.headingLinktext` and its test are **deleted** — a pure module
  cannot import `obsidian`, and a half-sanitising pure join would be a second,
  worse truth (DRY). `nodeOpenIntent` keeps `opensInNewTab` +
  `outlineEntryOpenOptions`.
- The `#`-in-heading risk row and the matching README limitation are removed.
- **Two consequences the review did not spell out, now written into the plan:**
  1. The existing `getFileByPath(path) === null` guard **must stay ahead of both
     branches** — `openLinkText` on a missing path can make Obsidian *create* a
     note, so removing the guard would turn a click on a stale node into a file
     write. Full method shape is in D6.
  2. `ObsidianNoteNavigator.ts` goes from `import type` to a **value** import of
     `obsidian`. Our `vitest.config.ts` has no `obsidian` runtime alias (that
     lives in the submodule suite), so the module becomes unit-untestable by
     construction. Grepped: no `src/**/*.test.ts` imports it, so nothing breaks;
     the branch is covered by e2e E2/E3 + a manual dev-vault check. Stated as a
     risk-table row rather than left implicit.

### M2 · Heading text is raw markdown — the plan never decides what is rendered
**INCORPORATED — as option (b), which CLARIFICATION Round 3 (Q7) has since made
binding.**

New D9 + new Step 7 module `src/view/outlineEntryLabel.ts` (pure, view-layer,
precedent `badgeText.ts`), with 9 BDD tests (T56–T64). The reviewer's warning
that display text and link text must NOT be unified is honoured structurally:
`OutlineEntry.rawText` stays raw and is the link key; the label is computed only
at render time inside `NodeOutline`.

Two additions beyond the review's suggestion:
- **Renamed the field `text` → `rawText`.** A field called `text` in a UI-facing
  POJO invites `{entry.text}` in JSX, which is exactly the bug Q7 forbids.
  Zero-cost rename that makes the correct call read as correct.
- **The "deliberately NOT handled" list is part of the deliverable** (module doc
  comment + README), so nobody mistakes a ~25-line helper for a parser. Notable
  explicit non-goal: `_underscore emphasis_` is **not** stripped, because doing so
  mangles `snake_case_identifiers`, which are far commoner in headings than
  underscore italics. Also not handled: escapes, markers inside code spans, `)`
  inside link URLs, `[[note#heading]]`, HTML, LaTeX. Every failure mode is
  cosmetic; none can break a link.
- Also incorporated the reviewer's smaller point: `stripHeading` is a *matching*
  normaliser and obsidian-only — explicitly rejected for display use in D9.

### M3 · e2e test 57's cursor-line assertion is probably not a real contract
**INCORPORATED, re-scoped (the assertion is dropped, not weakened into a coin flip).**

The reviewer is right: `openLinkText` applies an ephemeral state; nothing
documents that the **editor cursor** moves, and in reading view the claim is
meaningless. Rather than guess at `getEphemeralState()` shapes or scroll offsets
— all of which are Obsidian internals that can change per build — the plan now
splits the guarantee along the actual contract boundary:

- **E2 (automated)** asserts **our** side: a spy installed on
  `app.workspace.openLinkText` inside `page.evaluate` (delegating to the
  original, restored after) recorded `"<path>#<raw heading>"`. This is a real,
  stable contract — it proves we build the subpath correctly and delegate to the
  documented API. `page.evaluate` + `window.app` is the harness's established
  idiom.
- **E3 (automated)** asserts the note actually became active (and that the
  canvas-level handler did not open a different one).
- **Obsidian's scroll/flash behaviour** is Obsidian's contract, so it is verified
  **manually** in `.dev-vault`, in both editing and reading view, as an explicit
  checklist item in Step 9 whose result goes in the commit message.

This is the honest answer: we test what we own, we do not ship a test that
asserts a coincidence, and we do not silently drop the human-visible guarantee.

### M4 · `#QUESTION_FOR_HUMAN` (1) — the CLARIFICATION is not actually ambiguous
**INCORPORATED.** CLARIFICATION Round 2 Q5 confirms the reviewer's reading
verbatim. Step 4 is now **committed**, the "Interpretation note" hedge and both
old `#QUESTION_FOR_HUMAN` items are gone, and §9 states plainly that no questions
remain. D8's `ViewSettings`-vs-global reasoning is unchanged (the reviewer
independently verified the decisive argument).

### M5 · Vacuous tests — cut them and make the count honest
**INCORPORATED for both flagged tests; the optional third cut is REJECTED.**

- **Cut** old test 8 (`orderedLinkTexts` equals `orderedReferences().map(…)`) —
  restates the implementation.
- **Cut** old test 32 (two mappings are `toEqual`) — `toFlowNodeData` is pure.
  T30 (`decideLayout` reuses layout when only the outline changed) is the real
  stability contract and is kept.
- **Rejected: cutting old test 13** (excalidraw is still `isNodeBearing` at the
  adapter). It is a *different unit* from the `FileKinds` test one layer down,
  and it guards precisely the CLARIFICATION Q4 confusion this feature invites
  ("excluded from outlines" silently becoming "excluded from the graph"). Cheap,
  and it can genuinely fail.
- **Swept the whole list.** No other test was vacuous. Counts are now stated
  honestly in §5: **72 vitest + 6 e2e cases** (55 → −3 cut/deleted, +20 for the
  three new pure modules Round 3 requires).

---

## 2. Minor inline annotations — disposition

| # | Inline note | Disposition |
|---|---|---|
| m1 | Test 21 → ordered-array assertion | **Accepted**, kept as T21 |
| m2 | Add the `getFileCache() === null` case | **Accepted**, now T15 |
| m3 | Cut tests 8 / 32 | **Accepted** (see M5) |
| m4 | `<ul>` needs `margin/padding/list-style` reset | **Accepted and promoted to load-bearing** — with the Round 3 nested list, Obsidian's default `padding-inline-start` would compound *per level* inside a ≤250px node. Written into D5(b) as the reset that makes the single nesting knob possible |
| m5 | `data-preview="thumbnail"` with no preview is a POLS lie | **Accepted and upgraded** to a pure, unit-tested `nodePreviewKind()` returning `"outline" \| "thumbnail" \| "none"` (D3b, T71–T73). Also the answer to the re-examination below |
| m6 | Fixture needs ≥10 headings so overflow is provable | **Accepted and extended**: also needs a level-1 with ≥2 level-2 children (nesting), two level-3 headings (depth), and one heading carrying inline markdown (`## Status of [[note1]] **today**`) so E1 can prove display stripping end to end |
| m7 | e2e 59 needs a `scrollHeight > clientHeight` precondition | **Accepted**, now E5 |

---

## 3. New requirements folded in (CLARIFICATION Round 3 — binding)

| Q | Requirement | Where it landed |
|---|---|---|
| Q7 | Nice display; markdown stripped for display, **raw** stays the link key | D9 (bounded pipeline + explicit non-goals), D1 (`rawText` rename), Step 7, T56–T64, README limits |
| Q8 | Hierarchy via a **nested list**, minimal spacing | D5(a) markup, D5(b) the single nesting knob (`--size-4-2` on nested lists only, after a full list reset), D10 pure `buildOutlineTree` + T65–T70. The old per-level `data-level` padding ladder is **removed** |
| Q9 | Dedicated `NodeOutline` component, so the UI can be iterated later | D7: `src/view/NodeOutline.tsx` + its own `src/view/node-outline.css` (one line in `esbuild.config.mjs`; the file list is explicit, not a glob). Props are `{ notePath: string; entries: readonly OutlineEntry[] }` — primitives/POJOs only |
| Q6 | Staleness = verify-first | §7 ticket reworded; no speculative work |

**Two judgement calls inside Q9, stated so they can be challenged:**

1. **`NodeOutline` takes no callback prop.** An `onSelectHeading(raw, modifiers)`
   prop is "purer" on paper, but it routes every *future* outline interaction
   back through `NoteNode`'s prop list — the exact coupling Q9 exists to prevent.
   It also breaks the local-component idiom already in the file: `PinButton` and
   `AttachmentChip` both call `useGraphUi()` themselves. So `NodeOutline` reaches
   `useNoteOpen()` directly, and `NoteNode`'s total diff is ~4 lines.
2. **The flat array stays the mapping↔UI contract.** Tree building and labelling
   happen inside the outline UI, not in `flowMapping`. Otherwise "iterate on the
   outline later" would mean editing the mapping layer and its tests every time.
   The CSS split follows the same logic; the sole exception is the one
   density-ladder line, which stays in `graph-view.css` so the whole "what shows
   at what size" ladder remains readable in one place.

---

## 4. Re-examined on request: is "image wins ≡ EMPTY outline" still right?

**Verdict: keep the empty-array encoding at the engine seam; make the choice
explicit at the view.** (Full argument in D3b.)

- *Keep at the seam.* Nothing between the adapter and `NoteNode` can act on the
  difference between "no headings" and "the image won" — both mean *do not offer
  an outline*. A discriminated `preview` field on `FileMetadata` would have to
  absorb `firstImagePath`/`imageCount` too (or there would be two competing
  sources of "what shows"), turning a one-field addition into a refactor of the
  thumbnail path for zero behavioural difference. The conflation is documented on
  the field, so it is lossy-but-stated, not hidden. The dedicated component does
  not change this: `NodeOutline` is not even mounted when there are no entries.
- *But the reviewer's m5 complaint was a real symptom in the right place.* The
  **view** genuinely makes a three-way choice, and the draft derived it from
  `outline.length` plus a nullable path — which is how `data-preview="thumbnail"`
  ended up on nodes that render no thumbnail. So the discriminated value now
  exists exactly where the decision is made: `nodePreviewKind()`, 8 pure lines,
  3 tests, three honest `data-preview` values.

Net: the POLS lie is gone and no adapter-owned fact is duplicated across three
layers.

---

## 5. Net effect on the plan

- Steps: 9 → **10** (new Step 7 = the three pure presentation modules, committable
  and reviewable before any JSX exists — which is where correctness lives, given
  this repo has no RTL/jsdom).
- New files: `NodeOutline.tsx`, `node-outline.css`, `outlineEntryLabel.ts`,
  `outlineTree.ts`, `nodePreviewChoice.ts` (+ 3 test files).
- Deleted from the draft: `headingLinktext`, the `data-level` indent ladder, two
  vacuous tests, one accepted defect, one README limitation, both open questions.
- Open `#QUESTION_FOR_HUMAN`: **none**.
