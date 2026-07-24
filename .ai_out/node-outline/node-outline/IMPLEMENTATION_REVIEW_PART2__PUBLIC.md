# IMPLEMENTATION_REVIEW_PART2__PUBLIC — node-outline steps 6–10

Reviewer: `IMPLEMENTATION_REVIEWER_PART2`. Scope: plan steps **6–10** on branch
`node-outline` (commits `96d4093` … `27ca2b5`). Steps 1–5 were reviewed and
approved earlier; I re-read their diff only where part 2 depends on it.

> ## Verdict: **CHANGES REQUIRED**
>
> The feature is well built and the honesty of the hand-off is high — every
> claim I re-checked held up, including the mutation-failability claim and the
> e2e numbers, which I re-ran myself. What blocks approval is one **behavioural
> regression on existing node rendering** that no test covers (M1), plus two
> **coverage gaps on the exact interaction the human specified** (M2, M3). All
> three are small, local fixes.

## Verification I ran myself

| | Result |
|---|---|
| `npm run check` | **PASS**, clean. |
| `npm test` | **815 passed / 3 failed** — exactly the 3 pre-existing `collidePaddingPx` baseline failures. I diffed `SettingsSpec.test.ts` and `forceLayoutSettings.test.ts`: **not touched, not re-pinned**. The new `outlineMaxDepth` spec leaf does **not** feed the two "exact shipped baseline" assertions (they enumerate fields explicitly), so the branch adds no new failure there. Settled — moving on. |
| `npm run test:e2e` (real Obsidian, auto-downloaded) | **33 passed / 2 failed** — *identical* to the implementer's report. All **8 new `nodeOutline.e2e.ts` cases pass**. The 2 failures are the two claimed pre-existing ones; I confirmed `.vicinity-graph-node__breadcrumb` exists nowhere in `src/`, so nothing on this branch removed it. |
| Mutation spot-checks | 5 run, **5 went red** (details below). |
| `docs-internal/CHANGELOG.md` | **NOT touched** on this branch. Correct — TOP_LEVEL_AGENT owns it. |
| Working tree after my checks | clean (`git status` empty). |

---

## 🚨 BLOCKING

None.

---

## ⚠️ MAJOR

### M1 — The `data-preview="outline"` layout rule un-pins the attachment strip on every node **below** the outline's own threshold

`src/view/graph-view.css:223`:

```css
.vicinity-graph-node[data-preview="outline"] .vicinity-graph-node__preview-zone {
	flex: 0 0 auto;
}
```

This rule is **outside** the `@container (min-height: 104px)` block, so it also
applies to nodes 72–104px tall — where `.vicinity-graph-outline` is still
`display: none` and therefore is **not** a flex item that can absorb the slack.

**Why it matters.** The pre-existing comment on `.vicinity-graph-node__attachments`
states the contract explicitly:

```
/* The preview-zone above flex-grows to fill the node, so the strip already
 * lands on the bottom edge without its own `margin-top: auto`. */
```

Killing `flex-grow` on the preview zone removes the only thing pinning the
attachment strip to the bottom edge. For a 72–104px node whose note is
outline-bearing — i.e. **most markdown notes with headings and no leading
image**, a very common node class — the chip strip now floats up directly under
the title with dead space beneath it. That is a silent loss of previously
shipped layout behaviour, on a size band where this feature renders nothing at
all. No test catches it: every e2e assertion in `nodeOutline.e2e.ts` targets the
MAIN node, which is always 160px.

**Fix** — move the rule inside the block that already gates the outline, so it
only fires when the outline is actually a flex item:

```css
@container (min-height: 104px) {
	.vicinity-graph-node__thumbnail { display: block; }
	.vicinity-graph-node .vicinity-graph-outline { display: block; }
	/* The outline, not the title zone, absorbs the node's spare height. */
	.vicinity-graph-node[data-preview="outline"] .vicinity-graph-node__preview-zone {
		flex: 0 0 auto;
	}
}
```

(The styled element is a descendant of the container, so the query resolves the
same way; no specificity change is needed.)

### M2 — Nothing proves the **raw** heading (not the stripped label) is what reaches the navigator

Round 3 Q7's contract has two halves: label is stripped, **raw text is the link
key**. The first half is proven end to end (E1). The second half is proven only
as far as `outlineEntryOpenOptions` (unit) and `GraphViewController.openNode`
(unit). The one line that actually chooses which string to send —
`NodeOutline.tsx:88`, `outlineEntryOpenOptions(entry.rawText, event)` — has no
test at all: `NodeOutline.tsx` has no unit test (no RTL/jsdom, accepted), and
E2 deliberately clicks **`Background`**, a plain-prose heading where
`label === rawText`. Changing `entry.rawText` to `label` there would keep every
test in the repo green while breaking the headline requirement for exactly the
headings the requirement was written about.

The implementer's stated reason for using a plain heading — "asserting on a
marked-up heading would pin Obsidian's sanitiser internals" — is fair, but it
over-corrects: we can assert our half without pinning theirs.

**Fix** — one more e2e case clicking the markdown-carrying entry
(`Status of outline-cover today`) and asserting the recorded linktext still
carries the *raw* markers, without pinning `stripHeadingForLink`'s exact output:

```ts
const linktext = (await recordedLinktexts()).at(-1) ?? "";
expect(linktext.startsWith(`${OUTLINE_NOTE_PATH}#`)).toBe(true);
// `**today**` survives ONLY if the RAW heading, not the stripped label, was the key.
expect(linktext).toContain("**today**");
```

### M3 — Nothing proves the entry click does **not** also fire the node-level open

`OutlineEntryButton` calls `event.stopPropagation()` before opening — the right
pattern, matching `PinButton`/`AttachmentChip`. But no test would notice if it
stopped working:

- E2 asserts one recorded `openLinkText`. A leaked node-level click goes through
  `getLeaf().openFile()`, which the spy never sees.
- E3 asserts the note became active. Both handlers open the **same** note, so
  the assertion holds either way.

The user-visible failure mode is real: the node-level open lands at the **top**
of the note, undoing the heading positioning the click just performed. This is
the one interaction the human named in the original task.

**Fix** — cheapest honest assertion, no Obsidian internals pinned: in E2 also
count `openFile` calls on the leaf prototype and assert **exactly one**
navigation per entry click.

```ts
const proto = Object.getPrototypeOf(app.workspace.getLeaf(false));
const original = proto.openFile;
proto.openFile = function (...args) { store.__vgOpenFileCount++; return original.apply(this, args); };
// after the click:
await expect.poll(openFileCount).toBe(1);
```

---

## 💡 MINOR (optional)

1. **The `openLinkText` spy is never restored.** `spyOnOpenLinkText` installs a
   permanent wrapper; the plan and the surrounding prose say "installed and
   restored". Harmless here (serial file, one instance, delegates to the
   original), but E3's click silently appends to `__vgLinktexts` too. Either
   restore in `afterAll`, or drop "restored" from the description.
2. **`outlineEntryLabel` alias handling on multi-pipe wikilinks.**
   `link.slice(link.lastIndexOf("|") + 1)` turns `[[a|b|c]]` into `c`; Obsidian
   displays `b|c`. Inside the module's documented bounded scope, but the
   "deliberately NOT handled" list does not mention it. One line to add.
   Same for the pathological `"## "` heading, whose empty-strip fallback returns
   the raw `"##"` — the only path by which a `##` can reach the display.
3. **The CSS tie-break stays order-sensitive.** The ancestor-selector fix is
   correct and well commented, but it re-arms the same trap: any future rule in
   `node-outline.css` written at ≥ (0,2,0) for this element wins again purely
   because that file concatenates later. Since `@container` blocks resolve
   against the nearest ancestor container regardless of file, moving the reveal
   *into* `node-outline.css` (with the ladder comment in `graph-view.css`
   pointing at it) removes the coupling entirely. Judgement call — the WHY-NOT
   as written is defensible; flagging so the trade is a conscious one.
4. **E5 proves `overflow-y: auto`, not the wheel path.** Setting `scrollTop`
   programmatically works irrespective of scrollbar visibility. The
   `nowheel`-based wheel behaviour (the thing the human's overflow rule is
   really about) stays untested. Acceptable given headless wheel flakiness — but
   the test name promises slightly more than it delivers.

---

## Test integrity — the highest-priority check

**No behaviour-capturing test was deleted, skipped or weakened.** The complete
set of test-file *deletions/modifications* on the branch:

| Change | Assessment |
|---|---|
| `src/view/GraphStructureDiff.test.ts` `-1` | a trailing blank line. Nothing else. |
| `e2e/settingsUxVisual.e2e.ts` `5 → 6` section cards | **legitimate, not a weakening** — part 1's step 4 genuinely adds the "Node contents" card. The test *name* was updated with it and a comment enumerates the six sections, so the assertion stays exact rather than becoming a floor. |
| everything else | additive. |

Pre-existing red tests: untouched and **not** re-pinned (verified by diff).

### Mutation spot-checks (I ran these; tree restored clean afterwards)

| # | Mutation | Claimed | Observed |
|---|---|---|---|
| 1 | `outlineEntryLabel`: drop `.replace(STRONG, "$1")` | red | **1 failed / 9 passed** ✅ |
| 2 | `outlineTree`: `lastLevel(...) >= entry.level` → `>` | red | **2 failed / 4 passed** ✅ |
| 3 | `nodeOpenIntent`: `ctrlKey \|\| metaKey` → `ctrlKey` | red | **1 failed / 4 passed** ✅ |
| 4 | `outlineEntryLabel`: drop the empty-label fallback | red | **1 failed / 9 passed** ✅ |
| 5 | `nodePreviewChoice`: outline never wins | (not claimed) | **1 failed / 2 passed** ✅ |

The "all 25 verified failable by mutation" claim is **credible**. I found no
vacuous assertion, no implementation-detail pinning, and no silent fallback in
the new vitest files. `outlineTree.test.ts` asserts through a `shapeOf`
projection (raw text + children) rather than object identity — a good choice
that keeps it a behaviour test.

### e2e honesty

Independently re-run: **33 passed / 2 failed**, matching the report exactly. The
8 new cases assert real behaviour, not tautologies — E5 carries an explicit
`scrollHeight > clientHeight` precondition, E4 parks the pointer before reading
the idle value, E3 first moves the active file to a non-node-bearing path so
"it became active" is a genuine observation. The disclosed deviation ("fixtures
deliberately do not link `note1`") does **not** hollow the coverage: both
fixtures are exercised as MAIN, which is the only deterministic way above the
104px threshold, and keeping them out of `note1`'s vicinity is what protects the
other suites' exact node counts. Correct call.

Fixture arithmetic checked by hand: 13 headings, 2 at level 3 → 11 rendered at
depth 2, matching `EXPECTED_ENTRY_LABELS` in DOM order across the nesting.

---

## Explicitly checked and found sound

- **Security.** No injection surface. Labels render as React text (escaped); no
  `dangerouslySetInnerHTML`. The linktext is `${path}#${stripHeadingForLink(raw)}`
  — Obsidian's own sanitiser strips `#`/`[`/`]`/`|`/`^`, so a heading cannot
  escape the subpath into a different note, and `sourcePath` anchors resolution.
  No secrets, no crypto, no deserialization.
- **The `getFileByPath` null guard sits ahead of BOTH branches** (D6) — a stale
  node click still cannot make `openLinkText` create a note. This was the one
  thing I most wanted to see and it is correct.
- **Navigation seam is additive.** `OpenNoteOptions.heading?` is optional;
  `NoteOpenPort` is a new one-method interface, not an edit to `GraphUiPort`
  (whose doc comment splits navigation out). `NoteOpenContext` mirrors
  `ControlsActionsContext` and throws loudly outside the provider.
  No undocumented Obsidian API: `openLinkText` is `@public @since 0.16.0`,
  `stripHeadingForLink` is `@public`.
- **Engine purity** — `importGuard` green; nothing new reaches into `src/engine/`.
- **DRY** — `opensInNewTab` is now the single definition of the ctrl/cmd gesture,
  used by both `VicinityGraphFlow.onNodeClick` and the outline entries.
- **SRP** — four small modules (`nodeOpenIntent`, `outlineEntryLabel`,
  `outlineTree`, `nodePreviewChoice`), each with one reason to change; the CSS
  lives in its own file; `data-preview` now carries three honest values, so the
  old POLS lie is genuinely gone.
- **KISS / no magic numbers** — `OUTLINE_RENDER_LIMIT = 40` is named with its
  WHY; the nesting indent is one `--size-4-2` knob; no literal colors anywhere
  in `node-outline.css` (all Obsidian variables), so light/dark both derive
  correctly with no per-theme rule.
- **Memo stability** — `FlowNodeData.outline` is an array, but `decideLayout`
  never reads node data; `GraphViewController.test.ts` pins both halves (layout
  reused, new outline published).
- **Docs (step 10)** — README, `high-level-plan.md` and `architecture-map.md` are
  accurate and succinct; the three added V1 limits are honest (including "the
  link never depends on" the stripper). `ticket-node-outline-live-refresh.md` is
  framed **verify-first** exactly as CLARIFICATION Q6 requires, states that
  `metadataCache.on("resolved")` is already wired and debounced, and explicitly
  forbids adding `changed` before a measurement. No `ap_XXX_E` anchor touched.
- **Build wiring** — one line in `AUTHORED_CSS_FILES`; regenerated `styles.css`
  carries all the new rules in the documented order. `main.js`/`styles.css` are
  untracked build artifacts and were not hand-edited.

---

## Round 3 requirement fidelity — item by item

| Q | Requirement | Met? |
|---|---|---|
| Q7 | No `##` markers in the display | **YES** — `LEADING_MARKER` requires trailing whitespace (so `#tag` survives); unit-tested. Sole theoretical leak is the pathological `"## "` heading via the empty-label fallback (MINOR 2). |
| Q7 | Inline markdown (`[[wikilinks]]`, `**bold**`, `` `code` ``, `[md](links)`) stripped **for display only** | **YES** — 10 unit cases + e2e E1 (`Status of outline-cover today`). |
| Q7 | Stripper's scope explicitly bounded, claims no more than it does | **YES** — the "DELIBERATELY NOT HANDLED" list is on the module and summarised in the README; it does not corrupt text it does not understand (worst case is a stray character), and the empty-result fallback prevents blank rows. Multi-pipe aliases are an unlisted member of that set (MINOR 2). |
| Q7 | **Raw** heading is the open-at-heading key | **YES in the code**, but only proven to the port boundary — the choosing line in `NodeOutline.tsx` is untested (**M2**). |
| Q8 | Hierarchy via a genuine nested list | **YES** — real `<ul>`/`<li>` nesting, asserted in e2e as a `__list __list` descendant containing the expected child. |
| Q8 | Minimal nesting spacing | **YES** — one `padding-inline-start: var(--size-4-2)` (8px) on nested lists only, with the `ul` reset made load-bearing. |
| Q9 | `NodeOutline.tsx` is a **real** component boundary | **YES, not in name only** — props are `notePath: string` + a POJO array; no `FlowNodeData`, no callbacks; behaviour is pulled from `useNoteOpen()` inside the component, so a future iteration touches one file. Its CSS is its own file too. |
| — | Overflow: vertical scroll, hover-only scrollbar that **still scrolls when hidden** | **YES**, with a caveat — the thumb (not the track width) is styled so nothing reflows on hover; e2e proves the computed `scrollbar-color` changes and that the list scrolls while hidden. The wheel path itself is untested (MINOR 4). |
| — | Per-entry horizontal ellipsis that does not break nesting | **YES** — `display: block; width: 100%` + `text-overflow: ellipsis` per entry; nesting shrinks the content box and the ellipsis applies to what remains. Full text stays in `title`. |
| — | Click opens at the heading; ctrl/cmd new tab preserved | **YES** for the heading (e2e E2/E3) and for the modifier (`opensInNewTab`, unit). The "does not ALSO fire the node handler" half is untested (**M3**). |
| — | Keyboard/focus sane | **YES** — real `<button>`s, `:focus-visible` ring from `--interactive-accent`, and out of the tab order below 104px because the region is `display: none`. |

---

## Documentation Updates Needed

None beyond what the branch already does. `CLAUDE.md` needs no change —
`docs-internal/architecture-map.md` absorbed the new seams, and the layering
statement there still holds.

## Questions

**#QUESTION_FOR_HUMAN:** The plan's step-9 **manual dev-vault check** — "click an
entry deep in `outline-note.md` and confirm Obsidian scrolls to and flashes that
heading, in BOTH editing and reading view" — was **not performed**; it needs a
human at a GUI Obsidian. The implementer flagged this honestly, and the e2e
covers only our side of the contract (the linktext we hand to `openLinkText`).
Do you want to run that check before this merges, or accept it as a post-merge
smoke test?
