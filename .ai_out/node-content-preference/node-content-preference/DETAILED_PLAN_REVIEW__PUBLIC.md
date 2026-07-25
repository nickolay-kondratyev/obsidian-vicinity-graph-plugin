# DETAILED PLAN REVIEW — `node-content-preference`

Reviewer: PLAN_REVIEWER. Branch `node-content-preference`. Every `file:line`
below was verified against the working tree (I re-read the source rather than
trusting the plan or the exploration docs; the plan's refs held, ±2 lines).

## Verdict

**APPROVED WITH INLINE FIXES** — 0 blocking issues, 7 minor corrections applied
directly in `DETAILED_PLANNING__PUBLIC.md` (each marked `[PLAN_REVIEW inline fix]`).

- [ ] APPROVED (as-was)
- [x] **APPROVED-WITH-INLINE-FIXES**
- [ ] NEEDS-ITERATION
- [ ] REJECTED

**PLAN_ITERATION is NOT required.** Nothing found needs an approach,
architecture, scope or step change; the fixes were all "state the mechanism
precisely" / "one more test row" and are already in the plan.

No `#QUESTION_FOR_HUMAN:` — the plan stays inside the approved CLARIFICATION.

## Executive summary

The architecture is right and is the only honest way to build this feature: the
adapter stops *deleting* the losing side and reports `imagePrecedesOutline` as a
fact, and the precedence rule collapses into ONE pure function called from
`flowMapping.toFlowNodeData`, so `NoteNode` decides nothing and the whole feature
is unit-testable in a repo that has no React component tests. `Auto` is
behaviour-identical to today's rule in every cell I could construct, including
the frontmatter-image and unresolvable-`![[missing.png]]` cases. The registration
checklist is the most complete I have reviewed in this repo — it caught all
fourteen production/test registration points; the ONE thing it missed is an e2e
enumeration in the controls panel (`settingsUxVisual.e2e.ts:53-59`), which I
added inline.

## Verified baseline (so the implementer is not chasing ghosts)

- `npm test` on this branch: **1 failed | 852 passed (853)**; the single failure is
  `SettingsSpec.test.ts` "limits equal the exact shipped baseline" —
  `linkStrengthFactor.max` expected 2, spec says 4 (`SettingsSpec.test.ts:101` vs
  `SettingsSpec.ts:191`). Exactly the known-RED the plan names. Do not fix.
- Nothing else in the repo reads `node.outline` (`grep`: only
  `VicinityTraversal.ts:167`, `flowMapping.ts:303`, `NoteNode.tsx:37,112`,
  `FakeLinkProvider.ts:106`). In particular **`NodeSizer` never sees the outline**,
  so always-extracting it cannot move `sizePx` — the plan's central safety claim
  holds mechanically, not just by intent.
- `vicinityGraphToFlow` runs on BOTH branches of `runRebuild`
  (`GraphViewController.ts:200`, before the `reuse-layout`/`relayout` split), so a
  preference flip really is a data-only refresh that reaches the DOM.
- `decideLayout` (`GraphStructureDiff.ts:25-47`) inspects only `groupByFolder`,
  `forceLayout`, node/edge id sets and `sizePx` ⇒ test 49 is constructible and
  correct as a tripwire.
- Every view-layer test builds nodes through `makeNode`
  (`graphIdentity/ElkLayout/D3ForceLayout/d3ForceStranding/GraphLayoutRunner/elkMapping/GraphStructureDiff/flowMapping`)
  ⇒ adding a required `GraphNode.imagePrecedesOutline` needs exactly the two
  fixture edits the plan lists, no hidden third site.
- `FlowNodeData` is constructed in exactly one place (`toFlowNodeData`) ⇒ the new
  required `preview` field has no fixture fan-out.
- `Setting.then(cb)` and `Setting.controlEl` are both public in
  `node_modules/obsidian/obsidian.d.ts` (`:5719`, `:5853`) ⇒ the Phase 3 tab
  markup approach compiles.
- `ControlsActions.executeSettings` already handles `global-view`
  (`ControlsActions.ts:88-90`) and so does `VicinityGraphSettingTab.persist`
  (`:489-491`) ⇒ the plan is right that **no executor changes** are needed.

## The precedence truth table I derived independently

`P` = preference, `IPO` = `imagePrecedesOutline`, count = **post-depth-filter**
outline entries. `—` = the input cannot occur (see invariant below).

| # | outline | image | IPO | Auto | Outline | Image | today (pre-feature) |
|---|---|---|---|---|---|---|---|
| 1 | yes | yes | true  | thumbnail | **outline** | thumbnail | thumbnail |
| 2 | yes | yes | false | outline   | outline     | **thumbnail** | outline |
| 3 | yes | no  | false | outline   | outline     | outline (fallback) | outline |
| 4 | yes | no  | true  | — (an image must exist to precede) | — | — | — |
| 5 | no  | yes | false | thumbnail | thumbnail (fallback) | thumbnail | thumbnail |
| 6 | no  | yes | true  | — (a heading must exist to be preceded) | — | — | — |
| 7 | no  | no  | false | none | none | none | none |
| 8 | no  | no  | true  | — | — | — | — |

Findings from walking it:

- **`Auto` column == "today" column in every reachable row.** Verified against the
  real code path, not just the rule statement:
  - image-before-first-heading: old `outlineOf` returned `[]`
    (`ObsidianLinkProvider.ts:161-163`) ⇒ `nodePreviewKind` → thumbnail. New: outline
    is populated, `IPO=true`, Auto → thumbnail. **The outline data now travels but is
    never rendered** — `NoteNode` gates `<NodeOutline>` on `preview === "outline"`
    (`NoteNode.tsx:112`) and nothing else consumes `data.outline`, so the DOM is
    byte-identical.
  - frontmatter image: `FRONTMATTER_REFERENCE_OFFSET = -1 <` any heading offset ⇒
    `IPO=true` ⇒ thumbnail, as today.
  - unresolvable `![[missing.png]]` above the first heading:
    `referencesImageAbove` resolves before testing (`:184-186`), so `IPO=false` ⇒
    Auto shows the **outline**, exactly as today. The deliberate
    "an unresolvable embed must not suppress the outline" rationale
    (`ObsidianLinkProvider.ts:172-177`) survives because `referencesImageAbove` is
    untouched. ✅
  - all-headings-deeper-than `outlineMaxDepth`: count 0 ⇒ row 5/7 ⇒ thumbnail/none,
    same as today (the depth filter already ran before `nodePreviewKind` today too).
- **"A preference never empties a node" is satisfied**, and satisfied *once*: the two
  guard clauses (`count === 0` and `!hasImage`) sit above the `switch`, so rows 3
  and 5 cannot be reached by any preference-specific branch. This is the right
  shape — the fallback is not restated three times.
- **Rows 4/6/8 are unreachable**, and that is load-bearing for the field's honesty.
  I verified it in code: `referencesImageAbove` returns true only for a reference
  that (a) sits below the first heading's offset — so a heading exists — and (b)
  resolves to an image path; `attachmentsOf` resolves the same references through
  the same `resolveReference`/`isImagePath` pair (`:253-257`), and references arrive
  ascending by offset, so that image IS `firstImagePath`. The plan's invariant
  (`IPO === true ⇒ outline.length > 0 && firstImagePath !== undefined`) therefore
  genuinely holds — it is not wishful.
- **One nuance worth knowing (not a defect, no regression):** `IPO` is computed
  against the FIRST heading in the document, while the decision uses the
  depth-FILTERED count. A note shaped `### deep` → `![img]` → `## shallow` at
  depth 2 reports `IPO=false` and shows the outline under Auto even though the
  image precedes the only *visible* entry. Today's code does exactly the same
  thing, so `Auto` remains identical; re-deriving `IPO` per filtered outline would
  be new complexity for a pathological note. Correct call to leave it.
- **"Fits" semantics are safe under the new preferences.** Below the 104px
  container query BOTH regions are hidden (`graph-view.css:225-256`), so
  `Outline` on a small node cannot "lose" an image that would otherwise have
  shown. No JS measurement is introduced. ✅

## BLOCKING

**None.**

## SHOULD-FIX (all applied inline — no iteration needed)

1. **`NODE_PREVIEW_PREFERENCES` typed as `readonly NodePreviewPreference[]` makes the
   completeness assert vacuous.** §2.1's declared type widens
   `(typeof NODE_PREVIEW_PREFERENCES)[number]` back to the full union, so
   `Exclude<…>` is always `never` and `_assertEveryNodePreviewPreferenceListed`
   guards nothing. The repo already has the correct idiom:
   `SECTION_RESET_SCOPES = [...] as const satisfies readonly SettingsResetScope[]`
   (`settingsResetPlan.ts:167-174`). **Fixed inline** in §2.1 (both rows).
   *Impact:* without this, the plan's own "a missing value is a compile error"
   guarantee — the thing that keeps the pill from silently shipping two options —
   is fake.
2. **Missed registration point: the controls panel has a hand-enumerated e2e.**
   `e2e/settingsUxVisual.e2e.ts:53-59` ("panel defaults: every section is a
   disclosure, only Depth starts open") lists Depth / Node exclusion / Node sizing /
   Force layout one by one. A new "Node contents" disclosure does not fail it — it
   silently under-asserts, which is precisely the failure class this plan is
   otherwise meticulous about (`c5583d5`). **Fixed inline** as case 56 in §6.L.
3. **The controls-panel pill had zero automated coverage at any level.** §6.L covered
   the settings-tab radio group (54) and the CSS reaching the DOM (55) but nothing
   asserted the PANEL write, while "exposed in BOTH surfaces" is the feature's
   headline requirement. The force-layout test already shows the idiom
   (`settingsUxVisual.e2e.ts:110-115`: click control → read
   `pluginDataStore.globalView()`). **Fixed inline** as case 57.
4. **`nodeOutline.e2e.ts` is `mode: "serial"` and every existing case assumes Auto**
   (`e2e/nodeOutline.e2e.ts:24,31-56` — the expected label list, the level-3
   exclusion, the scroll and click cases all read outline-note's outline). Restoring
   the default only in `afterAll` leaves a mid-file failure poisoning later cases.
   **Fixed inline** in §6.L: append 51–53 last and let 53 restore Auto.
5. **Panel row had no visible label.** Every other panel row is labelled
   (`ForceLayoutSection`'s sliders, `SizingSection`'s metric rows); a bare
   Auto/Outline/Image trio inside a "Node contents" disclosure does not say what it
   switches. **Fixed inline** in Phase 4 (visible `NODE_PREVIEW_ROW_LABEL` +
   `aria-label` on the radiogroup).
6. **The CSS sketch left a decision to the implementer** ("`:has()` or not — pick
   one") and used two variables (`--text-on-accent`,
   `--background-modifier-border-focus`) that appear **nowhere in this repo's CSS**
   (grep). **Fixed inline**: keep `:has()` (supported by the Chromium behind
   `minAppVersion` 1.12.4; it is the repo's first use, so it earns a WHY comment),
   and verify those two variables in light + dark during Phase 3 instead of
   assuming.
7. **Case 50 is a two-assert test.** "…THEN the metadata also carries a non-empty
   outline **and** a first image" violates the repo's one-assert convention.
   **Fixed inline**: split, or drop (cases 18/21 already pin the inputs).

## NICE-TO-HAVE (not applied; implementer's call)

- **PARETO on the 57 cases — the tail I would trim.** Group A's 15 rows are the
  feature's core and cheap, but rows 5/10/15 are the same "neither side ⇒ none"
  guard asserted three times, and 3/4/9/14 re-assert the two guard clauses per
  preference. A defensible 11-row A (all 6 both-sides cells + `Outline`-with-no-
  headings + `Image`-with-no-image + one `Auto` single-side pair + one "neither")
  loses no behaviour coverage. Everything else (B's fact matrix, D's
  post-filter cases 32/33, I's `TUNED_VIEW` work) is load-bearing — do not trim
  there. Net: the plan is over-tested by ~4 rows, which is a far better failure
  mode than under-tested; I am not asking for a change.
- **Per-option `description` strings become `title` tooltips only** — accessible to
  neither keyboard nor screen reader in practice. The row description already
  carries the essential model, so this is fine; if the UX pass wants the option
  copy discoverable, fold it into the row description instead of inventing
  per-option help text.
- **`docs-internal/architecture-map.md`** gets one "Key seams" line in Phase 5 —
  consider also touching the `src/adapters/` bullet (`:21-23`), which currently
  reads as though the adapter owns content decisions.
- **New follow-up ticket added inline (§8.4):** `EDGE_VISIBILITY_MODES`
  (`persistedShapes.ts:66`) re-lists a union's values in persistence with no
  completeness guard, while this feature introduces the better idiom. Two idioms
  side by side is drift worth a ticket, not a passing fix.

## Answers to the review questions I was asked

**2. DRY/SRP — is the rule in ONE place, and is `flowMapping` the right altitude?**
Yes to both. After the change the *fact* (document offsets) lives only in
`ObsidianLinkProvider` and the *policy* (which side wins) only in
`nodePreviewChoice.nodePreviewKind` — a fact/policy split, not duplication.
`toFlowNodeData` already exists to "apply `ViewSettings` to node data"
(`outlineMaxDepth` at `:303-305`) and already derives `tier`, `imageCount`,
`attachmentGroups`; `preview` is the same category of derivation, so SRP is not
strained. Putting the DECISION (not the fact) in `FlowNodeData` is better than the
task brief's suggestion: it keeps the rule out of an untested React component, and
it avoids copying a single global value onto every node payload. Option D
(decide in the engine) is correctly rejected — the engine would have to apply
`outlineMaxDepth`, which `types.ts:248-253` explicitly declares a view-layer knob.
Also note the plan's small win of passing `view: ViewSettings` instead of growing
the parameter list per knob.

**3. Layering.** Clean. `imagePrecedesOutline` is a plain boolean derived from
document structure — the same category as `attachments`/`isNodeBearing` on
`FileMetadata`, and it travels `FileMetadata → TraversedNode → GraphNode` with no
obsidian/react types anywhere; `importGuard.test.ts` stays satisfied.
`NodePreviewPreference`/`NODE_PREVIEW_PREFERENCES` in `engine/types.ts` is required
(persistence + resolver + spec consume them) and precedented by
`DIRECTION_DEPTH_FIELD`. UI copy stays in `src/view/nodePreviewPreferenceMeta.ts`. ✅

**4. Binding requirements.** All honoured. Nothing removed — the two
`ObsidianLinkProvider.test.ts` "outline is empty" cases are inverted *because the
adapter genuinely no longer empties it*, and their substance is relocated to
(18 fact-true) + (A.1 auto ⇒ thumbnail) + e2e 53 in the real DOM, which is exactly
what the CLARIFICATION permits ("may be relocated … assertions must survive in
substance"). `sizePx` untouched and tripwired. No JS fits-measurement. Global-only
(with the hand-edited-per-doc reachability flagged and correctly left alone,
consistent with `nodeCap`). Default `auto`. `PERSISTED_SHAPE_VERSION` stays 2 —
correct, and the reason given (a bump would discard every user's globals via
`persistedShapes.ts:88-91`) is verified. Docs are superseded, not contradicted, in
all five places (`README:59-66,135-148`, `high-level-plan.md:93`,
`SettingsSpec.ts:118-124`, `VicinityGraphSettingTab.ts:312-320`,
`scripts/setup-dev-vault.sh:362-368`).

**5. Registration checklist.** Complete for production and unit tests. Verified
present in the plan AND real in the source: `SETTINGS_SPEC.globalView`
(`SettingsSpec.ts:112-133`), `ViewSpec` (`:67-74`), `EngineDefaults.viewSettings`
(`constants.ts:159-170`), `ViewSettings` (`types.ts:245-258`),
`ViewSettingsResolver`'s explicit return list (`:46-53`), `parseViewOverride`
(`persistedShapes.ts:131-157`), `SettingsInteraction` + `planSettingsWrite`
(`settingsWritePlan.ts:24-46,73-104`), the tab row (`:321-342`), restore-defaults
(only the `node-contents` `plan`/`description` at `:93-102` changes — scope union
`:22-29`, `SECTION_RESET_SCOPES` `:167-174` and `ALL_SCOPE_DESCRIPTION` `:68-69`
correctly stay untouched because that description already names "node contents",
and section count stays 6 so all three e2e `toHaveCount(6)` sites
(`settingsResetReview:77`, `settingsResetVerify:59`, `settingsUxVisual:128`) and both
exact reset-name lists are byte-identical), controls panel (`GraphToolbar.tsx:53`),
`esbuild.config.mjs:46-51`, `engine/index.ts:33-58`, both `SettingsSpec.test.ts`
literals (`:28-79` hand-built on both sides — adding the field there is the right
call even though nothing forces it; `:111-120` DOES fail until updated), and
`TUNED_VIEW` (`settingsResetPlan.test.ts:17-34`) plus the "everything else
survives" expectation at `:93`. **The only gap was the panel e2e enumeration
(SHOULD-FIX 2/3), now closed.**

**6. Test plan quality.** Non-vacuous and mostly one-behaviour-each. The two
highest-value cases are 32/33 (deciding from the POST-filter count — the trap that
would otherwise ship `data-preview="outline"` on an empty box) and 47 (the
`settingsResetPlan.test.ts:93` failure that is *correct* and must be patched, not
weakened). Existing idioms support the plan: `flowMapping.test.ts:466-469` already
varies view settings via `viewSettings: { ...makeGraph().viewSettings, … }`, so
the new preference cases need no fixture refactor. Only defect found: case 50's
double assert (fixed).

**7. Accessibility / UX of the pill.** Sound: native `<input type="radio">` in a
`role="radiogroup"` buys one tab stop + arrow-key cycling with zero keyboard JS,
mirroring `ToggleSwitch.tsx`'s "native input, themed chrome" philosophy. The
stretched-transparent-input technique keeps it focusable (the plan correctly
forbids `display:none`), and the `<label>` needs the `position: relative` it has.
The **radio `name` document-scoping trap is real and correctly pre-empted** (tab
constant vs. `useId()`) — with the settings modal open over a graph view, a shared
name would silently merge the two groups. No collision with the exclusion chip:
that is `vicinity-graph-exclusion__count`, and the new block is
`vicinity-graph-segmented` — nothing in the repo is *named* "pill", so the
codebase's ambiguity is not deepened. Theming rides Obsidian variables (two of
them unproven in this repo — see SHOULD-FIX 6). A 4th CSS file is justified: the
control is shared by two surfaces, `node-outline.css` is the precedent, and
appending last is order-safe (all-new selectors) given the
`graph-view.css:220-231` concatenation incident.

**8. Phasing.** Each of the five phases is independently committable and green at
its boundary (Phase 1 updates the adapter tests in the same commit that inverts the
adapter's behaviour; Phase 2's `SettingsSpec.test.ts:111-120` and
`settingsResetPlan.test.ts:93` failures are anticipated and patched in-phase;
Phases 3–5 touch no unit test's expectations). **Phase 1 is genuinely
zero-behaviour-change** — I verified the only three DOM-visible consequences
(`data-preview`, the thumbnail block, `<NodeOutline>`) are all driven by
`preview`, which is identical under the hard-wired Auto rule, and that no
`sizePx`/layout input moves. Phase 3-then-4 leaves one commit where the tab has
the pill and the panel does not; additive and harmless.

**9. Over-engineering / under-specification.** Nothing over-engineered — the
`preference` is not copied per node, no context plumbing, no new reset scope, no
version bump, `referencesImageAbove` untouched, `Outline depth` panel parity
correctly pushed to a ticket rather than smuggled in. The three
under-specifications I found (const-array form, `:has()` choice, panel row label)
are now specified inline.

## Strengths (specific)

- The `Auto`-as-one-branch framing keeps a documented design decision alive
  instead of overwriting it — and the plan says so in the docs it edits, which is
  what "superseded, not contradicted" actually requires.
- Fact/policy separation with the fallback expressed **once** in two guard clauses
  above an exhaustive `switch` (no `default`, satisfying `noImplicitReturns`) —
  this is the whole feature's correctness in 12 readable lines.
- Reusing the `node-contents` reset scope is argued from the contract
  (`settingsResetPlan.ts:16-18,162-166` — one reset row per card) rather than from
  convenience, and it keeps three e2e baselines byte-identical.
- The alternatives table is honest: option D is rejected for a *specific*
  layering reason (`outlineMaxDepth` is a view knob), option E for a *specific*
  DRY hazard.
- Risks §7 names the failure modes an implementer actually hits (post-filter count,
  radio `name`, missing `AUTHORED_CSS_FILES` entry, the resolver's explicit return
  list, the correct-failure at `settingsResetPlan.test.ts:93`).
