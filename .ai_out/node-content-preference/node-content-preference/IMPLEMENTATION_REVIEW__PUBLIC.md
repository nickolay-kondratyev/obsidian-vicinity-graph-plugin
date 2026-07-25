# IMPLEMENTATION REVIEW — `node-content-preference`, wave A (Phases 1–2)

Reviewed commits: `7b9995a` (Phase 1), `f065510` (Phase 2). Diff base `c5583d5`.
Scope: **Phases 1–2 only.** Phases 3–5 absence is by design and is not reported
as a defect; the seams they need are assessed below.

## Verdict — **APPROVED**

Wave A is genuinely solid. No blocking issues, no lost coverage, no
CLARIFICATION deviation. **Wave B (Phases 3–5) may proceed.**

Two cheap SHOULD-FIX items are comment/organisation honesty, not correctness —
they can ride along in wave B rather than blocking it.

## Independently verified

| Gate | Result |
|---|---|
| `npm run check` (tsc strict) | **exit 0**, clean |
| `npm test` | **1 failed / 892 passed (893)** — the single failure is the known-RED, pre-existing `SettingsSpec.test.ts › limits equal the exact shipped baseline` (`linkStrengthFactor.max` 2 vs 4), author-only per its ticket. Untouched by this branch. |
| Net test delta | +45 `it(` added, −5 removed → +40, matching the 853 → 893 count |
| `it.skip` / `it.only` / `@ts-expect-error` / `any` introduced | **none** |
| Build artifacts (`main.js`, `styles.css`) committed | **none** — only `src/` + `.ai_out/` |

## Summary of what changed

Phase 1 relocates one decision without changing it: `ObsidianLinkProvider`
stops encoding "the image wins" by returning an empty outline
(`outlineOf` → `outlineFactsOf`, returning a named `NoteOutlineFacts`), and
instead reports `FileMetadata.imagePrecedesOutline`. The fact travels
`FileMetadata → TraversedNode → GraphNode` and is consumed once, in
`flowMapping.toFlowNodeData` → `nodePreviewChoice.nodePreviewKind`, whose result
lands on `FlowNodeData.preview`. `NoteNode` now renders `data.preview` and
decides nothing.

Phase 2 adds `ViewSettings.nodePreviewPreference` (`"auto" | "outline" | "image"`,
spec default `auto`) end to end — spec, defaults, resolver, persistence parse,
write plan, reset plan, shared UI copy — with no UI surface yet.

## Independent zero-behavior-change trace (default `auto`)

I traced this myself against the real adapter rather than the rule statement.
Pre-feature: `outline = []` when *(not outline-bearing ∨ no cache ∨ no first
heading ∨ resolved image above the first heading)*, and
`preview = filteredCount > 0 ? outline : hasImage ? thumbnail : none`.
Now: `outline = []` only for the first three; the fourth becomes
`imagePrecedesOutline`, computed **under the identical guards, in the same
method**, with `referencesImageAbove` untouched.

| Note shape | old `outline` | old preview | new `outline` | new IPO | new `auto` preview | identical? |
|---|---|---|---|---|---|---|
| canvas / `*.excalidraw.md` | `[]` | image?thumb:none | `[]` | false | image?thumb:none | ✅ |
| no cache entry | `[]` | image?thumb:none | `[]` | false | same | ✅ |
| headings absent | `[]` | image?thumb:none | `[]` | false | same | ✅ |
| headings, image **after** first heading | full | outline | full | false | outline | ✅ |
| headings, resolved image **above** first heading | `[]` | thumbnail | full | true | thumbnail | ✅ |
| **frontmatter image** (offset sentinel `-1` < any heading offset) | `[]` | thumbnail | full | true | thumbnail | ✅ |
| **unresolvable `![[missing.png]]` above heading**, no other image | full | outline | full | **false** | outline (`!hasImage` guard) | ✅ |
| every heading deeper than `outlineMaxDepth`, image above heading | `[]` | thumbnail | full, filtered → 0 | true | count 0 ⇒ thumbnail | ✅ |
| every heading deeper, no image | filtered → 0 | none | filtered → 0 | false | none | ✅ |
| `references === null` (unorderable) | full | outline | full | false | outline | ✅ |

The only cell where the new function *could* differ is
`imagePrecedesOutline = true ∧ hasImage = false` (new → `outline`, old → `none`).
**I proved it unreachable through the real adapter**, independently of the plan
review: `referencesImageAbove` (`src/adapters/ObsidianLinkProvider.ts:198-209`)
returns true only for a reference that resolves via `resolveReference` and passes
`FileKinds.isImagePath`; `attachmentsOf` (`:272-276`) resolves the *same*
`OrderedReference[]` through the *same* pair and filters only
`!isNodeBearingPath` — and no image extension is node-bearing
(`src/shared/FileKinds.ts:8-11`). So that image is always in `attachments`, and
`VicinityTraversal.ts:157` sets `firstImagePath` from the first `isImage`
attachment. `IPO ⇒ hasImage` holds. Attachments are never filtered by node
exclusion (grep over `src/engine/`), so exclusion cannot break the implication.
The cell is constructible only through `FakeLinkProvider` fixtures, where the new
result (`outline`) is the *more* graceful one and violates nothing.

DOM equality also holds where it matters: `FlowNodeData.outline` now travels
populated in the image-wins case, but the **only** consumer is
`NoteNode.tsx:105`, gated on `data.preview === "outline"` (verified by grep —
`flowMapping.ts` and `NoteNode.tsx` are the only readers). Nothing in
`NodeSizer`/`sizePx`/`elkMapping` reads `outline` or `preview`, so
CLARIFICATION requirement 3 (`sizePx` independent of the preference) holds and a
flip stays a data-only refresh. The `104px` container-query gate is untouched
(requirement 2).

Cross-checked against the release gate: `e2e/nodeOutline.e2e.ts:264-270` (the
"image precedes heading ⇒ `data-preview="thumbnail"`, outline count 0"
behaviour-capturing e2e) still passes by construction, as does `:302`. The
node-contents description text changed, but the e2e only asserts reset *labels*
(`settingsResetReview.e2e.ts:188`, `settingsUxVisual.e2e.ts:164`) and
field-by-field values — none of which the extra reset field breaks.

## Coverage: nothing lost

Five `it(` removals, all accounted for:

- `ObsidianLinkProvider.test.ts:355` / `:385` — the two "the outline is empty
  (the image wins)" cases were **inverted in place** and now assert the outline
  *survives*, which is the honest new fact (the adapter genuinely no longer
  empties it). Their substance moved to the new
  `describe("ObsidianLinkProvider imagePrecedesOutline")` (8 rows, incl.
  frontmatter-link ⇒ true and unresolvable-embed ⇒ false) plus
  `nodePreviewChoice`'s auto rows and `flowMapping`'s auto rows. This is exactly
  the relocation CLARIFICATION Q1 permits.
- Three old `nodePreviewKind` cases were superseded by the 15-row 3 × 5 truth
  table, which asserts each of them plus the previously-unreachable cells.

No anchor point (`ap_XXX_E`) touched; no e2e removed; no behaviour-capturing test
weakened. `PERSISTED_SHAPE_VERSION` correctly stays **2**, and
`parsePluginData` merges `{...defaults.globalView, ...parseViewOverride(raw)}`
(`persistedShapes.ts:95`), so a pre-feature `data.json` keeps every other global
and picks up `auto` — verified by the new upgrade-path test
(`persistedShapes.test.ts` "carries no nodePreviewPreference ⇒ the spec default").

## Registration completeness — all present

`SETTINGS_SPEC.globalView` ✅ · `ViewSpec` ✅ · `EngineDefaults.viewSettings()` ✅ ·
`ViewSettings` ✅ · `ViewSettingsResolver`'s explicit per-field list ✅ ·
`parseViewOverride` ✅ (enum idiom, no second local values array) ·
`SettingsInteraction` + `planSettingsWrite` ✅ · `node-contents` reset scope ✅
(one `global-view` command, both fields) · `SettingsSpec.test.ts` **both**
literals ✅ · `TUNED_VIEW.nodePreviewPreference = "image"` ✅ (non-default, so the
reset assertions are not vacuous) · `makeNode` / `makeViewSettings` fixtures ✅.
`SECTION_RESET_SCOPES` / `ALL_SCOPE_DESCRIPTION` untouched, so the section count
stays 6 and the three e2e `toHaveCount(6)` sites are unaffected.

I searched for other exhaustive `ViewSettings` enumerations that could silently
under-assert (`grep keyof ViewSettings`, every file mentioning `outlineMaxDepth`).
The only two omissions are `VicinityGraphSettingTab.ts` (Phase 3) and
`e2e/settingsResetReview.e2e.ts` (Phase 5) — both explicitly scheduled.

## 🚨 BLOCKING Issues

**None.**

## ⚠️ SHOULD-FIX

1. **`src/view/GraphStructureDiff.test.ts:47-56` — the WHY comment overclaims
   what the test protects.** The comment says *"Any future coupling of node SIZE
   to the preview would relayout the whole graph"*, but `makeNode` hard-sets
   `sizePx: 100` (`src/view/testFixtures/graphFixtures.ts:26`), and `decideLayout`
   only compares `groupByFolder`, `forceLayout`, id sets and `sizePx`
   (`src/view/GraphStructureDiff.ts:32-46`). Failure scenario: a contributor makes
   `NodeSizer` factor the preview into `sizePx`; every pill flip then crosses
   `SIZE_RELAYOUT_THRESHOLD` and relayouts under the user's cursor — and this test
   stays **green**. What the test *does* legitimately guard (and should say) is
   the opposite direction: that nobody adds a
   `previous.viewSettings.nodePreviewPreference !== next…` trigger to
   `decideLayout`. Fix: reword the comment; if the size-independence invariant is
   worth pinning, pin it where `sizePx` is computed (or file it as a Phase-5
   ticket). CLAUDE.md's "EXPLICIT without lies or misconceptions" applies to test
   rationale too.

2. **`src/view/settingsWritePlan.test.ts:113` — the new node-preview test is
   filed inside `describe("planSettingsWrite outline depth")`.** The describe name
   now misdescribes its contents, and a maintainer grepping for node-preview write
   coverage will not find it under that heading. Fix: move it to its own
   `describe("planSettingsWrite node preview")`, adjacent to the outline-depth
   block.

## 💡 Suggestions (NICE-TO-HAVE, no action required in wave A)

- **`NO_OUTLINE_FACTS` (`ObsidianLinkProvider.ts:31`) shares one `outline: []`
  array instance** across every no-outline file, where the old code allocated a
  fresh `[]` per call. `readonly` is compile-time only, so this is safe exactly
  as long as nothing mutates a node outline — which is true today (all consumers
  `map`/`filter`). Worth an `Object.freeze` only if you want the guarantee at
  runtime; otherwise leave it, the allocation win is real.
- **Vocabulary split**: the preference says `"image"`, the render kind says
  `"thumbnail"`. The `switch` in `nodePreviewChoice.ts` is the only bridge, so
  there is no duplication — but the Phase 3/4 UI copy should keep saying "Image"
  and never surface "thumbnail". Pre-existing naming; flagging only so wave B
  does not "align" the two and change the `data-preview` contract that
  `e2e/nodeOutline.e2e.ts` asserts.
- **`imagePrecedesOutline` is honest but narrower than its name suggests**: it is
  measured against the note's *first heading*, while the decision uses the
  *depth-filtered* outline. A note shaped `### deep` → `![img]` → `## shallow`
  with `outlineMaxDepth: 2` reports `false` and shows the outline even though the
  image precedes the only visible entry. The docblock
  (`src/engine/LinkProvider.ts:38-48`) says "first heading" precisely, and today's
  shipped code behaves identically, so this is not a regression — recorded so a
  future maintainer does not "fix" it into a behavior change.
- **`resourcePath` can return `null`** (`ObsidianGraphUi.ts:26-29`) when the image
  file has vanished between build and render, leaving `data-preview="thumbnail"`
  with an empty slot while an outline sits unused in `data.outline`. Pre-existing
  for the auto/cover case and self-healing on the next rebuild, but the `image`
  preference will make it reachable for *every* both-sided note. If wave B wants
  to close it, do it as a ticket — do **not** re-introduce a fallback branch
  inside `NoteNode` (that would move the decision back into the untested
  component).

## Judgements on the implementer's documented deviations

- **`toFlowNodeData(node, mainPinned, view: ViewSettings)` — appropriate, keep
  it.** It is a module-private mapper whose stated job is "apply the effective
  `ViewSettings` to one node's data"; it already derives `tier`, `imageCount`,
  `attachmentGroups` and the depth-filtered outline. The alternative is a
  parameter list that grows by one primitive per knob, which is the worse
  failure mode (positional-arg drift, no compile-time protection against
  transposition). The whole-object seam is not over-broad because `ViewSettings`
  *is* the resolved settings object the caller already holds
  (`flowMapping.ts:196`), and it is not a public API. Verdict: better than the
  narrow version.
- **D1 — `nodePreviewPreferenceMeta.ts` created in Phase 2: legitimate.** The
  Phase 2 reset description must read the default's label from shared copy, and
  the only alternative is a re-typed `"Auto"` string that could outlive a copy
  change. Only the two symbols with a Phase-2 consumer exist; the row
  label/description are correctly deferred so nothing unused ships.
- **D5 — the assert not re-exported from `engine/index.ts`: correct.** It is a
  compile-time guard with no consumer, and the repo's two precedents
  (`_assertEveryForceLayoutFieldGrouped`, `_assertEveryResetScopePlaced`) are
  likewise module-local. I verified the guard is *not* vacuous: with
  `as const satisfies readonly NodePreviewPreference[]`,
  `Exclude<NodePreviewPreference, (typeof NODE_PREVIEW_PREFERENCES)[number]>`
  resolves to `never` today and to the missing literal on omission, which fails
  the `= true` initialiser by name. The PLAN_REVIEW inline fix landed as intended.
- **D3 (case 50 dropped) and D4 (no separate case 35) — no real gap.** Case 50's
  invariant is the `IPO ⇒ outline non-empty ∧ firstImagePath defined` implication;
  its inputs are already pinned by the fact-matrix rows, and the exact-baseline
  literal in `SettingsSpec.test.ts:36,57` asserts the shipped default `"auto"` on
  both sides — a second assertion would be duplicate coverage. Dropping both was
  the PARETO-correct call and both were explicitly permitted by the plan review.
- **D2 (preference wiring in Phase 2) — right call.** Phase 2 is titled "end to
  end"; without it the field would be inert and Phase 3's UI would toggle nothing.

## DRY / SRP / layering

- **The precedence rule lives in exactly one place**: `nodePreviewKind`
  (`src/view/nodePreviewChoice.ts:31-49`). The fact (document offsets) lives only
  in `ObsidianLinkProvider`; nothing re-derives "image before outline" anywhere
  else (grep for `precede` / `before the first heading` finds only docs, tests,
  UI copy and the two owners). The two fallback guards sit *above* the `switch`,
  so "a preference never empties a node" is expressed once, not three times.
  `nodePreviewChoice` remains one exported function + its input type — cohesive.
- The only prose restatement of the rule is user-facing copy in
  `NODE_PREVIEW_OPTION_META` — copy, not logic. Acceptable.
- **Layering clean**: `imagePrecedesOutline` is a plain boolean derived from
  document structure — the same category as `attachments` / `isNodeBearing` — and
  no `obsidian`/`obsidian-id-lib`/`react` import entered `src/engine/` or
  `src/shared/` (`importGuard.test.ts` green). Every new engine symbol is imported
  through `src/engine/index.ts` (`persistedShapes.ts:12`,
  `nodePreviewChoice.ts:1`, `flowMapping.ts:1`), never a deep path. UI copy
  correctly sits in `src/view/`.

## Test quality

Spot-read `nodePreviewChoice.test.ts` (whole file), the new adapter fact matrix,
the `flowMapping` preview describe, the persistence rows and the reset rows. All
BDD `WHEN … THEN …`, one behaviour each, one assert each, non-vacuous, facts
hoisted into named constants rather than inline literals. The two post-filter
cases (`outlineMaxDepth` drops every heading, with and without an image) are the
load-bearing ones and are present. No test is aligned to buggy behavior, no
silent fallback, no assertion that would pass regardless — with the single
exception discussed in SHOULD-FIX 1, which is a mis-stated rationale rather than
a false assertion.

## Seams left for Phases 3–5 — ready

`NODE_PREVIEW_PREFERENCES` (render order), `NODE_PREVIEW_OPTION_META`
(label + description, `Record` over the union so a new option cannot ship
label-less), the `global-node-preview` `SettingsInteraction`, and
`ViewSettings.nodePreviewPreference` for controlled state. Both surfaces already
have their read path (`this.store.globalView()` in the tab;
`ControlsModel.globalView` at `src/view/ControlsModel.ts:59` for the panel) and
share the executor — `applyInteraction` → `persist` → `refreshOpenViews`
(`VicinityGraphSettingTab.ts:449-499`) needs no change, confirmed against the
`global-outline-depth` precedent. No knowledge will need duplicating between the
two surfaces beyond markup, which is the established
`forceLayoutFieldMeta` + `planSettingsWrite` contract.

## PARETO / over-engineering

Nothing to trim. The one piece of new machinery — the completeness assert — is an
existing repo idiom used twice already, and it is load-bearing (it is what keeps
the pill from shipping an option nothing can persist). The 40 added tests are
~4 rows over the minimum (the "neither ⇒ none" guard is asserted once per
preference), which the plan reviewer already judged the better failure mode; I
agree and am not asking for a change.

## Documentation Updates Needed

All already scheduled for Phase 3/5; recorded here so nothing is lost:

- `src/view/VicinityGraphSettingTab.ts:318-319` ("No enable/disable toggle by
  design (CLARIFICATION Q2)") and `:327` (the "Outline depth" description) now
  describe the `Auto` branch only. They are *reachable-stale* today — the field is
  already settable by hand-editing `data.json` — but this is an unreleased branch,
  so Phase 3 fixing them is fine.
- `src/engine/SettingsSpec.ts:120-124` (`outlineMaxDepth`'s "the only way to get
  an image instead is to put it before the first heading") — Phase 5.
- `README.md`, `docs-internal/plan/high-level-plan.md:93`,
  `docs-internal/CHANGELOG.md` (incl. the WHY-NOT for keeping
  `PERSISTED_SHAPE_VERSION` at 2), `scripts/setup-dev-vault.sh` — Phase 5.
- `docs-internal/architecture-map.md`: the Phase 5 "Key seams" line, and consider
  also the `src/adapters/` bullet (`:21-23`), which still reads as though the
  adapter owns content decisions — it now owns facts only.
- The plan's §8.4 follow-up ticket (`EDGE_VISIBILITY_MODES` re-lists a union with
  no completeness guard, now that this feature introduces the better idiom) is
  **not yet filed** — Phase 5 should file it so the two idioms do not drift
  silently.

## Wave B

**May proceed.** Wave A left correct, honestly-named seams; the two SHOULD-FIX
items are comment/organisation touch-ups that can be folded into the wave B
commits.

No `#QUESTION_FOR_HUMAN:` — nothing here needs human judgement.
