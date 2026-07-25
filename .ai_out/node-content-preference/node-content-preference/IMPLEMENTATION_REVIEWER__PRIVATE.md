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

---

# Run 3 — wave C + whole-feature acceptance.
# Verdict: **NEEDS-ITERATION**, **1 BLOCKING**, DO-NOT-SHIP until B1 is fixed.
# Public: appended "wave C + WHOLE-FEATURE ACCEPTANCE" section (waves A and B preserved,
# verified by prefix check: file went 640 → 906 lines, nothing rewritten).

## The find, and the method that produced it

**B1: wave C's 3 new E8 cases deterministically break the pre-existing E7 at
`nodeOutline.e2e.ts:339`.** E7's own comment at `:341-342` says "the current MAIN is
outline-cover, so this is a real change" — it depends on the PREVIOUS test leaving
outline-cover active, because only an active-file change triggers the rebuild that applies
`setMaxNodeSizePx(96)`. E8.2/E8.3 leave outline-note active ⇒ `openFile(outline-note)` is a
no-op ⇒ no rebuild ⇒ nodes stay 160px ⇒ outline visible ⇒ `toBeHidden()` fails.

**What made this findable, and would have hidden it from anyone reading only logs:** the
repo's own `.dev-vault` kills the file at `:92` first, so E7 never runs here. I only saw it
because I ran the file in a git worktree, whose freshly-created `.dev-vault` has **no saved
`workspace.json`** — and that absence is exactly what makes `:92` pass.

Decisive A/B (all in `.tmp/reviewC/`): HEAD whole file → 1 failed (E7) / 13 passed, **3 of 3
runs**; HEAD `--grep-invert` the 3 new cases → **11/11 pass**; main → 11/11 ×2. Same
worktree, same vault, only the code differs.

## Reusable environment knowledge (worth not re-deriving)

- **e2e DOES run here.** `OBSIDIAN_PATH=$REPO/.tmp/obsidian/obsidian-1.12.7/obsidian`;
  `scripts/run-e2e.sh` auto-adds `--ozone-platform=headless --disable-gpu` when no display.
  A single-file run is ~20-40s including Obsidian boot. Wave C's correction was right and
  waves A and B (including my own runs 1 and 2) were wrong to defer it.
- **The `:92` culling flake is triggered by `.dev-vault/.obsidian/workspace.json`.**
  Saved pane geometry ⇒ small graph pane ⇒ React Flow culls the MAIN node. Without that
  file: 5/5 green (incl. HEAD). With it transplanted into the worktree vault: **`main`
  itself goes red** (1 of 2 runs) and HEAD-no-E8 2/2. That is the experiment wave C never
  ran, and it is what actually exonerates the feature.
- **Worktree e2e recipe that works from this container:**
  `git worktree add --detach .worktree/X main` → `ln -s $REPO/node_modules` →
  `mkdir .tmp && ln -s $REPO/.tmp/obsidian .tmp/obsidian` → `npm run test:e2e -- <file>`.
  `run-e2e.sh` rebuilds via `setup:dev-vault`, so the worktree gets its own correct `main.js`.
  Checking out a different ref inside the same worktree is the ONLY controlled A/B — the
  main repo's `.dev-vault` differs from a fresh one in `workspace.json` + `core-plugins.json`.
- **Harness wipes `data.json`** in the vault copy on every launch
  (`obsidianHarness.ts:383-387`: rm the copy, cp `.dev-vault`, then delete the plugin's
  `data.json`). So there is NO cross-run preference pollution — I chased that hypothesis and
  it is dead. Every launch starts at spec defaults.
- **All 9 e2e files are `mode: "serial"`** ⇒ one red hides the rest as "did not run", and
  `--grep` verification of an inserted case is structurally blind to what it broke.
- `npx playwright test --config e2e/playwright.config.ts --list` needs no Obsidian and gives
  the true total (**76**) — the cheapest way to audit a "N passed / M did not run" claim.

## How I audited the report rather than trusting it

- 76 total, and the cascade counts **exactly** 20: `nodeOutline:92` #1/14 (13) +
  `vicinityGraph:160` #13/19 (6) + `edgeRoutingEval:171` #5/6 (1). Arithmetic that tight is
  strong evidence the log is genuine and nothing was silently excluded.
- `git diff main..HEAD -- e2e/ | grep -c "^-[^-]"` → **0**. No deletions, no `.skip/.only`,
  no loosened timeouts. "Nothing weakened to manufacture green" is TRUE.
- `git ls-files main.js styles.css` → empty (untracked artifacts) ⇒ hand-editing them into a
  commit is impossible; the trough at `styles.css:1156` came from the build.

## Honesty assessment of wave C (for the record)

Substantially honest, and better than its predecessors: it volunteered that the 3 nodeOutline
cases could NOT run in the full suite, and that the light-theme trough change is a visual
no-op. Two overstatements, both wording rather than fabrication: the "pristine `main` tree"
claim (the stash was to `c96640d` = wave B tip — `.tmp/wc-stash.log` proves it), and "all 9
new cases pass" which is only true across two different runs. Neither conclusion was wrong;
I verified the underlying claim properly myself.

## If rehydrated to review the B1 fix

1. The fix must be in `e2e/` only. Preferred shape: `await harness.remountGraphView()` after
   `setMaxNodeSizePx` in E7, killing the implicit active-file dependency; acceptable
   alternative: open a different file first and reword the `:341-342` comment.
2. **Re-run the WHOLE `nodeOutline.e2e.ts`** (never `--grep`) in a vault with **no** saved
   `workspace.json` — use a fresh worktree, that is the only place the file is otherwise
   green. Expect 14/14.
3. Check S2 landed: the culling ticket's "pristine `main`" wording corrected, and the
   `workspace.json` trigger recorded in it.
4. Nothing in `src/` needs re-review — the acceptance table is all PASS and wave C did not
   disturb waves A or B (the only `src/` changes in `ac27f8d` are the `SettingsSpec.ts`
   comment and the one-line CSS trough).
5. Housekeeping I did: created and then removed `.worktree/reviewC-main`; left evidence logs
   in `.tmp/reviewC/`. Nothing in `src/` or `e2e/` was modified by me (read-only mandate held).

---

# Run 4 — confirmation pass on iteration round 1 (`1623084` / record `a463c1d`).
# Verdict: **SHIP**. B1, S1, S2 all resolved. 0 blocking. Public: appended
# "CONFIRMATION PASS" section (906 → 1007 lines, nothing above rewritten).

## What I checked myself (cheap, targeted — did NOT re-run the suites)

- `git show 1623084` in full + `git diff --stat b4f3556..a463c1d`: touched ONLY
  2 `.ai_out/` records, the culling ticket, and `e2e/nodeOutline.e2e.ts`.
  No `src/`, no unit test, no `main.js`/`styles.css` (untracked anyway).
- `git show 1623084 -- e2e/ | grep -c "^-[^-]"` → 18, and I accounted for **all**
  of them: 16 comment/docblock lines + the 2 statements the helper absorbed
  (`openFile` and the `data-tier="main"` expect). The tier assert lives on inside
  `showNoteWithRefitGraph`. Zero assertion loss; no `.skip/.only/timeout` churn.
- Read `obsidianHarness.ts:275-283` — `remountGraphView()` detaches every graph
  leaf then `openGraphView()`. Rebuild is unconditional ⇒ B1's root cause (a
  no-op `openFile` on the already-active file) is structurally eliminated, not
  papered over. E7 is now position- and predecessor-independent.
- Read `obsidianHarness.ts:336-346` — `setNodePreviewPreference` calls
  `plugin.refreshOpenViews()`. So E8.3's added `showNoteWithRefitGraph` does NOT
  make it vacuous: the remount happens while the pref is still `image`
  (thumbnail), then auto → refresh → `outline`. Real transition preserved.
- Verified the docblock's "E1–E5 share `beforeAll`'s MAIN" is TRUE: E3 opens
  `pic.jpg`, documented non-node-bearing at `:33-34`, so the graph's MAIN never
  moves; no E1–E5 case does a store write ⇒ no B1-class coupling there.
- Ticket existence check for every residual risk: culling flake (file ticket),
  `edgeRoutingEval:171` → `ticket show nid_6lxaenl4oamjxqj6f0eh6rr4c_e` (open;
  its leftovers list names the exact failing "radial layout SKIPS routing" case,
  which is why the failure is pre-existing and NOT ours), `vicinityGraph:160` →
  `ticket-e2e-gamma-breadcrumb-fails-headless.md`, B2 →
  `ticket-node-preview-pill-human-smoke-run.md` (default-theme colours already
  measured; only third-party theme + 2 taste calls left).

## Two things I noted and deliberately did NOT raise as blockers

1. **Ticket precision (recorded in PUBLIC as a quibble, no new ticket).** The new
   table says "reviewer 5/5 on `main`" — my actual run-3 evidence was 5 green
   `:92` observations in a vault WITHOUT `workspace.json`, of which only 2 were on
   true `main` (3 were on HEAD). And the WITH-`workspace.json` row reads
   deterministic; I measured 1 red of 2 on `main`. The ticket's own prose still
   says "race" and demands 5 consecutive runs, so the conclusion is sound. Wording.
2. **Docblock slightly overbroad.** `:21-22` says every case needing a different
   MAIN establishes it "via `showNoteWithRefitGraph`" — E6 (`:269`) uses a bare
   `openFile`. E6 is nonetheless CORRECT (no store write ⇒ no rebuild needed, and
   `outline-cover` is never active before it), so this is one imprecise clause, not
   a lie and not a latent bug. Not worth a ticket; would be a 5-word edit.

## Honesty assessment of round 1 (for the record)

The best of the four records. It volunteered the run condition (`workspace.json`
moved aside) instead of burying it, published the A/B control (HEAD-stashed file →
1 failed at E7, `Expected: hidden / Received: visible`), corrected wave C's
"pristine tree" overclaim in BOTH the ticket and the feature record without
rewriting wave C's section, and named the sibling fix (E8.3) as such rather than
smuggling it. Its 5×14/14 claim is consistent with TOP_LEVEL's independent 14/14.

## If ever rehydrated again

Nothing outstanding on this feature. The only live threads are the 4 tickets in the
PUBLIC residual-risk table. The reusable environment knowledge is in run 3's
section (worktree e2e recipe, the `workspace.json` trigger, `--list` for true test
counts, harness wiping `data.json`); add: **`npx playwright test` directly fails on
`OBSIDIAN_PATH is not set` — always `npm run test:e2e`** (`scripts/run-e2e.sh`
supplies env + headless flags).
