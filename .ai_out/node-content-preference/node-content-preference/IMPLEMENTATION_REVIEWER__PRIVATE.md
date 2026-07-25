# IMPLEMENTATION_REVIEWER — private notes (wave A, Phases 1–2)

Run 1. Verdict: **APPROVED**, 0 blocking, wave B may proceed.
Public output: `IMPLEMENTATION_REVIEW__PUBLIC.md`.

## What I actually ran (not assumed)

- `npm test` → `1 failed | 892 passed (893)`; failure = `SettingsSpec.test.ts`
  "limits equal the exact shipped baseline", `linkStrengthFactor.max` 2 vs 4.
  Pre-existing, author-only. Log: `.tmp/review-test.log`.
- `npm run check` → exit 0. Log: `.tmp/review-check.log`.
- No `sanity_check.sh` in this repo (checked).
- `npm run test:e2e` NOT run (release gate, needs real Obsidian) — I instead
  statically verified the three e2e files that could break (see below).
- Diff-hygiene greps: no `it.skip`/`it.only`/`@ts-expect-error`/`eslint-disable`
  introduced; +45/−5 `it(` (matches the claimed +40); no `main.js`/`styles.css`
  in the commits.

## The trace I did myself (the thing that mattered)

Old adapter emptied `outline` under 4 conditions; the 4th became the fact.
Only divergent cell of `nodePreviewKind` vs old logic:
`IPO=true ∧ hasImage=false` → new `"outline"`, old `"none"`.

Proof of unreachability (independent of the plan reviewer, converged on the same
conclusion):
- `referencesImageAbove` (`ObsidianLinkProvider.ts:198-209`) → true only for a
  reference that `resolveReference` resolves AND `FileKinds.isImagePath` accepts.
- `attachmentsOf` (`:272-276`) walks the SAME `OrderedReference[]` through the
  SAME `resolveReference`, filtering only `!isNodeBearingPath`.
- `NODE_BEARING_EXTENSIONS = {md, canvas}` vs `IMAGE_EXTENSIONS` — disjoint
  (`shared/FileKinds.ts:8-11`) ⇒ the image is always an attachment.
- `VicinityTraversal.ts:157` `firstImage = attachments.find(isImage)` ⇒
  `firstImagePath` defined. Attachments are NOT filtered by node exclusion
  (grepped `attachments` across `src/engine/`) — exclusion only skips node
  creation at `:123`.
⇒ `IPO ⇒ hasImage`. Cell reachable only via `FakeLinkProvider` fixtures.

Also verified the DOM-equality leg: `FlowNodeData.outline` now travels populated
in the image-wins case, but the ONLY reader is `NoteNode.tsx:105` gated on
`preview === "outline"` (grep `\.outline\b` across `src/`, non-test: only
`flowMapping.ts:64,305,319` + `NoteNode.tsx:108`). Nothing in NodeSizer /
elkMapping / GraphStructureDiff reads `outline` or `preview` ⇒ `sizePx`
independence (CLARIFICATION req 3) holds.

Frontmatter sentinel `-1`: covered by the new adapter test with heading offset 0
→ true; `referencesImageAbove` untouched, so unchanged.

## e2e statically checked (would-they-break)

- `e2e/nodeOutline.e2e.ts:264-270` (E6, image escape hatch): asserts
  `data-preview="thumbnail"` + `outlineOf(cover).toHaveCount(0)`. Still passes —
  cover node's preview is thumbnail so `NodeOutline` is not mounted. This is the
  strongest surviving guard for the zero-behavior-change claim.
- `e2e/nodeOutline.e2e.ts:302` (E7) asserts `data-preview="outline"` — unaffected.
- `e2e/settingsResetReview.e2e.ts` asserts reset LABELS (`:188`) and per-field
  values, not descriptions ⇒ the changed `node-contents` description is safe.
  `dirtyEverySection()` does not dirty the new field — that's Phase 5's cases.
- `settingsUxVisual.e2e.ts:164` — labels only. Safe.

## Findings I landed on (and the ones I deliberately did NOT raise)

SHOULD-FIX (2, both cheap, neither blocking):
1. `GraphStructureDiff.test.ts:47-56` comment overclaims. `makeNode` hard-sets
   `sizePx: 100`, and `decideLayout` never reads `nodePreviewPreference`, so a
   size↔preference coupling would NOT fail this test. What it really guards is
   "nobody adds a nodePreviewPreference relayout trigger". Reword.
2. `settingsWritePlan.test.ts:113` — node-preview test filed under
   `describe("planSettingsWrite outline depth")`. Misnamed home.

NICE-TO-HAVE: shared `NO_OUTLINE_FACTS.outline` array instance (was fresh `[]`
per call; safe, nothing mutates); `"image"` vs `"thumbnail"` vocabulary split
(don't let wave B "align" it — `data-preview` is an e2e contract); IPO measured
against the FIRST heading vs decision on the FILTERED outline (pre-existing,
documented, do not "fix"); `resourcePath` can return null ⇒ empty slot with an
unused outline, which `image` makes reachable more often (ticket, NOT a fallback
branch inside NoteNode).

Explicitly NOT raised (considered and rejected as findings):
- `parseViewOverride` now parses the field, which technically makes it per-doc
  overridable despite Q3 "global only". REQUIRED: `parsePluginData` uses the same
  parser for `globalView` (`:95`), and `ViewSettingsOverride = Partial<ViewSettings>`
  already permitted it. Q3's parenthetical anticipates this.
- The new `_assert…` idiom vs `EDGE_VISIBILITY_MODES`' plain local array. Two
  precedents already exist for the assert idiom (`forceLayoutFieldMeta.ts:67`,
  `settingsResetPlan.ts:194`); the drift is already a planned §8.4 ticket.
- `toFlowNodeData` taking whole `ViewSettings` — I argued both sides and decided
  it's the better seam (module-private mapper, avoids per-knob param growth).

## Verified the assert is not vacuous

`as const satisfies readonly NodePreviewPreference[]` keeps the tuple literal, so
`Exclude<NodePreviewPreference, (typeof NODE_PREVIEW_PREFERENCES)[number]>` is
`never` today. `UnlistedPreference` is a concrete alias, not a naked type param,
so no distribution: `never extends never ? true : …` → `true`, and an omission
yields the missing literal which fails `= true` by name. The PLAN_REVIEW inline
fix (SHOULD-FIX 1 in that doc) is genuinely applied.

## Registration audit method (reusable)

`grep -rn "keyof ViewSettings" src/` + `grep -rln outlineMaxDepth src/ e2e/`, then
diff the two file lists. Only `VicinityGraphSettingTab.ts` (Phase 3) and
`e2e/settingsResetReview.e2e.ts` (Phase 5) lack the new field — both scheduled.

## If rehydrated for wave B review

Focus then on: `esbuild.config.mjs` `AUTHORED_CSS_FILES` entry for
`segmented-control.css` (no unit test can catch its absence — plan risk §7.4);
radio `name` scoping (tab-local constant vs `useId()` in the panel — document-scoped
grouping trap); the superseded docblock at `VicinityGraphSettingTab.ts:312-320`;
e2e cases 51–53 appended LAST in the serial `nodeOutline.e2e.ts` with 53 restoring
Auto; the hand-enumerated `settingsUxVisual.e2e.ts:53-59` disclosure list (case 56);
the panel-write case 57; and whether §8.4's ticket got filed.

---

# Run 2 — wave B (Phases 3–4). Verdict: **APPROVED-WITH-FOLLOWUPS**, 0 blocking,
# wave C may proceed. Public: the appended "wave B" section of
# IMPLEMENTATION_REVIEW__PUBLIC.md (wave A preserved; verified by prefix check).

## What I actually ran (not assumed)

- Did NOT re-run the full suite (TOP_LEVEL had verified check/test/build). Ran the
  6 files wave B touches or leans on → **6 files / 100 tests passed**
  (`.tmp/rev-b-tests.log`).
- **Probe 1** (scratchpad `probe.mjs`, playwright-core imported by ABSOLUTE path
  from the repo's node_modules — plain `import "playwright-core"` fails from
  /dev/shm; `page.accessibility` is GONE in PW 1.61, use `locator.ariaSnapshot()`):
  rebuilt BOTH surfaces' markup from the documented DOM contract + the repo's real
  generated styles.css, with Obsidian light vars stubbed. Results:
  aria snapshot `radiogroup "Preview"` + radios named Auto/Outline/Image on BOTH;
  Tab leaves the group (one tab stop); ArrowRight moves selection AND fires exactly
  one `change`; 3× cycles to auto; group box-shadow `rgb(139,108,239) 0 0 0 2px`
  only when keyboard-focused; `:has(> input:checked)` → accent bg + white text;
  input box == label box 80×23, opacity 0, display block; panel pill 244px in a
  260px body, segments 80/81/81.
  **Forced same-name experiment: tab checked → panel 0 checked.** The fusion trap
  is real; the constant-vs-useId split is load-bearing.
- **Probe 2** (`react-probe.mjs`, React+ReactDOM **UMD** builds from node_modules,
  no bundler needed, `React.createElement` instead of JSX): two `createRoot`s under
  StrictMode with an async write.
  - `useId` gave `:r1:` / `:r3:` → **distinct across roots** (same bundled react-dom
    instance). Multi-view case safe; no identifierPrefix needed.
  - **Immediately after click("Image"), `input:checked` is still `auto`**; becomes
    `image` only after the async snapshot. Controlled-input restore. Focus retained
    across the re-render. Zero page errors.

## The one finding that matters (SHOULD-FIX 1)

Tab radios are UNCONTROLLED (instant `.checked`); panel radios are CONTROLLED off
the rebuilt snapshot (stale for the persist+rebuild window). The DOM contract
(`IMPLEMENTATION__PUBLIC.md:288-289`) says "assert with toBeChecked()" but not WHY,
so wave C could write `isChecked()`/`evaluate(el=>el.checked)`/`inputValue()` and
get a false negative. Doc-only fix, ~4 lines.

## Facts worth not re-deriving

- React's `updateNamedCousins` (`react-dom/cjs/react-dom.development.js:1937`)
  **throws** "Mixing React and non-React radio inputs with the same name is not
  supported" → a shared name between the Obsidian-built tab pill and the React
  panel pill would be an invariant ERROR, not just a visual bug. Sharper rationale
  than either code comment gives.
- `:has()` = Chromium 105 (2022) ⇒ trivially safe at minAppVersion 1.12.4.
- Measured: `.vicinity-graph-segmented` bg == settings-modal page bg ==
  `.vicinity-graph-disclosure` bg == `--background-primary`. Pill has NO trough
  contrast; only its 1px border delineates it. → the single
  `#QUESTION_FOR_HUMAN:` (switch to `--background-modifier-form-field`?).
- `--text-on-accent` is the repo's FIRST use (grepped). B2 **accepted, no
  fallback** — it is `--interactive-accent`'s paired core variable, and the
  rejected `var(--text-on-accent, var(--text-normal))` would hide a dark-theme
  illegibility instead of failing loudly. Keep on wave C's eyeball list.
- Focus ring and selected fill are BOTH `--interactive-accent`; with `Auto`
  (the default) selected at the group's edge the ring is effectively only visible
  on three sides. NICE-TO-HAVE.
- 104px "fits" gate is SYMMETRIC (graph-view.css:238-244 reveals thumbnail AND
  outline in the same `@container`), so no preference can be emptier than another
  below the threshold. Checked because CLARIFICATION derived req 2 hangs on it.
- No jsdom / no RTL / zero `*.test.tsx` — the "React section cannot be unit
  tested" claim is TRUE. Panel-write coverage rests entirely on e2e case 57.
- `GraphToolbar.tsx:38` root already has `nowheel nodrag nopan` ⇒ NodeContents
  needs no `bodyClassName`; `SizingSection.tsx:39` is the redundant outlier.
- e2e safety re-checked myself: `settingsUxVisual.e2e.ts:40-57` matches
  disclosures by `hasText`; "Node contents" collides with neither "Node sizing"
  nor "Node exclusion", and no e2e counts panel disclosures ⇒ nothing goes red,
  it just under-covers (case 56).
- Both wave-A SHOULD-FIX items genuinely resolved in substance (comment no longer
  lies and names the gap; test moved verbatim into its own describe).

## If rehydrated for wave C review

Check: (a) SHOULD-FIX 1 folded into the DOM contract; (b) e2e cases 51–57 exist,
especially **57** (panel WRITES) and **56** (the hand-enumerated disclosure list
at `settingsUxVisual.e2e.ts:52-57` gaining "Node contents"); (c) panel-side e2e
assertions all use retrying `expect(...)`; (d) the Phase-5 doc set incl.
`README.md:138` and `high-level-plan.md:93`; (e) the §8 tickets actually filed,
incl. the two new ones (sizePx-independence pinning; panel writes not fanning out
to other open views via `ControlsActions.applySettings`).
