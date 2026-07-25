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

---

# IMPLEMENTATION REVIEW — `node-content-preference`, wave B (Phases 3–4)

Reviewed commits: `2ded9db` (Phase 3 — settings-tab pill, + both wave-A
SHOULD-FIX items), `c50ed40` (Phase 4 — controls-panel pill). Record commit
`fb5371f` read but not itself reviewed as code.

Scope: **Phases 3–4 only.** Phase 5 (docs, e2e, tickets) is not yet implemented
and its absence is **not** reported as a defect. Wave A was re-examined only
where wave B could disturb it.

## Verdict — **APPROVED-WITH-FOLLOWUPS**

**0 BLOCKING.** The feature works end to end on both surfaces, the accessibility
is real (I rendered and probed it myself — results below, not taken on trust),
the copy is genuinely single-sourced, and wave A's two guarantees (`sizePx`
independence, one precedence site) are intact. **Wave C may proceed.**

One SHOULD-FIX, doc-only: the DOM contract handed to wave C is missing the one
timing fact that will actually bite its e2e (the panel radio is *controlled*, so
it does not reflect a click until the rebuild lands; the tab radio does so
immediately). Two surfaces, two timing semantics — write it down before wave C
starts guessing.

## Independently verified (I ran these; I did not re-litigate the gates the
## TOP_LEVEL_AGENT already confirmed)

| Gate | Result |
|---|---|
| The 6 test files wave B touches or depends on (`nodePreviewPreferenceMeta`, `settingsWritePlan`, `GraphStructureDiff`, `nodePreviewChoice`, `settingsResetPlan`, `engine/importGuard`) | **6 files / 100 tests passed** (`.tmp/rev-b-tests.log`) |
| `segmented-control.css` actually reaches the shipped bundle (plan risk §7.4 — no unit test can catch a missing `AUTHORED_CSS_FILES` entry) | **yes** — `esbuild.config.mjs:51` registers it; the generated `styles.css` contains 13 `vicinity-graph-segmented` occurrences |
| `:has()` safe at `minAppVersion` 1.12.4 | **yes** — `:has()` shipped in Chromium 105 (Aug 2022); Obsidian 1.12.x is far past it. Also verified it *computes* against the real `styles.css` (see probe row "selected fill"). First use in this repo, correctly flagged in the CSS comment. |
| Class-name collision with the node-exclusion "pill"/chip | **none** — the `pill`/`chip` hits in `graph-view.css` (`:230`, `:268-303`, `:379-382`) are all prose in comments; the only new block is `vicinity-graph-segmented*` + `vicinity-graph-nodecontents*`, both previously unused |
| Layering | clean. `NodeContentsSection.tsx` imports `../engine` (barrel, not a deep path) + `react`; nothing new in `src/engine/` or `src/shared/`; `importGuard.test.ts` green |
| No new `it.skip` / `it.only` / `@ts-expect-error`; no `main.js` / `styles.css` committed | confirmed |

### Probe 1 — the accessibility claims, measured

I rebuilt the exact markup of **both** surfaces from the documented DOM contract,
loaded the repo's real generated `styles.css`, and drove it in Chromium
(scratchpad script, not added to the repo):

| Claim | Measured |
|---|---|
| Native radios inside a named group (not ARIA theatre) | aria snapshot: `- radiogroup "Preview": - radio "Auto" [checked] - radio "Outline" - radio "Image"` — **identical for the tab and the panel** |
| Each radio has an accessible name | `["Auto","Outline","Image"]`, from the wrapping `<label>` — no `id`/`for` needed |
| The group has an accessible name | `"Preview"` (from `aria-label`) |
| ONE tab stop | `Tab` from a radio leaves the group entirely (lands on the next focusable) |
| ArrowRight moves the selection **and** fires `change` (so it writes) | `input:checked` `auto` → `outline`; exactly one `change` event, `value="outline"` |
| 3-radio group cycles | 3 × ArrowRight returns to `auto` — confirms wave C's note |
| Focus ring visible, on the group, not clipped | `box-shadow: rgb(139,108,239) 0 0 0 2px` when a radio is keyboard-focused; `none` otherwise |
| `:has(> input:checked)` fill applies | checked label `background-color rgb(139,108,239)`, `color rgb(255,255,255)` |
| The transparent radio is still hittable | input box == label box (80×23), `display:block`, `visibility:visible`, `opacity:0` — `click()`/`check()`/`toBeChecked()` all work |
| Panel geometry at 260px | pill 244px inside a 260px body (no overflow); segments 80/81/81 = equal thirds |

**The `name`-scoping decision is load-bearing, and correct.** With the shipped
names (tab constant vs `useId()`) I had the tab on `auto` and the panel on
`image` simultaneously. When I forced both groups onto the *same* name, checking
in the tab left the panel with **0 checked radios** — the exact fusion the code
comments predict. There is a second, sharper reason the split matters that the
comments do not mention: React's `updateNamedCousins`
(`node_modules/react-dom/cjs/react-dom.development.js:1937`) **throws**
`"Mixing React and non-React radio inputs with the same name is not supported"`
when a same-named radio has no React fiber — i.e. a shared name between the
Obsidian-built tab pill and the React panel pill would not merely look wrong, it
would raise an invariant error on the first change. The code is right; the
rationale is under-sold.

### Probe 2 — two React roots, and the controlled-input timing

Two `createRoot()`s (as two open graph-view leaves would be), each rendering the
section under `StrictMode`, with the async write path modelled:

- `useId()` produced `:r1:` and `:r3:` — **distinct across roots**, because both
  roots share one bundled `react-dom` instance. So the multi-view case is safe
  and no `identifierPrefix` is needed. (Worth knowing: React's cross-root
  uniqueness is not guaranteed in general — it is guaranteed *here* by the single
  bundled copy.)
- **Immediately after `click()` on "Image", `input:checked` is still `auto`.**
  Only after the async snapshot lands does it become `image`. That is textbook
  controlled-input behaviour (React restores the DOM to `props.checked` at the
  end of the event when state has not changed yet) and it is the deliberate
  house pattern — `SizingSection`/`ForceLayoutSection` behave identically. Not a
  defect. But it *is* the fact wave C needs. See SHOULD-FIX 1.
- Keyboard is coherent through that window: after ArrowRight, focus sits on the
  newly focused radio while `checked` momentarily snaps back to the old value,
  then settles on the new one when the rebuild lands; focus is retained across
  the re-render (`document.activeElement` unchanged). No page errors.

## End-to-end trace (both surfaces, read in the code)

**Settings tab.** `VicinityGraphSettingTab.ts:399` radio `change` →
`applyInteraction({kind:"global-node-preview", value})` (`:400`) →
`planSettingsWrite` (`settingsWritePlan.ts:101`) → `{kind:"global-view", view:
{...globalView, nodePreviewPreference}}` → `persist()` →
`store.saveGlobalView` (`:551`) → `plugin.refreshOpenViews()` (`:512`) →
`main.ts:95-101` → every `VicinityGraphView.refresh()` → rebuild.

**Controls panel.** `NodeContentsSection.tsx:73` `onChange` → `apply()` (`:104`)
→ **the same** `planSettingsWrite({kind:"global-node-preview"})` →
`ControlsActions.applySettings` → `executeSettings` `case "global-view"` →
`pluginDataStore.saveGlobalView` (`ControlsActions.ts:88-89`) →
`controller.handleSettingsChanged()` → `runRebuild()`
(`GraphViewController.ts:152-154`).

**Both converge** on the one `globalView.nodePreviewPreference` — no per-doc
override path is reachable from either surface, so CLARIFICATION Q3 (global only)
holds. From there:

`saveGlobalView` → `ViewSettingsResolver.ts:49` → `graph.viewSettings` →
`vicinityGraphToFlow` (`flowMapping.ts:165-166`) → `toFlowNodeData` (`:302`) →
`nodePreviewKind({preference: view.nodePreviewPreference, …})` (`:322-327`) →
`FlowNodeData.preview` → `NoteNode.tsx:84` `data-preview={data.preview}`, with
`:95` / `:108` gating the thumbnail and `NodeOutline` on the same value. Chain
unbroken.

**Cross-surface reflection.** Tab → panel: `refreshOpenViews()` rebuilds *every*
open view, whose `ControlsModel.globalView` is re-read from the same snapshot the
graph was built from, and the panel radio is fully controlled off it → reflected.
Panel → tab: the tab re-seeds from `this.store.globalView()` on every `display()`
(`:379`), and the settings modal is modal, so the panel is unreachable while the
tab is on screen → the next open shows the new value. Correct.

**Restore-defaults honesty.** `settingsResetPlan.ts:101-110` resets
`outlineMaxDepth` **and** `nodePreviewPreference` in ONE `global-view` command,
and its description reads the default's label from `NODE_PREVIEW_OPTION_META`
(`:100`) rather than re-typing "Auto". `applyReset` then calls `this.display()`
(`VicinityGraphSettingTab.ts:528`), so the pill's checked state actually moves
back — the one path where the tab *does* re-render, correctly. `TUNED_VIEW`
carries `nodePreviewPreference: "image"` (`settingsResetPlan.test.ts:21`), so the
reset assertions are non-vacuous. `SECTION_RESET_SCOPES` still has **6** entries
(`:176-183`).

## 🚨 CRITICAL / BLOCKING

**None.**

## ⚠️ SHOULD-FIX

### 1. The DOM contract omits the timing difference between the two surfaces — wave C will write flaky selectors

`IMPLEMENTATION__PUBLIC.md:288-289` says only *"Assert state with
`toBeChecked()`, never on colours."* That is right but under-specified, and the
two pills are **not** symmetric:

- Settings tab (`VicinityGraphSettingTab.ts:392-397`): plain uncontrolled DOM
  radios. A click is reflected in `.checked` **synchronously**.
- Controls panel (`NodeContentsSection.tsx:66-71`): a **controlled** React radio
  whose `checked` comes from the snapshot. Measured above: right after
  `click()`/`check()` the DOM still reports the OLD value until persist + rebuild
  + re-render complete.

Concrete failure for wave C: `expect(await panelRadio("Image").isChecked())
.toBe(true)` immediately after `.check()` → **false**. Same for
`page.evaluate(el => el.checked)`, `inputValue()`, or any computed-style probe
taken in the same tick. Only the *auto-retrying* form
(`await expect(locator).toBeChecked()`) survives, and case 57's "the panel pill
WRITES the setting" assertion (reading `pluginDataStore.globalView()`) must
likewise be retried or awaited, not sampled once.

Fix (doc-only, ~4 lines in the "Notes wave C needs" list): state that the panel
pill is controlled off the rebuilt snapshot, so every panel-side assertion must
be a retrying `expect(...)`, and that the tab pill is uncontrolled and immediate.

## 💡 Suggestions (NICE-TO-HAVE, none blocking)

1. **The pill has no trough contrast against either host.** Measured on the real
   `styles.css`: `.vicinity-graph-segmented` background, the settings-modal page
   background, and `.vicinity-graph-disclosure`'s background are **all
   `--background-primary`** (`rgb(255,255,255)` in my light stub), and unselected
   segments are transparent. So the pill reads as a 1px hairline box around plain
   text; only the selected segment has a fill. Obsidian's own form controls use
   `--background-modifier-form-field` for exactly this affordance. Swapping
   `segmented-control.css:29` to that (still a theme variable, still light/dark
   safe) would make the control look like a control. Taste call — see the human
   question below.
2. **Focus ring and selected fill are the same colour.** Both are
   `--interactive-accent` (`segmented-control.css:43` and `:91`). When the
   selected segment sits at the group's edge — which it does for `Auto`, the
   shipped default — the 2px ring abuts the fill with only the 1px
   `--background-modifier-border` between them, so the focus indicator is
   effectively only visible on the group's other three sides. Not a violation,
   but a `--text-accent`-toned ring or a 1–2px offset would read better.
3. **`useId()`'s docblock oversells its guarantee** (`NodeContentsSection.tsx:98-102`
   "must be unique per mount, or two graph views … would fuse"). Measured: the
   two roots do get distinct ids, but that is because both share one bundled
   `react-dom`, not because `useId` promises cross-root uniqueness. Consider
   saying that; and consider mentioning the sharper reason for the split (React's
   `updateNamedCousins` *throws* on a React/non-React same-name mix), which makes
   the tab-constant-vs-`useId` choice a correctness requirement rather than a
   cosmetic one.
4. **A panel write does not refresh *other* open graph views** —
   `ControlsActions.applySettings` calls only `this.controller.handleSettingsChanged()`,
   while the settings tab fans out via `refreshOpenViews()`. Pre-existing and
   shared by `SizingSection`/`ForceLayoutSection`, so **not** wave B's doing; the
   new pill just makes it more visible (a second view keeps showing the old
   segment selected until it rebuilds for another reason). Ticket, not a fix here.
5. `NodeContentsSection` does not pass `bodyClassName="nowheel"` the way
   `SizingSection.tsx:39` does. Correct as-is — the toolbar root already carries
   `nowheel nodrag nopan` (`GraphToolbar.tsx:38`) — so `SizingSection` is the
   redundant outlier. No action, recorded so nobody "fixes" the new file.

## Explicit call on deviation **B2** (`--text-on-accent`, no fallback)

**Accept as implemented. Do not add a fallback.** Reasoning:

- `--text-on-accent` is a core Obsidian variable (the one `.mod-cta` and the
  native checkbox use) and is defined for both light and dark in `app.css`. It is
  the *paired* variable for `--interactive-accent`, which this repo already uses
  in three places (`graph-view.css:469`, `:606-609`, and now here) — a theme that
  overrides one overrides both, so the pair travels together.
- The rejected fallback `var(--text-on-accent, var(--text-normal))` would indeed
  be **worse than nothing**: `--text-normal` on an accent fill is illegible in
  dark themes, so the fallback would convert a loud failure into a quiet one.
  The implementer's reasoning is sound and I agree with it.
- Residual risk is genuinely low but *not* zero-verified: my grep confirms this
  is the repo's **first** use of `--text-on-accent`, so there is no shipped
  precedent to lean on, and my probe used stubbed values rather than a real
  `app.css`. Keep it on wave C's real-Obsidian eyeball list (light **and** dark),
  where it is already recorded.

## Did wave B disturb wave A?

- **`sizePx` still preference-independent.** Nothing in `NodeSizer`,
  `elkMapping.ts` or `GraphStructureDiff.ts` mentions `preview`/`Preview`
  (grepped: zero hits), and wave B's only production changes are the two UI
  surfaces plus CSS. CLARIFICATION req 3 holds; a flip stays a data-only refresh.
- **The precedence rule is still in exactly ONE place.** `nodePreviewKind` is
  defined in `nodePreviewChoice.ts:25` and called from exactly one non-test site,
  `flowMapping.ts:322`. Nothing in wave B added a second decision.
- **SHOULD-FIX 1 (the lying tripwire comment) is genuinely resolved.**
  `GraphStructureDiff.test.ts:47-56` no longer claims to guard a size↔preview
  coupling; it states what it pins (no `nodePreviewPreference` trigger in
  `decideLayout`) *and* names the gap it cannot see, with a pointer to where that
  belongs. Reworded rather than strengthened — the right choice, and honest.
- **SHOULD-FIX 2 (the misfiled write-plan test) is genuinely resolved.** Moved
  verbatim from `describe("planSettingsWrite outline depth")` into
  `describe("planSettingsWrite node preview")` (`settingsWritePlan.test.ts:124-132`),
  assertion byte-identical. Correctly filed now.

## DRY / SRP

- **Copy is single-sourced, with zero duplicated strings.** `NODE_PREVIEW_ROW_LABEL`,
  `NODE_PREVIEW_ROW_DESCRIPTION` and the per-option `label`/`description` live
  only in `nodePreviewPreferenceMeta.ts`; grepping `"Auto"`/`"Outline"`/`"Image"`
  across `src/` and `e2e/` finds them **only** in that file (plus one mention
  inside a comment in `settingsResetPlan.ts:96`). All three consumers — the tab
  (`VicinityGraphSettingTab.ts:382-398`), the panel
  (`NodeContentsSection.tsx:114-136`) and the reset description
  (`settingsResetPlan.ts:100`) — read the table. Render order comes from
  `NODE_PREVIEW_PREFERENCES` on both surfaces, never `Object.keys`.
- **The markup duplication is the sanctioned kind**, matching the
  `forceLayoutFieldMeta` contract the CLARIFICATION named (derived req 6): shared
  DATA, per-surface MARKUP, because Obsidian's `Setting` API cannot mount inside
  React. No business rule is duplicated — both surfaces emit the identical
  `{kind:"global-node-preview"}` interaction and neither merges fields itself.
- **`NodeContentsSection.tsx` is cohesive** (80 lines, one section, one control,
  no local state, no decision), and `addNodePreviewSegmented`
  (`VicinityGraphSettingTab.ts:378-403`) is a single focused private method
  consistent with the file's other `addX` helpers.

## Settings-tab UX

- The "Preview" row is `new Setting(section).setName(...).setDesc(...)` with its
  control in `controlEl` — **structurally identical** to the sibling "Outline
  depth" row, so name/description/control sit at the same altitude in the same
  card. Row order general → specific (which preview, then how deep) is right, and
  the docblock (`:333-339`) now explains it.
- The superseded "No enable/disable toggle by design (CLARIFICATION Q2)" docblock
  and the "Outline depth" description's stale image clause are both fixed, and I
  confirmed no e2e asserts either string (`grep` over `e2e/` for
  `setting-item-description` / the old sentence: zero hits), so nothing goes red.
- Section count is still **6** (`SECTION_RESET_SCOPES`), reset labels unchanged.

## Test quality (not count)

- `nodePreviewPreferenceMeta.test.ts` — 2 cases, BDD-named, one behaviour each,
  **not** vacuous: both would fail on a real collision (duplicate segment labels;
  row label equal to a segment label), and the docblock explains why a `Record`
  over the union cannot catch either. Modest value, honestly scoped — they guard
  the accessible names wave C will select by. No theatre.
- **No test covers either pill's markup or the panel's write**, and the
  implementation says so plainly rather than papering over it. I verified the
  stated reason: `package.json` has **no jsdom and no React testing library**,
  vitest runs in the `node` environment, and there is not a single `*.test.tsx`
  in `src/`. So a React section genuinely cannot be rendered in `npm test`, and
  faking it with a non-rendering test would be exactly the kind of lie CLAUDE.md
  forbids. The gap is real but correctly located in e2e cases 54–57 (Phase 5).
  **Wave C must actually deliver case 57** (the panel pill writes the global) —
  that is now the only automated proof of the panel half.

## PARETO / over-engineering

Nothing over-built. The CSS is ~60 lines of rules for a control used twice; the
segmented-control file earns its separate existence (two surfaces, and
`AUTHORED_CSS_FILES` makes the concatenation explicit). `NODE_PREVIEW_RADIO_GROUP`
as a tab-local constant instead of a shared export is the *right* asymmetry and is
documented on both sides. No speculative abstraction, no unused symbol
(`NODE_PREVIEW_ROW_DESCRIPTION` is consumed by the tab; the panel deliberately
uses per-option `title` tooltips instead, which is the panel's existing idiom per
`ForceLayoutSection`).

Under-specified for wave C: only SHOULD-FIX 1. Otherwise the DOM contract at
`IMPLEMENTATION__PUBLIC.md:233-296` is accurate — I built my probe from it and it
matched the code and the shipped CSS exactly, including the `useId()` warning,
the option order, the scoping requirement for the two simultaneous radiogroups,
and the `overflow: hidden` / `borderTopStyle` computed-style probe suggestion.

## Documentation Updates Needed

Unchanged from wave A's list minus the two items wave B absorbed (the settings-tab
docblock, and the "Outline depth" description). Still owed by Phase 5:
`README.md:59-66` + `:137-146` (`:138` "**heading outline** or its **first
image**, never both" now needs the pill), `docs-internal/plan/high-level-plan.md:93`
("decided by document position" is now the `Auto` branch only),
`src/engine/SettingsSpec.ts:118-124`, `docs-internal/architecture-map.md`
("Key seams" + the `src/adapters/` bullet), `docs-internal/CHANGELOG.md` (incl.
the WHY-NOT for keeping `PERSISTED_SHAPE_VERSION` at 2),
`scripts/setup-dev-vault.sh:359-368`. I grepped `README.md`, `CLAUDE.md`,
`architecture-map.md`, `high-level-plan.md` and `scripts/*.sh` for references to
the authored-CSS source list: **none** — so the new CSS file creates no further
doc debt beyond the `.gitignore` comment wave B already fixed.

Plus the tickets Phase 5 owes, which I endorse: §8.4 (`EDGE_VISIBILITY_MODES`
completeness guard), pinning the `sizePx`-independence invariant where `sizePx`
is computed, the panel's missing Outline-depth slider, and — new from this review
— suggestion 4 above (panel writes not fanning out to other open views).

## Wave C

**May proceed.** Nothing in wave B blocks it. Carry these three into wave C:

1. Fold SHOULD-FIX 1 into the DOM contract before writing selectors.
2. Case 57 (panel pill writes the global) is now the only automated proof of the
   panel half — it must land.
3. The real-Obsidian light+dark eyeball must specifically judge
   `--text-on-accent` on the selected segment (deviation B2) and the trough
   contrast raised in suggestion 1.

`#QUESTION_FOR_HUMAN:` The segmented control's unselected trough uses
`--background-primary`, which is byte-identical to the background of both hosts
(the settings-modal page and `.vicinity-graph-disclosure`) — I measured all three
resolving to the same colour. The pill is therefore delineated only by its 1px
`--background-modifier-border`, and its unselected segments look like plain text.
Obsidian's own inputs use `--background-modifier-form-field` for this trough.
**Do you want the pill's trough switched to `--background-modifier-form-field`,
or is the hairline-only frame the look you want?** (Purely a visual call, and one
I cannot settle without a real Obsidian; the current code is theme-safe either
way.)

---

# IMPLEMENTATION REVIEW — `node-content-preference`, wave C + WHOLE-FEATURE ACCEPTANCE

Scope: wave C = `ac27f8d` (trough + Phase 5 docs/e2e/tickets) and `f570a44` (record),
plus a whole-feature acceptance pass over `git diff main..HEAD`. Waves A and B above are
preserved unchanged.

## Verdict — **NEEDS-ITERATION** · 1 BLOCKING · **DO NOT SHIP YET**

The **feature itself is done and is genuinely good work**: every binding requirement in
the human-approved CLARIFICATION passes, the layering is clean, the precedence rule is one
pure function, the docs are reconciled as *superseded, not contradicted*, and I could not
find a single weakened, skipped or loosened assertion anywhere in the diff.

The blocker is **not** in `src/`. It is that wave C's three new e2e cases, inserted into the
middle of a `serial` file, **deterministically break the pre-existing case that follows
them** (`e2e/nodeOutline.e2e.ts:339`, the outline-threshold layout guard). Wave C did not
see it because that file dies earlier from an unrelated environment flake in this
container, and because the new cases were verified in isolation with `--grep`. I found it
by running the file in a controlled worktree. It is a ~3-line e2e fix, and once it is
fixed this branch ships.

## Acceptance table — every binding requirement in `CLARIFICATION__PUBLIC.md`

| # | Binding requirement | Verdict | Evidence |
|---|---|---|---|
| Q1 | 3-way `Auto` / `Outline` / `Image` | **PASS** | `src/engine/types.ts` `NodePreviewPreference` + `NODE_PREVIEW_PREFERENCES` single-sourced, with a compile-time completeness assert |
| Q1 | Pill exposed on **both** settings tab and graph controls | **PASS** | `VicinityGraphSettingTab.addNodePreviewSegmented` + `src/view/NodeContentsSection.tsx`; e2e cases 51/52/55/56 green in the full real-Obsidian run |
| Q1 | No previously supported behavior removed; the "image wins" behavior-capturing assertions survive **in substance** | **PASS** | The two adapter assertions were *relocated*, which the CLARIFICATION expressly permits: new `ObsidianLinkProvider.test.ts` `imagePrecedesOutline` describe (7 cases incl. frontmatter + unresolvable embed), `nodePreviewChoice.test.ts:36`, `flowMapping.test.ts` auto branch, and e2e `:264` still asserts the positional result end-to-end |
| Q1 | Docs **superseded, not contradicted** | **PASS** | `README.md:142-158`, `high-level-plan.md:93` (+ a new "where that decision lives" bullet), `architecture-map.md` LinkProvider seam, `SettingsSpec.ts:121-131`; `grep "CLARIFICATION Q2"` leaves only unrelated hits |
| Q2 | Default `auto`, zero visible change on upgrade | **PASS** | `SETTINGS_SPEC.globalView.nodePreviewPreference = { default: "auto" }` |
| Q2 | Do **not** bump `PERSISTED_SHAPE_VERSION` | **PASS** | still `2`; `parseViewOverride` validates against `NODE_PREVIEW_PREFERENCES` and falls through to the spec default |
| Q3 | Global scope only, no per-doc override | **PASS** | listed at `ViewSettingsResolver.ts:48` as required; no UI or write path produces a per-doc override (the parser accepts the key only because `globalView` shares that parser — reviewed and accepted in wave A) |
| Q3 | Both surfaces edit the **same** global value | **PASS** | both emit `{ kind: "global-node-preview" }` through `planSettingsWrite`; e2e case 55 asserts the *panel* writes the same global the tab writes |
| D1 | Graceful fallback — a preference never empties a node | **PASS** | `nodePreviewChoice.ts:33-38` short-circuits *before* the preference switch; full 3×5 truth table in `nodePreviewChoice.test.ts` |
| D2 | "Fits" = existing 104px container query, no JS measurement | **PASS** | no measurement code added; the 104px gate is untouched and symmetric for both regions |
| D3 | `sizePx` must NOT depend on the preference | **PASS** | `toFlowNodeData` passes `node.sizePx` through; nothing in sizing/elk/`GraphStructureDiff` reads `preference` or `preview`; tripwire test present |
| D4 | Precedence = one pure, unit-testable function | **PASS** | `src/view/nodePreviewChoice.ts` is the only place; `NoteNode.tsx` now renders and decides nothing |
| D5 | Adapter stops discarding the outline; reports the fact | **PASS** | `outlineFactsOf` + `FileMetadata.imagePrecedesOutline`, threaded through `TraversedNode` → `GraphNode` → `FlowNodeData.preview` |
| D6 | Shared data + write path, duplicated markup | **PASS** | `nodePreviewPreferenceMeta.ts` (copy) + `planSettingsWrite` (write); radio `name` deliberately **not** shared — tab constant vs `useId()` — which is load-bearing (see wave B) |
| D7 | Docs to update: README, `high-level-plan.md:93`, superseded comments | **PASS** | all three, plus CHANGELOG, architecture-map and the dev-vault smoke checklist |
| D8 | Do not touch the known-RED `linkStrengthFactor.max` baseline | **PASS** | untouched |
| — | e2e integrity: nothing weakened/skipped to manufacture green | **PASS** | **zero** deleted lines across `git diff main..HEAD -- e2e/`; no `.skip`/`.only`/`.fixme`; no loosened timeouts or counts |
| — | e2e integrity: new cases must not break existing ones | **FAIL** | **BLOCKING B1 below** |

## The e2e integrity claim — how I verified it, and what I found

Wave C's report is **substantially honest** and its numbers reproduce exactly. It also
volunteered the two things a self-serving report would have hidden (that the 3 nodeOutline
cases could not run in the full suite, and that the light-theme trough change is a no-op).
Two independent cross-checks:

1. **The arithmetic is airtight.** `npx playwright test --list` → **76 tests**, matching
   `53 + 3 + 20`. And "20 did not run" is exactly the serial-file cascade, to the test:
   `nodeOutline:92` is #1 of 14 (13 skipped) + `vicinityGraph:160` is #13 of 19 (6) +
   `edgeRoutingEval:171` is #5 of 6 (1) = **20**. So "did not run" is Playwright serial-mode
   cascade, **not** silent exclusion of tests. `.tmp/wc-e2e-full.log` matches line for line,
   including all 6 new `settingsUxVisual` cases passing as items 51–56.
2. **Nothing was weakened.** `git diff main..HEAD -- e2e/` has **0 deleted lines**, no
   `.skip`/`.only`, no timeout or count loosening. The only `toHaveCount` touched is a newly
   *added* `toHaveCount(3)` for the pill's three radios. Claim confirmed.

### The `nodeOutline.e2e.ts:92` flake IS pre-existing — but wave C never actually proved it

Wave C's proof was "two runs on a `git stash`-ed, pristine tree". `.tmp/wc-stash.log` shows
the stash was `WIP on node-content-preference: c96640d` — the **wave B tip**. Waves A and B
were still applied; only wave C's own changes were stashed. So that experiment could only
exonerate wave C, not the feature.

I ran the missing experiment. `git worktree` from **true `main`**, `node_modules` symlinked,
same cached Obsidian 1.12.7 (logs in `.tmp/reviewC/`):

| Vault state | Code | `:92` result |
|---|---|---|
| worktree vault, **no** saved `workspace.json` | `main` | 11/11 pass ×4 runs |
| worktree vault, **no** saved `workspace.json` | HEAD, E8 excluded | 11/11 pass |
| worktree vault **+ the repo's saved `workspace.json`** | **`main`** | **FAILS at `:92`** (1 of 2 runs) |
| worktree vault **+ the repo's saved `workspace.json`** | HEAD, E8 excluded | fails 2/2 |
| the repo's own `.dev-vault` (has a saved `workspace.json`) | HEAD | fails 2/2 |

**Conclusion: the flake is real, pre-existing, and reproduces on true pristine `main` — so
wave C's attribution is correct and the feature does not cause it.** The trigger I isolated
and which the ticket does not yet record: it appears only when
`.dev-vault/.obsidian/workspace.json` exists (saved pane geometry ⇒ a small graph pane ⇒
React Flow culls the MAIN node). A vault without it went 5/5 green. That belongs in the
ticket, because it is also the workaround for validating the fix to B1.

### Panel controlled/uncontrolled caveat — followed correctly

Wave B's SHOULD-FIX landed. `settingsUxVisual.e2e.ts:238-251` carries the asymmetry as a
block comment, and every panel-side assertion is retrying: `expect.poll(storedPreviewPreference)`
(case 55) and `expect(locator).toBeChecked()` (case 56). No `isChecked()`, no
`evaluate(el => el.checked)`, no `inputValue()` on the panel. `.click()` is used rather than
`.check()`, with the reason stated. The one-shot `evaluate` samples are all on the
**uncontrolled tab** pill, which is correct. **No latent flake here.**

## 🚨 BLOCKING

### B1 — the 3 new E8 cases deterministically break the pre-existing E7 guard

`e2e/nodeOutline.e2e.ts:339` — *"an outline-bearing node below the outline threshold still
pins its attachment strip to the bottom"* — now fails **every** run, on the assertion at
`:350`:

```
Expected: hidden   Received: visible
  locator('.vicinity-graph-node[data-path="outline-note.md"]').locator('.vicinity-graph-outline')
```

**Root cause.** E7 documents its own precondition at `:341-342`:

```ts
await harness.setMaxNodeSizePx(BELOW_OUTLINE_THRESHOLD_PX);
// A sizing change alone does not rebuild; an active-file change does (the
// current MAIN is outline-cover, so this is a real change).
await harness.openFile(OUTLINE_NOTE_PATH);
```

E7 relies on the *previous* test leaving **outline-cover** as the active file, so that
`openFile(outline-note)` is a genuine active-file change — which is the only thing that
triggers the rebuild that applies the new 96px `maxPx`. Wave C's E8.2/E8.3 leave
**outline-note** as the active file. `openFile(OUTLINE_NOTE_PATH)` is therefore a **no-op**,
no rebuild happens, nodes stay at 160px, and the outline stays visible. Deviation C1
correctly preserved the *preference* invariant (case 53 restores `auto`) but silently broke
the *active-file* invariant printed two lines below the insertion point.

**Proof (controlled A/B — same worktree, same `.dev-vault`, only the code differs):**

| Code under test | Result |
|---|---|
| HEAD, whole file (14 tests) | **13 passed / 1 failed — E7 — on 3 of 3 runs** |
| HEAD, same file, E8's 3 cases excluded via `--grep-invert` (11 tests) | **11/11 pass** |
| `main` (11 tests) | 11/11 pass ×2 |

Excluding only the three new cases turns the file green on the identical build, so the
insertion is the sole cause.

**Why it matters beyond the test:** E7 is a behavior-capturing guard for a real layout rule
("the outline's layout rule must not leak below its own threshold"). It is now permanently
red, i.e. effectively disabled — which the repo's guardrails forbid without explicit human
alignment. Worse, it is *invisible in this container* (the `:92` flake kills the file first),
so **the human running e2e on a real desktop, where `:92` passes, will see E7 fail and it
will look like this feature broke the layout rule.**

**Fix — prefer the second; both are ~3 lines and neither touches `src/`:**

- Make E7's rebuild explicit rather than inherited: after `setMaxNodeSizePx(...)`, call
  `await harness.remountGraphView()` (the helper E8 already uses) instead of depending on
  which file happens to be active. This removes the implicit coupling for good.
- Or make the active-file change real locally: open a different file first
  (`OUTLINE_COVER_PATH` or `NON_NODE_BEARING_PATH`) before `openFile(OUTLINE_NOTE_PATH)`,
  and update the `:341-342` comment so it no longer states an invariant it does not own.

**Verify the fix by running the WHOLE file**, not `--grep` — and in a vault with no saved
`.obsidian/workspace.json`, otherwise `:92`'s flake hides the result again (see S1/S2).

## ⚠️ SHOULD-FIX

### S1 — the verification method that missed B1

The 3 new cases were verified with
`npm run test:e2e -- nodeOutline.e2e.ts --grep "Preview preference|document position decides again"`.
In a `serial` file, `--grep` **cannot by construction** observe the damage an insertion does
to its neighbours: it removes exactly the neighbours. Combined with the `:92` flake making
the full file uninformative in this container, wave C had no signal at all. Record the rule:
**a change to a serial e2e file must be validated by running the whole file, in an
environment where that file is otherwise green.**

### S2 — correct the "pristine tree" claim in the ticket and the record

`IMPLEMENTATION__PUBLIC.md:464-466` ("two runs on a `git stash`-ed, pristine tree") and
`docs-internal/tickets/ticket-e2e-headless-culling-unmounts-main-node.md:4-6` ("reproduced on
a **pristine `main`** tree, so nothing in that feature branch causes it") claim evidence that
was not produced — the stash was to `c96640d`, with waves A+B still applied. The
*conclusion* is right (I confirmed it on true `main`), so this is a wording fix, not a
retraction. While editing that ticket, add the trigger I isolated: the flake appears only
when the dev vault carries a saved `.obsidian/workspace.json`; without one it went 5/5 green.
That is both the missing root-cause detail and the workaround needed to verify B1's fix.

## 💡 NICE-TO-HAVE

- **N1** — the settings tab's pill is built once from the store and has no `display()` on
  external writes, so it goes stale if the *panel* writes the preference while the tab is
  open. Identical to every other tab control (sliders behave the same way), and
  `nid_u36pqr4zljs44jt42lk9ln8ry_e` is adjacent. No action now.
- **N2** — E8.3 ("back on Auto") relies on E8.2 leaving `outline-note` as MAIN: the same
  class of implicit coupling that produced B1. Once B1 is fixed with an explicit rebuild
  step, E8.3 should use it too.

## The trough change (human decision) — implemented and honest

`src/view/segmented-control.css:44` is `var(--background-modifier-form-field)`, purely
theme-variable-driven, and it **is** in the generated `styles.css` (`:1156` and `:1673`) —
the `AUTHORED_CSS_FILES` entry from wave B is present, so the shared stylesheet reaches both
DOMs (now also pinned by e2e case 53's `overflow: hidden` probe). `main.js` and `styles.css`
are untracked build artifacts, so no hand-edit is even possible.

The WHY/WHY-NOT comment a future reverter would need **exists** at `segmented-control.css:29-43`
and is **accurate**: it names the rejected `--background-primary`, states the measured
`app.css` mapping (`body → --color-base-00`, `.theme-dark → --color-base-25`), and says
plainly that the default **light** theme change is a visual no-op because Obsidian's own
light inputs are hairline-framed too. The e2e case asserts the one theme-independent promise
(`selectedFill !== trough`) and logs the rest as evidence rather than asserting theme colours.
This is the right call and I did not second-guess the decision itself.

## Tickets — real, correctly scoped, nothing important left unfiled

Both markdown tickets exist and are substantive (probe transcript, three candidate fixes,
"five consecutive green runs" as the acceptance bar; the smoke-run ticket records the measured
colours so nobody re-derives them). All 6 CLI ids resolve in `ticket ls` as **open**. Coverage
of the genuinely deferred items: deviation B2's real-Obsidian eyeball ✓, the `:92` culling
flake ✓, the e2e baseline triplication ✓ (correctly filed after checking that the ticket the
plan assumed existed did not). None of them should have been fixed inline instead.

**The one real issue with no ticket is B1 — and it must be FIXED, not ticketed.**

## Final quality sweep

DRY/SRP/layering intact across the whole diff. `nodePreviewPreferenceMeta.ts` is a real DRY
win (the reset description reads the option label instead of re-typing "Auto").
`outlineFactsOf` merging two answers under shared guards is correct SRP, not a `Pair`.
`toFlowNodeData` computing the outline once and reusing it for both the data and the decision
removes the duplicated filter. No dead code, no test theatre (the 15-case truth table is the
real contract, and the e2e cases assert user-visible DOM), no over-engineering.
`npm run check` / `npm test` / `npm run build` as reported; the sole red is the author-only
`linkStrengthFactor.max`, untouched.

## Remaining risk for the human's real-Obsidian smoke run

1. **You will see `nodeOutline.e2e.ts` fail** — at `:92` if your vault has a saved
   `workspace.json` (pre-existing flake, reproduces on `main`, ticketed), and at `:339`
   otherwise (**B1** — this branch's fault, fix it first).
2. Genuinely open and unautomatable: `--text-on-accent` legibility on the accent fill under a
   **third-party theme**; the focus ring sharing `--interactive-accent` with the selected fill;
   260px-panel ellipsis. All three are in `ticket-node-preview-pill-human-smoke-run.md`, with
   the default-theme colours already measured.
3. Everything functional is covered: unit truth table + real-Obsidian e2e on both surfaces,
   including that the panel pill writes the same global.

## SHIP / DO-NOT-SHIP

**DO NOT SHIP as-is.** One blocking defect (**B1**), entirely inside `e2e/`, no `src/` change
required. The feature implementation itself is accepted against every binding requirement.
Fix B1, correct S2's wording, re-run the whole `nodeOutline.e2e.ts` file, and this **SHIPS**.

---

# CONFIRMATION PASS — iteration round 1 (`1623084`, record `a463c1d`)

Focused re-review of the three items only. Everything above is preserved verbatim; the
whole-feature acceptance granted in the wave C section still stands, unchanged.

## B1 — RESOLVED, and it is a root fix

**The dependency is gone, not the symptom.** E7 (`nodeOutline.e2e.ts:353`) previously relied
on `openFile(OUTLINE_NOTE_PATH)` being a REAL active-file change to trigger the rebuild that
applies its store-only `setMaxNodeSizePx(96)` write. It now calls
`showNoteWithRefitGraph(OUTLINE_NOTE_PATH)` — `openFile` → `remountGraphView()` → assert
`data-tier="main"`. `ObsidianHarness.remountGraphView()` (`e2e/obsidianHarness.ts:275-283`)
detaches every graph leaf and re-runs `openGraphView()`, so the view is rebuilt from the
store **unconditionally**, whether or not the file was already active. E7 is therefore
correct at any position, under any predecessor. That is the root cause, not a workaround.

**Zero assertions weakened.** Verified line by line: the 18 removed lines in `e2e/` are 16
comment/docblock lines plus the two statements (`openFile` + the `data-tier="main"`
expectation) that the helper now performs itself — the tier assert is preserved inside the
helper, not dropped. No `.skip`, no `.only`, no loosened timeout, no changed matcher, no
deleted case. E7's five substantive assertions (`data-preview="outline"`,
`outlineOf(...).toBeHidden()`, the two band bounds, `slackPx ≤ MAX_SUB_PIXEL_SLACK_PX`, plus
the non-null strip precondition) are byte-identical.

**`src/` untouched.** `git diff --stat b4f3556..a463c1d` = 2 `.ai_out/` records +
`docs-internal/tickets/ticket-e2e-headless-culling-unmounts-main-node.md` +
`e2e/nodeOutline.e2e.ts`. No `src/` file, no unit test, no `main.js`/`styles.css` (both are
untracked build artifacts anyway). The acceptance table needs no re-derivation.

**The lying comment is now accurate.** `:355-358` states the actual mechanism ("a sizing
write alone does not rebuild … re-opening the already-active one is a silent no-op") — that
is a fact E7 owns, not an invariant about a neighbour it cannot enforce. The helper docblock
now carries **two** load-bearing reasons, and reason 1 (explicit rebuild) is the one that
must survive the culling flake's eventual fix; step 3 of the ticket says exactly that, which
closes the loop that would otherwise have re-introduced B1.

**E8.3 was in scope, not scope creep.** E8.3 inherited its MAIN from E8.2 — the identical
class of coupling, one line, same file, same rule, and its assertion remains a real
transition (the added `showNoteWithRefitGraph` runs while the preference is still `image`, so
`data-preview` genuinely flips `thumbnail → outline` once
`setNodePreviewPreference("auto")` fires `refreshOpenViews()`). Fixing the sibling instance
of the bug you were sent to fix is the right size of fix; the implementer explicitly declined
the broad refactor of E1–E5 (which carry no B1-class coupling — they do no store writes, and
`pic.jpg` is non-node-bearing so the MAIN never moves).

## S1 — RESOLVED

The lesson is recorded in all three places where it will be seen at the moment it matters:
- the **file docblock** (`nodeOutline.e2e.ts:25-26`): "Insert a case here ⇒ re-run the WHOLE
  file (`--grep` removes exactly the neighbours that would expose the coupling)" — this is
  the one that counts, because it is in the file being edited;
- **step 2 of the culling ticket**: "Run the WHOLE file, never `--grep`";
- the **round-1 PUBLIC record**, with the causal story (wave C's `--grep` verification had no
  signal about the damage it did).

## S2 — RESOLVED, honest, one precision quibble (non-blocking)

The false "reproduced on a **pristine `main`** tree" claim is gone, replaced by an explicit
*"Attribution — what was actually verified, and by whom"* section that states wave C's stash
was to `c96640d` (the wave **B** tip, waves A+B still applied, so it exonerated wave C only),
that the IMPLEMENTATION_REVIEWER ran the missing experiment from a worktree on true `main`,
and that the trigger is a saved `.dev-vault/.obsidian/workspace.json` — with the measured
pass/fail table and an explicit "this is the workaround, not the fix". No overclaim in the
other direction either: the ticket keeps its "pure race … biased by the restored pane
geometry" framing and still demands 5 consecutive runs **with** `workspace.json` present as
its acceptance bar. It also no longer says the pre-existing cases "were deliberately left
untouched" without qualification, since E7 now uses the helper.

Quibble for whoever picks the ticket up (**not** a blocker, no new ticket warranted): the
table's *"reviewer 5/5 on `main`"* over-attributes — those five green `:92` observations were
five runs **in a vault without `workspace.json`**, of which 2 were on true `main` and 3 on
the branch. And the WITH-`workspace.json` row reads as deterministic; my own measurement on
`main` was 1 red of 2 runs. The conclusion the ticket draws is correct and the prose elsewhere
in the ticket says "race", so this is wording precision, not a false claim.

## Nothing regressed

Re-confirmed from the diff, not assumed: `src/` unchanged this round, unit tests unchanged,
build artifacts untouched, `e2e/` net +24 lines with 0 assertion deletions. The whole-feature
acceptance above therefore carries over verbatim.

## SHIP / DO-NOT-SHIP

**SHIP.** B1, S1 and S2 are all genuinely resolved. Zero blocking findings remain.

## Residual risk for the human's smoke run (each pre-existing, each ticketed)

| Risk | Caused by this feature? | Ticket |
|---|---|---|
| `nodeOutline.e2e.ts:92` culling flake kills the serial file when `.dev-vault/.obsidian/workspace.json` exists | **No** — I reproduced it on true `main` from a worktree | `docs-internal/tickets/ticket-e2e-headless-culling-unmounts-main-node.md` (now carries the trigger + acceptance bar) |
| `edgeRoutingEval.e2e.ts:171` *radial layout SKIPS routing (gated)* | **No** — the test drives a layout mode a PRIOR ticket removed; it is named explicitly in that ticket's leftovers list | `ticket` CLI `nid_6lxaenl4oamjxqj6f0eh6rr4c_e` (open) |
| `vicinityGraph.e2e.ts:160` singleton-folder breadcrumb, headless only | **No** — pre-existing headless-only | `docs-internal/tickets/ticket-e2e-gamma-breadcrumb-fails-headless.md` |
| Deviation **B2**: `--text-on-accent` legibility, focus-ring/fill collision, 260px ellipsis — real-Obsidian eyeball under a **third-party** theme | Yes, feature surface — but unautomatable by nature; default-theme colours already measured | `docs-internal/tickets/ticket-node-preview-pill-human-smoke-run.md` |
| `npm test` red: `SettingsSpec.test.ts` `linkStrengthFactor.max` | **No** — author-only known-RED, predates the branch | `ticket-settings-spec-baseline-tests-stale-after-node-spacing-bump.md` / `ticket-settings-baseline-tests-stale-after-spacing-change.md` |

Operational note for the human: `nodeOutline.e2e.ts` is only informative today with
`.dev-vault/.obsidian/workspace.json` moved aside, and `npx playwright test` cannot be used
directly (`OBSIDIAN_PATH` unset) — always go through `npm run test:e2e`.
