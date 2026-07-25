# IMPLEMENTATION — PRIVATE working notes (`node-content-preference`, Phases 1+2)

State for rehydration. Written after both commits landed with a clean tree.

## Where things stand

- `7b9995a` = Phase 1, `f065510` = Phase 2. `git status` clean on branch
  `node-content-preference`. `main.js` / `styles.css` are NOT git-tracked in this
  repo (checked with `git ls-files`), so `npm run build` is safe to run — it does
  not dirty the tree. It also re-copies into `.dev-vault/` (untracked).
- Last verified numbers: `npm run check` exit 0; `npm test` → **1 failed | 892
  passed (893)**; the failure is only `linkStrengthFactor.max` (`SettingsSpec.test.ts`
  limits baseline, expects 2, spec says 4). Logs left in `.tmp/`:
  `check3.log`, `test3.log`, `build.log`, plus the red snapshots
  `phase1-red.log` (18 red) and `phase2-red.log` (14 red = 13 mine + 1 known).
- `tsconfig.json` includes ONLY `src/**` ⇒ `npm run check` does **not** typecheck
  `e2e/`. The e2e edits (Phase 5) will not be caught by `npm run check`.
- No prettier/eslint config in the repo. Lines >120 chars are common in test
  titles; I kept new production lines ≤120 and wrapped two that exceeded it
  (`NODE_PREVIEW_PREFERENCES`, a test fact constant).

## Things I verified rather than assumed

- Only TWO `FileMetadata` construction sites exist (`ObsidianLinkProvider`,
  `FakeLinkProvider`) — grep on `isNodeBearing:`. Making the new field required
  therefore had no hidden fan-out.
- `FlowNodeData` is built in exactly one place (`toFlowNodeData`), BUT two test
  files hand-build it as a literal: `flowMapping.test.ts:355` (the `withPositions`
  fixture) and the `:52` "rich payload" `toEqual`. Both needed `preview`. tsc
  caught the first, the test run caught the second.
- `references === null` inside the outline path is effectively unreachable
  (`isOutlineBearingPath` ⇒ markdown, and `orderedReferencesOf` returns null only
  for non-markdown or `cache === null`, both already short-circuited). I kept the
  guard (it was there before) and phrased plan case 25 as the reachable variant:
  "no cache entry ⇒ false". Worth knowing if someone later tries to write a test
  for "cache present but references unorderable" — you cannot construct it.
- `EDGE_VISIBILITY_MODES` in `persistedShapes.ts` was deliberately left alone
  (plan §8.4 ticket, Phase 5).

## Dead ends / near-misses

- I initially left an orphaned comment in `NoteNode.tsx` where the deleted
  `nodePreviewKind` call had been; folded the WHY into the component docblock
  instead so no comment floats above unrelated code.
- The plan's per-phase test lists do not cover §6.A rows 6–15 / §6.D 30-31-34,
  and Phase 2's numbered steps omit `nodePreviewChoice`/`flowMapping` even though
  Phase 2 is "end to end". I implemented the wiring in Phase 2 (deviation D2 in
  the PUBLIC file). If a reviewer expects the `preference` param to appear only in
  a later phase, that is where the disagreement is — but a setting the pipeline
  ignores would make Phase 3's UI a no-op.
- Phase 2 item 8 needs `NODE_PREVIEW_OPTION_META`, which the plan created in
  Phase 3. Created the module early with ONLY the option record (deviation D1).
  Phase 3 must ADD `NODE_PREVIEW_ROW_LABEL`/`NODE_PREVIEW_ROW_DESCRIPTION` to
  that existing file — do not create a second module.

## Doubts / watch items for the next implementer

1. **Not eyeballed in a real Obsidian.** Phase 1's "the DOM is byte-identical"
   claim rests on: nothing but `NoteNode` reads `data.outline`/`data.preview`, and
   `preview` under `auto` reproduces the old rule (tests §6.A/§6.D). A dev-vault
   check with `outline-cover.md` (image before heading ⇒ thumbnail) and
   `outline-note.md` (image after heading ⇒ outline) is still worth doing at the
   Phase 3/4 boundary when the UI exists to flip.
2. **`imagePrecedesOutline` is computed against the FIRST heading in the
   document, while the decision uses the depth-FILTERED count.** Pathological note
   (`### deep` → image → `## shallow` at depth 2) reports `false`. Identical to
   today's behavior; the reviewer explicitly blessed leaving it. Do not "fix" it
   without a fresh decision.
3. `settingsResetPlan.test.ts`'s "every other view field keeps its tuned value"
   pattern spreads the reset fields back over the result — when Phase 3+ adds no
   new reset field this stays correct, but any future field added to
   `node-contents` must be added to that spread too or the test lies.
4. The `node-contents` reset DESCRIPTION string changed. No unit test asserts it
   verbatim, and the e2e reset lists assert LABELS (unchanged) — but if an e2e
   screenshot baseline ever covers that description, Phase 5 should expect a diff.
5. `_assertEveryNodePreviewPreferenceListed` is exported from `types.ts` only
   (not through `index.ts`) — deviation D5. If a reviewer insists on the plan's
   literal wording, adding one name to the index export is a one-line change.

---

# PRIVATE working notes — wave B (Phases 3 + 4)

Appended by the wave-B instance. Wave A's notes above still hold.

## Where things stand

- `2ded9db` = Phase 3 (+ both SHOULD-FIX items), `c50ed40` = Phase 4. Tree clean.
- Numbers: `npm run check` exit 0; `npm test` **1 failed | 894 passed (895)**,
  1 failed file | 67 passed (68); `npm run build` exit 0. Logs in `.tmp/`:
  `p3-red-tsc.log` (the RED), `p3-check.log`, `p3-test.log`, `p3-build.log`,
  `p4-check.log`, `p4-test.log`, `p4-build.log`.
- I installed Playwright's Chromium (`~/.cache/ms-playwright`, ~114MB) — it was
  absent. There is NO Obsidian binary and no `OBSIDIAN_PATH`, so `npm run
  test:e2e` cannot run here at all, and neither can any dev-vault eyeball.
- The visual harness is `.tmp/segmented-harness.html` +
  `.tmp/shoot-segmented.mjs` (`node .tmp/shoot-segmented.mjs`). It links the
  REAL `graph-view.css` + `segmented-control.css` and stubs Obsidian's theme
  variables. Rebuild it if you need to re-eyeball; it is throwaway, not shipped.

## Things I verified rather than assumed

- `DomElementInfo` (obsidian.d.ts:137-165) has `type` and `value` fields, so
  `createEl("input", { type: "radio", value: preference, attr: { name } })`
  typechecks — no `setAttribute` dance needed except for `checked` (a property).
- No existing e2e counts the panel's disclosures, so adding a 6th section breaks
  nothing; `settingsUxVisual.e2e.ts:52-57` hand-enumerates them and simply
  under-asserts until Phase 5 adds case 56. The settings-tab
  `toHaveCount(6)` sites are untouched (I added a ROW to an existing card).
- `hasText` substring matching in `disclosure(...)`: "Node contents" does not
  collide with "Node sizing" or "Node exclusion". Safe.
- Playwright treats an `opacity: 0` input as visible/actionable (bounding box is
  non-empty), so `check()` works on the stretched radios. Confirmed in the probe.
- The repo has NO jsdom / RTL and zero `*.test.tsx`. Do not promise a component
  test for `NodeContentsSection` — adding that infra is a separate decision.

## Dead ends / near-misses

- I first wrote the plan's focus rule (`outline` on `__text`) and only found it
  wrong by rendering: `overflow: hidden` clips it, and focus lands on the
  *checked* radio, where an accent ring on accent fill is invisible. → group-level
  `box-shadow` (deviation B1). Do not "restore" the plan's sketch.
- I considered a `font-weight` bump on the selected segment as a second,
  non-colour differentiator (WCAG "not colour alone"). Dropped: it changes the
  segment's intrinsic width, so the pill jiggles on every flip in the tab (the
  panel's `flex: 1 1 0` would be immune). The selected state is already a filled
  BOX, not just a hue change, so the luminance difference carries it. If someone
  insists on the weight lever, they must reserve the bold metrics first.
- `--size-2-1` vertical padding (plan's sketch) → 21px pill. Measured, bumped to
  `--size-4-1` → 25px.
- The 2 tests in `nodePreviewPreferenceMeta.test.ts` are a11y-name guards, not
  the plan's §6 cases — §6 assigns Phase 3/4 nothing but e2e (54–57). The second
  one ("row label does not collide with a segment label") passed *vacuously*
  before the constant existed, because vitest does not typecheck; the honest RED
  was the tsc error. Said so in the PUBLIC file rather than claiming a red test.

## Doubts / watch items for the next implementer

1. **`--text-on-accent` is not eyeballed in a real Obsidian** (deviation B2). If
   some theme leaves it unset the checked segment's text inherits `--text-muted`
   on an accent fill = poor contrast. I deliberately did NOT add a fallback,
   because every plausible fallback is also illegible and would hide the bug.
   First real-Obsidian screenshot should check this.
2. **`:has()` is the repo's first use.** If it ever needs to go, the restructure
   is: move padding/border/background to `__text` and select it via
   `input:checked + .vicinity-graph-segmented__text`. The CSS says so.
3. `graph-view.css` now has panel-scoped overrides of a SHARED block
   (`.vicinity-graph-nodecontents .vicinity-graph-segmented…`). If a third
   surface ever wants a stretched pill, promote those two rules into a
   `--stretch` modifier in `segmented-control.css` rather than copying them.
4. The tab pill does **not** re-render the tab on change (no `this.display()`).
   That is deliberate — it would eat keyboard focus mid-arrow-key — but it means
   the pill is the one tab control whose siblings are not re-read after a write.
   Nothing in the Node contents card depends on the preference, so this is safe
   today; adding a control that does would need a rethink.
5. SHOULD-FIX 1 left a real gap: NOTHING pins "sizePx must not depend on the
   preference". I reworded the comment to say so honestly. Phase 5 should file
   the ticket; a `NodeSizer` test is the right home.

---

# PRIVATE working notes — wave C (Phase 5: docs, e2e, tickets)

Appended by the wave-C instance. Waves A and B above still hold **except** the
"no Obsidian binary" claim, which was false (see below).

## Where things stand

- `ac27f8d` = Phase 5. Tree clean. Feature is complete; nothing of the plan is left.
- Numbers: `npm run check` exit 0; `npm test` **1 failed | 894 passed (895)**,
  1 failed file | 67 passed (68) — unchanged from wave B (Phase 5 adds no vitest);
  `npm run build` exit 0; `npx tsc -p e2e/tsconfig.json` exit 0.
  Logs: `.tmp/wc-check.log`, `wc-test.log`, `wc-build.log`, `wc-e2e-tsc.log`,
  `wc-e2e-full.log`, `wc-e2e-new3.log`, `wc-e2e-ux2.log`, `wc-probe{,2,3}.log`.

## 🔴 THE BIG CORRECTION: e2e runs here

Waves A and B both wrote "there is NO Obsidian binary … `npm run test:e2e` cannot run
here at all". **Wrong, and it cost both waves their verification story.**

- `scripts/run-e2e.sh` auto-provisions Obsidian when `OBSIDIAN_PATH` is unset, and a
  **cached 1.12.7 was already sitting in `.tmp/obsidian/obsidian-1.12.7/obsidian`**.
  `npm run setup:obsidian` → "using cached binary". No network needed.
- No display server ⇒ the script adds `--ozone-platform=headless --disable-gpu` itself.
- **Lesson for the next instance: TRY the command before declaring an environment
  can't do something.** `resolveObsidianPath()` throwing on a bare `OBSIDIAN_PATH` is
  not evidence; `run-e2e.sh` sets it for you.

You can also read Obsidian's REAL `app.css` without launching anything:
`.tmp/obsidian/obsidian-1.12.7/resources/obsidian.asar` is a plain file — grep it with
python for `--some-variable:` and walk back to the enclosing selector. That is how the
trough values were settled.

## Things I verified rather than assumed

- **The trough change is a no-op in the DEFAULT LIGHT theme.** `body` sets
  `--background-modifier-form-field: var(--color-base-00)` = `--background-primary`;
  only `.theme-dark` overrides it (`--color-base-25`). Confirmed twice (asar + a live
  computed-style probe: light trough `rgb(255,255,255)`, dark `rgb(42,42,42)`).
  The CSS comment says so — **do not "fix" it back to something non-native.**
- `--text-on-accent` = `rgb(255,255,255)` in BOTH default themes ⇒ deviation B2's
  main risk is retired for stock Obsidian. ≈3.4:1 on the accent, which is Obsidian's
  own `.mod-cta` pairing; not ours to unilaterally improve.
- `grep -rn "CLARIFICATION Q2" src/` — the `SettingsSpec.ts:124` one was the LAST
  superseded reference. All remaining hits are unrelated Q2s from other steps
  (canvas detection, ctrl/cmd-click, depth-stepper bounds). Don't "clean" those.
- The three `toHaveCount(6)` sites and both reset-name lists are still correct and
  were left byte-identical. Verified by the suite passing them, not by reasoning.
- `_tickets/` is **tracked** (git status shows existing ones as committed, only new
  ones as `??`) and is where the repo's *current* engineering follow-ups live
  (`ticket ls`). `docs-internal/tickets/*.md` is the older + smoke-run convention and
  the one referenced from code/CHANGELOG. I used both, deliberately split by kind.
- The plan's §8.3 claim that the e2e-baseline triplication was "already ticketed
  elsewhere" is **false** — I searched both stores. Filed it.

## The nodeOutline flake — read this before touching that file

`nodeOutline.e2e.ts:92` is RED in this container and it is **not ours**. Proof chain:
passed on the first-ever run (11/11, 2.8s) → failed 4× after, **twice on a stashed
pristine tree** (11 tests ⇒ stash really applied) → probe showed the node present and
correct at `t0` (`main`/`outline`/160px) and **unmounted by `t1500`**, permanently,
with a healthy metadata cache. React Flow culling + `fitView`-on-mount-only.
Ticket: `docs-internal/tickets/ticket-e2e-headless-culling-unmounts-main-node.md`.

Consequences you will hit:
- Because the file is `serial`, that one red hides every later case as "did not run".
  To verify anything you add there, use `--grep`.
- My 3 cases go through `showNoteWithRefitGraph()` (openFile → `remountGraphView()` →
  assert tier). **Delete it when the flake is fixed**; its docblock says so.
- Full-suite red is 3 files: nodeOutline (above), `vicinityGraph.e2e.ts:160`
  (`ticket-e2e-gamma-breadcrumb-fails-headless.md`), `edgeRoutingEval.e2e.ts:171`
  (`nid_6lxaenl4oamjxqj6f0eh6rr4c_e`). All pre-existing. Baseline for next time.

## Dead ends / near-misses

- I first suspected the metadata cache wasn't indexed (empty `headings` ⇒ thumbnail).
  The probe killed that: `headings.length = 13` the whole time. **Don't re-chase it.**
- Playwright's `check()` on the PANEL radio would sometimes pass (it re-clicks and
  re-verifies) — which is exactly why it is the wrong tool: it hides the controlled/
  uncontrolled asymmetry. `.click()` + retrying `expect` is deliberate. Same for
  reading the store: `expect.poll`, never a single `page.evaluate`.
- I considered restoring `nodePreviewPreference` at the end of `settingsUxVisual`'s last
  case. Not needed — `prepareVaultCopy()` wipes `.tmp/e2e/vault` and deletes its
  `data.json` on every `launch()`, and each spec file launches its own instance.
- A throwaway probe spec (`e2e/zzprobe.e2e.ts`) is the cheapest diagnostic in this repo:
  Playwright's `testMatch` is `**/*.e2e.ts` in `e2e/`, so dropping a file there and
  running `npm run test:e2e -- zzprobe.e2e.ts` works. **Delete it before committing** (I did).

## Doubts / watch items for whoever comes next

1. **The light-theme trough.** If the human dislikes the hairline look in light, the
   next lever is NOT another background variable (they all resolve to the page colour
   in light) — it's a border/shadow treatment, or accepting Obsidian's own look.
   Filed as part of the smoke-run ticket, item 2.
2. **The focus ring shares `--interactive-accent` with the selected fill.** With `Auto`
   (the default) selected at the group's edge, the ring abuts the fill across a 1px
   border. Recorded as a taste call in the smoke-run ticket; I did not change it
   because wave B chose that idiom deliberately and it matches `graph-view.css:606-609`.
3. `settingsUxVisual.e2e.ts` now ends with the panel pill set to `"image"`. Anything
   appended to that file must not assume `auto`.
4. My `setNodePreviewPreference()` harness helper calls `refreshOpenViews()`. If a
   future test needs to observe the *no-fan-out* bug (`nid_u36pqr4zljs44jt42lk9ln8ry_e`),
   it must NOT use this helper — it papers over exactly that.
5. `e2e/` is still outside `npm run check` (tsconfig includes `src/**` only). Run
   `npx tsc -p e2e/tsconfig.json` by hand, or trust `run-e2e.sh` which does it for you.

---

# PRIVATE working notes — IMPLEMENTATION_ITERATION round 1 (B1 fix)

Appended by the round-1 instance. Waves A/B/C above still hold **except** where noted.

## Where things stand

- `1623084` = the B1 fix + ticket correction. Tree clean. `e2e/` and ticket text only.
- Numbers: `npm run check` exit 0; `npx tsc -p e2e/tsconfig.json` exit 0;
  `npm test` **1 failed | 894 passed (895)** (the known-RED `linkStrengthFactor.max`);
  full `nodeOutline.e2e.ts` **14/14 on 5 runs**; full e2e **67 passed / 2 failed / 7 did
  not run**. Logs: `.tmp/it1-*.log` (`check`, `test`, `e2e-tsc`, `nodeOutline-run{1..5}`,
  `nodeOutline-CONTROL`, `nodeOutline-with-workspacejson`, `e2e-full`, `e2e-full-final`,
  `setup`, `stash`).

## The thing to know about running this file

**`.dev-vault/.obsidian/workspace.json` decides whether `nodeOutline.e2e.ts` is
informative at all.** `prepareVaultCopy()` copies `.dev-vault` wholesale, so a saved
workspace restores small pane geometry ⇒ the `:92` culling flake ⇒ "13 did not run".
Recipe I used, and the one to reuse:

```bash
mv .dev-vault/.obsidian/workspace.json .tmp/workspace.json.bak   # gitignored, safe
npm run test:e2e -- nodeOutline.e2e.ts                            # informative
mv .tmp/workspace.json.bak .dev-vault/.obsidian/workspace.json    # PUT IT BACK
```

I put it back. If you find it missing, Obsidian recreates one on the next dev-vault run;
nothing is lost either way, but leaving the repo as found matters.

**Do NOT use `--grep` on this file.** That is what hid B1. Wave C's private note above
says "To verify anything you add there, use `--grep`" — **that advice is now retracted**;
use the workspace.json recipe instead.

## Things I verified rather than assumed

- `setMaxNodeSizePx` has exactly ONE caller (E7). `setGlobalNodeCap` / `setLayoutMode`
  are the same "store write, no rebuild" shape, and **their** callers already follow with
  an explicit `remountGraphView()` (`controlsRestart:150→157`, `vicinityGraph:234`). E7
  was the lone outlier relying on an implicit trigger — which is why the fix is E7-side,
  not harness-side. I considered making `setMaxNodeSizePx` fan out internally (as
  `setNodePreviewPreference` does) and rejected it: it would make the three sibling
  setters inconsistent and hide the rebuild from the reader, which is the opposite of the
  lesson B1 teaches.
- The A/B was run in the SAME checkout with only `git stash push -- e2e/nodeOutline.e2e.ts`
  between the two runs, so build, vault and Obsidian binary are provably identical. Stashed
  → 13 passed / 1 failed at E7 (`Expected: hidden / Received: visible`); popped → 14/14.
  That is the tightest control available here and it is worth reproducing before believing
  any future claim about this file.
- `remountGraphView()` really does re-read the store: E7 asserts a 72–104px height band
  after a maxPx write with no other trigger, and it passes. So remount == rebuild, not just
  a viewport refit.
- The "7 did not run" in the full suite is arithmetic, not exclusion: edgeRoutingEval
  fails #5 of 6 (⇒1) and vicinityGraph fails #13 of 19 (⇒6). Same as wave C's accounting
  minus nodeOutline's 13.

## Dead ends / near-misses

- My first instinct was the reviewer's literal suggestion (`remountGraphView()` after
  `setMaxNodeSizePx`, keeping the separate `openFile` + tier assert). That is 3 lines but
  duplicates the body of `showNoteWithRefitGraph()` verbatim. Reusing the helper is the
  same fix, DRY, and it makes E7 and E8 read identically — worth the docblock rewrite the
  reuse forced.
- I nearly left the helper's docblock alone. That would have been a trap: its ticket says
  "then delete `showNoteWithRefitGraph()`", and after this change deleting it re-introduces
  B1. Both the docblock and ticket step 3 now say so.

## Watch items for whoever comes next

1. **If you fix the culling flake, do not delete the helper** — trim only its reason (2).
   E7 and E8.3 need reason (1) forever.
2. **E7 must stay LAST** in the file (it shrinks every node). That is intrinsic, not an
   inherited assumption, and its header says so.
3. E1–E5 still share `beforeAll`'s MAIN node deliberately. They assert nothing about
   sizing or the preference, so no B1-class coupling — but if anyone adds a sizing or
   preference assertion up there, it must establish its own MAIN first.
4. Wave C's PUBLIC record still contains the "pristine tree" phrasing in its own section
   (preserved by instruction). The correction of record is in the round-1 PUBLIC section
   and in the ticket. Do not quote wave C's sentence as evidence.
