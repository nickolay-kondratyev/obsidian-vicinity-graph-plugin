# PLAN_REVIEWER — private working notes (`node-content-preference`)

Run 1, 2026-07-25. Output: `DETAILED_PLAN_REVIEW__PUBLIC.md` (verdict
APPROVED-WITH-INLINE-FIXES, 0 blocking, no PLAN_ITERATION).

## What I actually verified (so a rehydrated run does not redo it)

Baseline: `npm test` → **1 failed | 852 passed (853)**; the only failure is
`SettingsSpec.test.ts` "limits equal the exact shipped baseline",
`linkStrengthFactor.max` expected 2 / actual 4 (spec `SettingsSpec.ts:191`).
Full output kept at `.tmp/review-test-run.txt`. This is the documented known-RED.

Source facts confirmed by reading (not by trusting the plan):

| Claim | Reality |
|---|---|
| `outlineOf` returns `[]` for "image wins" | `ObsidianLinkProvider.ts:145-166`, comment `// The image wins.` at `:162` |
| `referencesImageAbove` resolves only refs above the limit | `:179-190`, rationale `:168-178` |
| attachments derive from the same resolver | `:253-257` via `outgoingPathsOf` `:202-220` |
| Nothing but NodeOutline consumes `outline` | grep: `VicinityTraversal.ts:167`, `flowMapping.ts:303`, `NoteNode.tsx:37,112`, `FakeLinkProvider.ts:106`. **NodeSizer never sees it** ⇒ sizePx safe |
| `toFlowNodeData` at `:290`, call site `:187` | ✅ |
| `FlowNodeData` built in exactly one place | ✅ (no fixture fan-out for the new `preview`) |
| All view tests build nodes via `makeNode` | ✅ (`graphFixtures.ts:9-27`) — only 2 fixture edits needed |
| `flowMapping.test.ts` already overrides viewSettings inline | `:466-469` `viewSettings: { ...makeGraph().viewSettings, outlineMaxDepth }` ⇒ new preference cases need no fixture refactor |
| Resolver needs every key listed | `ViewSettingsResolver.ts:46-53` ✅ |
| `EngineDefaults.viewSettings` projection | `constants.ts:159-170` ✅ |
| `parseViewOverride` + `EDGE_VISIBILITY_MODES` local array | `persistedShapes.ts:131-157`, `:66` |
| version bump would discard globals | `persistedShapes.ts:88-91` ⇒ plan's "stay at 2" is right |
| `ALL_SCOPE_DESCRIPTION` already names "node contents" | `settingsResetPlan.ts:68-69` ⇒ no edit needed |
| reset scope union / SECTION_RESET_SCOPES unchanged | `:22-29`, `:167-174` ✅ |
| `settingsResetPlan.test.ts` node-contents "every other field survives" | `:93` ✅ (will fail correctly) |
| `SettingsSpec.test.ts` literals | `:28-79` hand-built BOTH sides (adding field optional but right); `:111-120` DOES fail until updated |
| `TUNED_VIEW` | `:17-34` ✅ |
| `Setting.then` / `controlEl` public | `obsidian.d.ts:5719`, `:5853` |
| executors already handle `global-view` | `ControlsActions.ts:88-90`, `VicinityGraphSettingTab.ts:489-491` |
| `vicinityGraphToFlow` runs on both rebuild branches | `GraphViewController.ts:200` |
| `decideLayout` inputs | `GraphStructureDiff.ts:25-47` (groupByFolder, forceLayout, ids, sizePx) |
| `AUTHORED_CSS_FILES` | `esbuild.config.mjs:46-51` (3 files today) |
| panel sections today | `GraphToolbar.tsx:42-54` Depth / Pinned / Exclusion / Sizing / ForceLayout |
| `controls.globalView` is the GLOBAL (not resolved) view | `ControlsModel.ts:57-58` ⇒ correct source for a global-only pill |
| e2e `toHaveCount(6)` sites | `settingsResetReview:77`, `settingsResetVerify:59`, `settingsUxVisual:128` (+ resets `:159`, names `:161-168`) |
| **the gap:** panel disclosures hand-enumerated | `settingsUxVisual.e2e.ts:53-59` — new "Node contents" disclosure silently under-asserts |
| `nodeOutline.e2e.ts` is serial + assumes Auto | `:24,31-56` |
| CSS vars unused in repo | `--text-on-accent`, `--background-modifier-border-focus` (grep over `src/view/*.css`); repo has **zero** `:has()` today |
| dev-vault fixtures exist | `scripts/setup-dev-vault.sh` outline-note (image after heading) / outline-cover (image before), manual-check prose `:362-368` |
| docs to reconcile | `README.md:59-66,135-148`, `high-level-plan.md:93`, `SettingsSpec.ts:118-124`, `VicinityGraphSettingTab.ts:312-320` |

## Auto-identity argument (the thing worth not re-deriving)

`IPO === true` ⇒ (a heading exists AND a resolved image sits above it) ⇒ that image
is `firstImagePath` (references are ascending by offset; attachments preserve that
order and use the same resolver). So rows "outline-only + IPO", "image-only + IPO",
"neither + IPO" are unreachable, and the plan's invariant is real.

Auto == today in every reachable row, verified through the code path, incl.:
frontmatter (offset sentinel `-1`), unresolvable `![[missing.png]]` (resolve-first
⇒ IPO false ⇒ outline still shows), all-headings-too-deep (count 0 ⇒ thumbnail/none
in both worlds). The only visible-DOM change for image-wins notes is that
`data.outline` now carries unused data — `NoteNode.tsx:112` gates rendering on
`preview`, so no DOM delta.

Nuance (documented, not a defect): IPO is computed against the FIRST heading while
the decision uses the depth-FILTERED count. Today does the same ⇒ no regression.

## The 7 inline fixes I made to DETAILED_PLANNING__PUBLIC.md

All marked `[PLAN_REVIEW inline fix]`, plus a review banner under the title.

1. §2.1 — `NODE_PREVIEW_PREFERENCES` must be `as const satisfies readonly
   NodePreviewPreference[]` (else `[number]` widens and the listing assert is
   vacuous). Also spelled out the `Exclude<…>` shape. **The one substantive catch.**
2. §3.2 — settled the `:has()` ambiguity (keep it, first use in repo → WHY comment)
   and flagged the two unproven Obsidian CSS variables.
3. Phase 4 — panel row must show `NODE_PREVIEW_ROW_LABEL` + radiogroup `aria-label`.
4. §6.L — new case 56: add "Node contents" to the panel-defaults disclosure
   enumeration (`settingsUxVisual.e2e.ts:53-59`). THE missed registration point.
5. §6.L — new case 57: panel pill write assertion (idiom at `settingsUxVisual:110-115`).
6. §6.L — nodeOutline e2e: append 51-53 LAST in the serial file, case 53 restores Auto.
7. §6.K — split (or drop) two-assert case 50; §8 gained ticket 4
   (`EDGE_VISIBILITY_MODES` → engine types, one enum idiom).

Case count moved 55 → 57 (banner records it).

## Judgments I deliberately did NOT turn into demands

- **PARETO trim of group A** (rows 5/10/15 are one guard asserted 3×; 3/4/9/14
  re-assert guards per preference). ~4 rows trimmable; left as NICE-TO-HAVE
  because over-testing the feature's core rule is the better failure mode.
- Per-option descriptions ending up as `title` tooltips only — acceptable.
- Per-doc reachability of `nodePreviewPreference` via hand-edited `doc-data/*.json`
  (plan risk 9): consistent with `nodeCap`; correctly no special-casing.
- Option A vs B/C/D/E seam choice: A is right; do not reopen.

## If asked to re-review after implementation

Watch specifically: (1) the `as const satisfies` form actually landed;
(2) `preview` computed from the FILTERED array (tests 32/33 must exist and fail if
inverted); (3) `settingsResetPlan.test.ts:93` patched, not weakened;
(4) `esbuild.config.mjs` got the 4th CSS file; (5) both radio-group `name`s
differ; (6) the panel disclosure e2e enumeration updated.
