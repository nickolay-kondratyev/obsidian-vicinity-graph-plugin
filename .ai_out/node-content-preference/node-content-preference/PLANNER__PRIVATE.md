# PLANNER__PRIVATE — node-content-preference

Working notes for rehydration. Run 1 (no prior private file existed).
Branch `node-content-preference`, tree clean at start, HEAD `c5583d5`.
Public output: `DETAILED_PLANNING__PUBLIC.md`.

## 0. What I read (and therefore trust)

Inputs: `CLARIFICATION__PUBLIC.md`, `EXPLORATION_PUBLIC.md`,
`EXPLORATION__CONTENT_RULES__PUBLIC.md`, `EXPLORATION__SETTINGS_CONTROLS__PUBLIC.md`,
`CLAUDE.md`, `docs-internal/architecture-map.md`.

Source read IN FULL: `ObsidianLinkProvider.ts`, `LinkProvider.ts`, `types.ts`,
`SettingsSpec.ts`, `constants.ts`, `ViewSettingsResolver.ts`, `persistedShapes.ts`,
`nodePreviewChoice.ts` (+ its test), `NoteNode.tsx`, `settingsWritePlan.ts`,
`settingsResetPlan.ts`, `GraphToolbar.tsx`, `ForceLayoutSection.tsx`,
`forceLayoutFieldMeta.ts`, `ToggleSwitch.tsx`, `SizingSection.tsx`,
`NodeExclusionSection.tsx`, `Disclosure.tsx`, `settings-tab.css`,
`FakeLinkProvider.ts`.
Read in part: `flowMapping.ts` (1-120, 240-340), `VicinityGraphSettingTab.ts`
(1-200, 260-501), `VicinityTraversal.ts` (20-80, 140-180), `GraphViewController.ts`
(175-235), `SettingsSpec.test.ts` (20-145), `settingsResetPlan.test.ts` (1-60),
`settingsUxVisual.e2e.ts` (60-200), `settingsResetReview.e2e.ts` (20-150),
`README.md` (52-70, 130-152), `engine/index.ts` (30-90).

## 1. Exploration claims I VERIFIED (all held, ±1 line)

- `outlineOf` really returns `[]` for "image wins"; `// The image wins.` is at
  `ObsidianLinkProvider.ts:162`. Guards: `!isOutlineBearingPath || cache === null`
  → `[]`; `headings[0] === undefined` → `[]`; `references !== null &&
  referencesImageAbove(...)` → `[]`.
- `referencesImageAbove` resolves only refs ABOVE the limit (ascending scan,
  early `return false`) — the "unresolvable embed must not blank the node"
  rationale is at `:168-178`. Unchanged by this feature.
- `firstImagePath` derived independently at `VicinityTraversal.ts:155` /
  assigned `:168`.
- `VicinityEngine.ts:83` is a `...node` spread ⇒ new GraphNode fields are free.
- `flowMapping.ts:187` is the only `toFlowNodeData` call site; the function is
  module-private ⇒ signature change is local.
- `decideLayout` (`GraphStructureDiff.ts:23-45`) compares only: first build,
  `groupByFolder`, `forceLayout`, node ids, edge ids, `sizePx` growth. Content-blind. ✔
- **New finding (not in the exploration, load-bearing):**
  `GraphViewController.runRebuild` calls `vicinityGraphToFlow(graph, …)` at `:200`
  BEFORE the reuse/relayout branch ⇒ the reuse path really does refresh node
  DATA. Without this the whole feature would silently not update on flip. Worth
  keeping in mind if anyone "optimizes" that call into the else-branch.
- `ControlsActions.executeSettings` and `VicinityGraphSettingTab.persist` both
  already handle `global-view` ⇒ zero executor changes. ✔
- Registration points confirmed verbatim: `SettingsResetScope` union `:22-29`,
  `SETTINGS_RESET_SCOPES` `:79-160` (`node-contents` `:93-102`),
  `SECTION_RESET_SCOPES` `:167-174`, `ALL_SCOPE_DESCRIPTION` `:68-69`,
  `_assertEveryResetScopePlaced` `:183-185`.
- e2e counts confirmed: `settingsResetReview.e2e.ts:77`,
  `settingsResetVerify.e2e.ts:59`, `settingsUxVisual.e2e.ts:128` (+ reset count
  `:159` and the ordered name list `:161-168`).
- Known-RED confirmed by reading: `SettingsSpec.test.ts:101` expects
  `linkStrengthFactor { min: 0.25, max: 2 }` while `SettingsSpec.ts:191` ships
  `max: 4`. Exactly one pre-existing failure.
- `SettingsSpec.test.ts:28-79` really omits `outlineMaxDepth`. Confirmed.
- No repo-wide `radio` / `<select>` / `addDropdown` / `role="radiogroup"` /
  "segmented". Also: **no CSS class anywhere is named `*pill*`** — "pill" appears
  only in prose/comments (`graph-view.css:380-382` toolbar shape,
  `NodeExclusionSection.tsx:19`, `ControlsModel.ts:62-68`). So a
  `vicinity-graph-segmented` block collides with nothing.
- `AUTHORED_CSS_FILES` is an EXPLICIT list (`esbuild.config.mjs:47-51`), not a
  glob ⇒ a new CSS file must be registered or it silently never ships.

## 2. Full-literal construction sites (the real blast radius of a required field)

- `FileMetadata`: `ObsidianLinkProvider.getFileMetadata` (prod) +
  `FakeLinkProvider.declareFile` (`:100-107`). That's it.
- `TraversedNode`: `VicinityTraversal.assemble` only.
- `GraphNode`: `graphFixtures.makeNode` only (other test files use the factory).
- `ViewSettings`: `graphFixtures.makeViewSettings` + `settingsResetPlan.test.ts`
  `TUNED_VIEW`. Everything else spreads `EngineDefaults.viewSettings()`
  (`VicinityEngine.test.ts:196`, `settingsResolvers.test.ts`, e2e uses
  `{...store.globalView()}`).
⇒ Required (non-optional) fields cost ~4 one-line fixture edits. Cheap. Decided
required.

## 3. Decisions and WHY (incl. what I rejected)

### 3.1 Fact name
Chose `imagePrecedesOutline`. Rejected `firstImageAboveFirstHeading` (more
literal but clumsy at the decision site), `imageWins` (LIES once the preference
exists — it is no longer a decision), `outlineSuppressedByImage` (same lie),
carrying offsets (leaks parsing detail through 3 layers).
Edge case pinned deliberately: **no first heading ⇒ false** ("nothing to
precede"). Alternative (true, "vacuously precedes") rejected: it would make the
invariant `true ⇒ outline non-empty` false and nothing downstream benefits.

### 3.2 Setting name
Chose `ViewSettings.nodePreviewPreference: NodePreviewPreference`.
Rejected `nodePreview` (ambiguous against the existing view type
`NodePreviewKind` = the RESOLVED outcome), `nodeContentPreference` (the thing
chosen is the preview slot, not all node content), `previewMode` (reads like
`edgeVisibility`'s sibling but loses "this is a user preference, the outcome may
differ because of the fallback"). The `Preference` suffix is doing real work:
`NodePreviewPreference` (what the user asked for) vs `NodePreviewKind` (what the
node actually shows) is exactly the distinction the fallback rule creates.

### 3.3 Where the decision is computed → `toFlowNodeData` (Option A)
The single most important design call. Deviates from the task brief's hint (which
expected the fact on `FlowNodeData`). Rationale in the public doc §3.1; the
clincher is that it makes the whole feature testable in `flowMapping.test.ts`
without inventing React component tests (repo has none for `NoteNode`), and it
puts the preference application next to the only other view-settings application
(`outlineMaxDepth`), which is also the ONLY correct place to read the
post-filter entry count.
Consequence I must not forget: `FlowNodeData.outline`'s doc comment (`:54-61`)
currently says "including when its image wins — the adapter decided that" — that
sentence becomes false and must change.

### 3.4 Reuse `node-contents` reset scope
Big PARETO win: 4 registration points → 1, section count stays 6, all three e2e
count assertions and both reset-name lists untouched, `settingsResetVerify.e2e.ts`
needs no edit. Also correct on principle (scopes mirror cards 1:1; a card must
end with exactly one reset row).
Cost: the `node-contents` description string now names two things — fine, and it
must read the label from the shared meta rather than re-typing "Auto".
Discovered while checking: `settingsResetPlan.test.ts:93`
(`expect({ ...view, outlineMaxDepth: TUNED_VIEW.outlineMaxDepth }).toEqual(TUNED_VIEW)`)
WILL fail once the scope resets a second field — that failure is correct and the
expectation must gain the new key. Easy to mistake for a regression.

### 3.5 Pill control
Native radios in a `role="radiogroup"` div. Rejected `addDropdown` (two different
controls for one setting; the human said PILL), `role="radio"` buttons with roving
tabindex (hand-rolled keyboard = bug factory), a 3-state ToggleSwitch analogue
(Obsidian has no native 3-state control to borrow ⇒ divs pretending to be radios).
Shared: `nodePreviewPreferenceMeta.ts` (labels + descriptions + row copy).
Duplicated: the markup (Obsidian `Setting` can't mount in React) — the
force-layout contract exactly.
`name` uniqueness is the subtle trap: document-scoped radio grouping means a
shared `name` merges the tab's group with the panel's when both are mounted. Tab
= module constant, panel = `useId()`. I did NOT put the name in the meta module on
purpose.
CSS: new `src/view/segmented-control.css` (shared by both surfaces ⇒ belongs to
neither existing stylesheet; duplicating rules would be knowledge duplication).
Sketch avoids `display:none` (kills focus) and uses adjacent-sibling selectors;
one optional `:has()` for the segment background, with a no-`:has()` fallback
noted.

### 3.6 Panel placement
New `<Disclosure summary="Node contents">` after `SizingSection` (mirrors the
tab's card order, which itself is documented at `VicinityGraphSettingTab.ts:84`).
Rejected folding into `SizingSection` (wrong responsibility) and a bare
top-level control (panel rule: every section behind a Disclosure).
Explicitly did NOT mirror `outlineMaxDepth` into the panel — pre-existing gap,
unclarified, grows the diff ⇒ ticket instead. This is a judgement call a reviewer
might push back on; the counter-argument (force-layout achieved *full* parity) is
real but that was that feature's own scope.

### 3.7 No version bump
`PERSISTED_SHAPE_VERSION` stays 2. Verified the mechanism: `parsePluginData`
returns full defaults on version mismatch (`:89-91`) and otherwise merges
`{...defaults.globalView, ...parseViewOverride(raw)}` (`:95`). So absent key →
`auto` → today's behavior. Bumping would nuke every user's globals. `outlineMaxDepth`
is the precedent.

### 3.8 Phase 1 = pure refactor, zero behavior change
Deliberately splits `NodePreviewInput`'s growth across two commits
(`imagePrecedesOutline` in Phase 1, `preference` in Phase 2). Slightly more churn,
but Phase 1 becomes a behavior-preserving move-the-decision refactor that a
reviewer can verify in isolation — the highest-value review boundary in the whole
change. Do NOT collapse Phases 1+2 "to save a commit": landing the always-extract
change without the `auto` branch would visibly regress every image-cover note.

## 4. Things I nearly got wrong

- Almost put the fact on `FlowNodeData` (as the brief suggested) and computed the
  decision in `NoteNode` — would have left the precedence rule untested.
- Almost computed `preview` from `node.outline.length` (pre-filter) inside
  `toFlowNodeData`. That silently breaks the depth-filter interaction; it is now
  tests 32/33.
- Almost added a new `SettingsResetScope` (`node-preview`) — would have broken
  the six-card contract and three e2e files.
- Almost planned two adapter methods (`outlineOf` + `imagePrecedesOutlineOf`)
  with duplicated guards; switched to one `outlineFactsOf` returning a named
  interface (CLAUDE.md's no-Pair/Triple rule + one guard, no drift).
- Almost overlooked that `parseViewOverride` is shared with per-doc `view`, i.e.
  hand-edited doc files can pin a "global-only" field. Checked `nodeCap`: same
  situation already ships (CLARIFICATION Q4 global-only, still parsed per-doc) ⇒
  consistent, leave alone.

## 5. Fixtures / e2e opportunity (nice find)

`scripts/setup-dev-vault.sh:248-310` already ships the perfect pair:
`outline-note.md` (image AFTER the first heading → outline) and
`outline-cover.md` (image BEFORE → image), plus `e2e/nodeOutline.e2e.ts:26-28`
already locates both. So the three preference e2e cases (51-53) need ZERO new
fixtures. The script's manual-check text at `:359-368` asserts "outline-cover's
MAIN node shows the image, never an outline" — must be qualified with "at the
default Auto preview" or it becomes a false instruction.

## 6. Doubts / open items

1. Row copy ("Preview") and row order (pill above the depth slider) are my calls,
   not the human's. Cheap to flip; flagged as open-but-defaulted in the public doc.
2. The `_assertEveryNodePreviewPreferenceListed` type guard is 3 lines for a
   3-value enum. Repo precedent exists twice, and it prevents "new value never
   appears in the UI/parser". A reviewer could reasonably call it
   over-engineering; dropping it is harmless (the `Record` meta table stays
   exhaustive) but then the ORDER array becomes the only unguarded list.
3. I did not fix the `SettingsSpec.test.ts:28-79` `outlineMaxDepth` omission —
   ticket instead, so this branch's diff stays attributable in a file that is
   already RED for an unrelated reason. Defensible either way.
4. Whether the panel needs a `mod-compact` variant of the segmented control at
   260px is a visual-review question; plan says "add only if needed" rather than
   speculating a modifier.
5. Not verified by execution: I did not run `npm test` / `npm run check` (planner
   is read-only for code and I avoided mutating anything). The one pre-existing
   failure is inferred from reading `SettingsSpec.test.ts:101` vs
   `SettingsSpec.ts:191` — arithmetic, not a guess, but unexecuted.

## 7. Rehydration shortcuts

- The precedence rule must exist in exactly ONE place:
  `src/view/nodePreviewChoice.ts`. If you find a second `imagePrecedesOutline`
  branch anywhere (adapter, engine, `NoteNode`), the design has been violated.
- The three invariants a reviewer should check first: (a) `sizePx` untouched,
  (b) `preview` computed from the FILTERED outline, (c) section count still 6.
