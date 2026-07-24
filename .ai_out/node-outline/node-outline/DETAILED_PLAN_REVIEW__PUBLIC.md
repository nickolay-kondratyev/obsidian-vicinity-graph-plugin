# DETAILED PLAN REVIEW — `node-outline`

Reviewer: PLAN_REVIEWER · Inputs: `CLARIFICATION__PUBLIC.md`, `DETAILED_PLANNING__PUBLIC.md`,
`EXPLORATION_PUBLIC*.md`, **and the live source / `node_modules` (every claim below was
verified against the actual code, not the plan's description of it)**.

## Verdict

**MAJOR — plan iteration required.**

The architecture is right and the requirement coverage is essentially complete; this is a
strong plan. But it ships one avoidable, *documented-as-accepted* defect that Obsidian's
public API already solves (`stripHeadingForLink`), and it leaves one user-visible rendering
question (raw markdown inside heading text) entirely unaddressed. Both change Step 6/7's
shape, so they are outside my inline-edit mandate.

No blocking issue: nothing in the plan is unimplementable or architecturally wrong.

---

## Blocking issues

None.

---

## Major feedback

### 1. `openLinkText` — use Obsidian's `stripHeadingForLink`; the accepted "`#` in a heading degrades to open-at-top" limitation is unnecessary

**Issue.** D6 and §6 (Risks) accept two degradations: a heading containing `#` opens the
note at the top, and the heading text is joined raw into `` `${path}#${heading}` ``.
Obsidian's public API exports the function written for exactly this job:

```
node_modules/obsidian/obsidian.d.ts:6835  export function stripHeading(heading: string): string;        // "Normalizes headings for link matching…"
node_modules/obsidian/obsidian.d.ts:6841  export function stripHeadingForLink(heading: string): string; // "Prepares headings for linking by stripping out some bad combinations of special characters that could break links."
```

Both are `@public` with no `@since` tag (they predate the tagging convention), so they are
safe at `minAppVersion 1.12.4`. Obsidian's own link autocomplete and "copy link to heading"
go through this path, and `resolveSubpath` normalizes the stored heading with the matching
`stripHeading` — so building the subpath any other way is *less* correct than Obsidian is
with itself, not merely "same as `[[Note#Heading]]`" as D6 claims.

**Why it matters.** The plan's own case table treats heading text as arbitrary user prose
(it must — outlines render whatever the note contains). `#`, `|`, `[`, `]`, `^` in headings
are not exotic. Shipping a known-broken click and writing the breakage into the README is
the wrong trade when the fix is one documented call.

**Suggested resolution.** Move the subpath join out of the pure module and into the adapter
that already imports `obsidian` (`src/view/ObsidianNoteNavigator.ts`, which is allowed to —
cf. `ControlsActions.ts`, `ObsidianGraphUi.ts`):

```ts
// ObsidianNoteNavigator.openNote
void this.app.workspace.openLinkText(`${path}#${stripHeadingForLink(heading)}`, path, options.newTab);
```

Consequences for the plan: `nodeOpenIntent.headingLinktext` (and its test 41) is deleted or
re-scoped to "join an ALREADY-SANITIZED subpath"; §6's `#`-in-heading risk row and the
README limitation bullet both go away. Keep the duplicate-heading-text limitation — that one
is genuinely inherent and genuinely POLS-consistent with Obsidian.

### 2. Heading text is raw markdown — the plan never decides what is rendered

**Issue.** `HeadingCache.heading` is the heading's source text. A note containing
`## [[Project A]] status`, `## **Q3** results`, or `` ## `build.sh` notes `` will render
those literal markers inside the node. D1 documents `text` as "Heading text as parsed by
Obsidian (no leading `#`, no trailing spaces)" — true, and quietly implies more cleanup than
Obsidian actually performs. Nothing in §5 tests it and nothing in §8 scopes it out.

**Why it matters.** This is the feature's primary visual surface, in a ≤160px box where
`[[`/`**` noise costs a meaningful share of the horizontal budget that D5(b) is carefully
ellipsising. It also interacts with item 1: display text and link text must NOT be unified —
the link needs `stripHeadingForLink(raw)`, so `OutlineEntry.text` must stay **raw**.

**Suggested resolution.** Make it an explicit, tested decision — either is defensible:
- **(a) 80/20, recommended for V1:** render raw, add one line to the README limits section
  and one line to D1's doc comment saying so. Cost: zero.
- **(b)** add a pure `outlineEntryLabel(text)` in the view (strips `[[…]]`/`![[…]]` wrappers,
  `**`/`*`/`_`/`` ` ``/`==`), with 3–4 BDD tests. Stays pure and testable; note that
  `stripHeading` is obsidian-only and is a *matching* normalizer, not a display formatter —
  do not press it into service here.

Whichever is chosen, `OutlineEntry.text` stays the raw heading (it is the link key).

### 3. e2e test 57's cursor-line assertion is probably not a real contract

**Issue.** Test 57 asserts "the active markdown editor's cursor line equals that heading's
line". `openLinkText` with a subpath applies an *ephemeral state* — Obsidian scrolls to and
flashes the heading. It is not documented (and, in reading view, not meaningful) that the
**editor cursor** moves there. The test may pass on one Obsidian build and rot on the next,
or fail immediately depending on the default view mode of the dev vault.

**Why it matters.** The plan correctly identifies test 57 as the one test that proves
"opened AT the heading" rather than "opened". If its assertion is not backed by a real
contract, the strongest e2e in the set is the flakiest — and this repo already carries
`ticket-e2e-node-click-flaky-headless.md`.

**Suggested resolution.** Before writing the assertion, verify interactively in `.dev-vault`
what actually changes, then assert on that. Likely candidates, in order of robustness:
`getActiveViewOfType(MarkdownView).getEphemeralState()` carrying the subpath; a non-zero
scroll offset on a note long enough that "top" and "heading" differ; or the presence of
Obsidian's heading-flash element. If none is reliably assertable, say so and demote the
guarantee to a manual dev-vault check rather than shipping a test that asserts a coincidence.

### 4. `#QUESTION_FOR_HUMAN` (1) — the CLARIFICATION is not actually ambiguous

CLARIFICATION Q1 reads "**Configurable max depth** — a setting (slider, range 1–6, default
2)" and is marked human-approved and binding. The "Interpretation note" hedge is thin: Q2
removes an *on/off* toggle, which is not in tension with Q1's depth slider. Unless the human
says otherwise, **Step 4 should be built as planned** — the plan should not carry a
7-file step as conditional. Ask the question (it is passed through below), but plan for
"yes". D7's reasoning for putting the field on `ViewSettings` rather than a `nodeExclusion`
-shaped global is correct and I verified the decisive argument: `graph.viewSettings` is
already read inside `flowMapping` (`vicinityGraphToFlow` → `graph.viewSettings.groupByFolder`).

### 5. Minor test-plan trim (~4 tests) — call it out so the count is honest

Two of the 55 vitest tests cannot fail (annotated inline, decision left to PLAN_ITERATION):
test 8 restates the implementation of `orderedLinkTexts`; test 32 asserts `toEqual` across
two calls of a pure function. Test 13 duplicates test 5 one layer up (cheap, keep if you
like). Net: ~52 meaningful vitest tests + 5 e2e, which is proportionate for a change
touching 7 layers. **The step count (9) and the overall shape are NOT over-engineered** —
see "checked and found sound" below.

---

## Minor adjustments made inline (in `DETAILED_PLANNING__PUBLIC.md`)

All marked `<!-- PLAN_REVIEWER: … -->`:

1. **Test 21** tightened from "attachments unchanged" to an **ordered array** assertion —
   the `resolvedOutgoingPaths` refactor's only real hazard is a silent reordering that moves
   `firstImagePath`.
2. **Test 14b added**: `getFileCache` returns `null` → `outline` is `[]` (the cache-miss
   branch was unspecified; `getFileCache` is nullable and the provider already handles it
   for `frontmatterTitleOf`).
3. **Test 8** and **test 32** annotated as vacuous with a recommendation to cut.
4. **D5**: the `<ul>` needs an explicit `margin/padding/list-style` reset — Obsidian's base
   stylesheet gives lists a `padding-inline-start` that would fight the `data-level` ladder
   and eat the ellipsis budget.
5. **Step 7**: flagged that `data-preview="thumbnail"` on a node with neither outline nor
   image is a small POLS lie; suggest emitting the attribute only when a preview renders.
6. **Step 8 fixture**: `outline-note.md` must carry **≥10 level-1/2 headings** so the list
   provably overflows at the default depth of 2 — the original "6+ headings across levels
   1–3" leaves ~4 surviving entries against ~3–6 visible slots, which would make e2e 58/59
   pass vacuously.
7. **e2e 59**: assert `scrollHeight > clientHeight` as an explicit precondition.

---

## Explicitly checked and found sound — do NOT revisit

- **Requirement fidelity.** All four image/outline combinations are specified and tested
  (§5 tests 15–20), plus the frontmatter-link and non-image-attachment edge cases. Hover-only
  scrollbar that still scrolls, per-entry ellipsis, click-opens-at-heading, `.excalidraw.md`
  excluded from parsing but still a node (`isNodeBearingPath` keys on extension `md`, so it
  stays a node — verified in `src/shared/FileKinds.ts`), configurable max depth: all covered.
- **"Image wins" encoded as an EMPTY outline** — honest and unambiguous *for this consumer*.
  I traced every combination: `NoteNode` renders the thumbnail exactly when
  `outline.length === 0`, so "no headings" and "image wins" are behaviourally identical
  downstream and nothing needs to tell them apart. The view-stage depth filter emptying the
  array folds into the same rule (falls back to the image, else title only). D3's doc comment
  states the conflation explicitly. A second boolean field would be pure plumbing.
- **The `orderedReferences` / `resolvedOutgoingPaths` refactor is the RIGHT call**, and I
  specifically considered and rejected the "simpler" alternative of reading `cache.embeds`
  directly in `outlineOf`: `firstImagePath` is computed from **resolved** references, so an
  unresolvable `![[missing.png]]` before the first heading would suppress the outline while
  producing no thumbnail — a silently blank node. Sharing one resolution pass is what keeps
  the two decisions consistent. Regression risk is low (offsets are unique per reference, so
  there is no tie-order hazard) and is now guarded by the tightened test 21.
- **Layering.** `OutlineEntry` (engine POJO), `HeadingPort` (adapter), `isOutlineBearingPath`
  (`src/shared`, pure) — no `obsidian`/`react` reaches `src/engine` or `src/shared`. Port
  changes are additive where it matters (`CachedMetadataPort.headings?`,
  `OpenNoteOptions.heading?`). `FileMetadata.outline` being **required** is a deliberate
  interface change with exactly two implementers (`ObsidianLinkProvider`, `FakeLinkProvider`
  — I grepped; nothing else constructs a `FileMetadata`), compile-forced, and mirrors
  `attachments`. Correct trade.
- **React Flow `nowheel` works as claimed** — verified in the *installed* `@xyflow/react`
  12.11.2 → `@xyflow/system`: `createZoomOnScrollHandler` returns early (no `preventDefault`,
  no zoom) when `isWrappedWithClass(event, noWheelClassName)`, and `createFilter` returns
  `false` for wheel events inside a `nowheel` subtree. Because it skips `preventDefault`,
  native scrolling of the inner list proceeds. The plan's reasoning about a React `onWheel`
  being the wrong lever is also right (d3-zoom binds `wheel.zoom` natively on the pane).
  The `nopan` addition is harmless: the nopan branch of the filter excludes wheel events
  when `panOnScroll` is off, which it is here.
- **Click does not double-fire `onNodeClick`** — RF attaches its node click handler in the
  same React tree (`VicinityGraphFlow.tsx:43-48` → `onNodeClick` prop), so synthetic
  `stopPropagation()` is the correct lever; `PinButton` and `AttachmentChip` already prove it
  in production.
- **`openLinkText` signature** is exactly as cited (`obsidian.d.ts:7914`, `@public`,
  `@since 0.16.0`) — the API-status column of D6's table is accurate. (Only the escaping
  argument needs fixing — major item 1.)
- **Container-query gating.** Verified `graph-view.css`: `@container (min-height: 72px)`
  reveals the attachment strip + pin button, `@container (min-height: 104px)` reveals the
  thumbnail. Adding the outline to the 104px block is correct and creates no intermediate
  breakage, because mutual exclusivity is enforced in JSX (`showsOutline`), not by CSS
  alone — at every size at most one preview region exists in the DOM. Dropping
  `.__preview-zone` to `flex: 0 0 auto` under `data-preview="outline"` is needed (it is
  `flex: 1 1 auto` today) and the plan has it. `container-type: size` containment is safe:
  the node's box comes from React Flow's wrapper, not from its contents.
- **Settings plumbing (D7 / Step 4)** matches the real files: `SETTINGS_SPEC.globalView` is
  the defaults/limits single source, `ViewSettingsResolver.resolve()` is a per-field cascade,
  `parseViewOverride` is the `definedOnly(...)` parser, `settingsWritePlan` already has the
  `global-view` command that spreads `ctx.globalView`. Clamping in the parser (unlike
  `nodeCap`, which is unclamped) is justified here — an unclamped `0` would be a silent
  off-switch contradicting CLARIFICATION Q2.
- **The plan's transparency correction is CORRECT and valuable**:
  `src/view/VicinityGraphView.tsx:115` does register
  `metadataCache.on("resolved", …) → controller.handleMetadataResolved()`. CLARIFICATION Q3's
  premise is indeed wrong, and the ticket should be scoped as "verify, tighten only if laggy".
- **Memo/diff safety of an array on `FlowNodeData`** — verified `decideLayout` compares only
  `groupByFolder`, force-layout fields, node/edge id sets and `sizePx` growth; node data is
  never inspected. An outline array cannot flip a layout decision. The rejection of a
  flattened delimited string is correct (encoder+decoder = duplicated knowledge, and no
  delimiter is safe in heading text).
- **PARETO.** 9 steps is proportionate: each is a thin, independently committable slice, and
  the only heavyweight step (4, the setting) is mandated by a binding clarification. I looked
  for a materially simpler shape and did not find one worth the trade — see the
  `orderedReferences` note above, which is the one place a "simpler" alternative is actually
  *worse*. Nothing to cut beyond the two vacuous tests.

---

## Questions for the human (passed through verbatim from the plan; both still open)

`#QUESTION_FOR_HUMAN:` (1) Confirm the flagged interpretation in CLARIFICATION
§"Interpretation note": the feature ships with **no on/off toggle** but **with** a global
"Outline depth" slider (1–6, default 2). If you meant literally zero new settings, say so —
the depth becomes a hard-coded constant of 2 and Step 4 (7 files) is dropped entirely.

`#QUESTION_FOR_HUMAN:` (2) CLARIFICATION Q3 assumed no metadata-change trigger exists, but
`metadataCache.on("resolved")` IS wired today (debounced 500ms), so outlines probably already
refresh while you edit. Confirm the follow-up ticket should be "verify, and only tighten if
the lag is bad" rather than "add the missing listener".

**Reviewer's own question:**

`#QUESTION_FOR_HUMAN:` (3) Outline entries render the heading's raw markdown source — a
heading like `## [[Project A]] **status**` shows those brackets and asterisks inside the
node. Ship raw for V1 (zero cost, documented), or strip the formatting for display (small
pure helper + tests)? See major feedback item 2.
