# PHASE 2 — docs / specs / e2e / release note — RESULT

Ticket `nid_ez38gf1mrdgh5kxedzrdicwzl_e`. **Gates: `npm test` exit 0 — 82 files / 1083 tests passed
(`.tmp/phase2-final-test.log`); `npm run check` exit 0 (`.tmp/phase2-final-check.log`, both projects).**
`npm run test:e2e` NOT run — it needs a real Obsidian and is the release gate; every e2e edit below is
locator-accurate against the current `src/view/` code, which I read, but it is **unverified at runtime**.

3 focused commits on the same branch:

| commit | scope |
|---|---|
| `89ec065` | docs: high-level-plan, architecture-map, notes/settings.md, step-03/06 banners, RELEASE_CHECKLIST, README |
| `336c977` | e2e: global-depth specs, pinned-centrals baseline removal, doc-data comment scrub, depth-controls CSS |
| `4019f90` | CLAUDE.md + step-06 smoke-run gate: stale facts |

## What changed, per file

### `docs-internal/plan/high-level-plan.md`
- Goal 3: "per-node … remembered per document" → directional depth as **one global setting**.
- Traversal: per-root depth bullet → every root traverses with the one global pair (the per-root BFS
  itself survives, so a pinned node still keeps its reach when disconnected).
- Node exclusion: "(not per-doc)" reworded.
- Truncation chain: dropped the "same chain resolves multi-pin conflicts in the settings cascade" tail.
- §"Pinning and settings resolution" → **§"Pinning and settings"**: cascade / two settings classes /
  `centralDepths` / pin-on-toggle / per-control reset-to-global all replaced by "every setting is
  GLOBAL — one value, one layer", plus a WHY-NOT recording the removed per-doc model and its cost
  (numbers taken from the ticket, not invented) and the fact that pins stay docid-keyed so a future
  per-doc layer is additive. Reset affordances restated as per-section + one tab-wide scope.
- §Persistence: `data.json` is the only store; the doc-data bullet becomes a sub-bullet saying stale
  dirs are IGNORED and pointing at the release note + the clean-break convention (the sync-friendliness
  rationale is preserved for whoever adds a per-doc store later). Sweep validates pinned docids only.
- Phases 1 / 3 / 6 summaries: current shape stated, "shipped then removed" in a parenthetical.
- V2 list: "data format is already shaped for it" was false → per-view sizing now starts with a
  storage decision.

### `README.md` (user-facing accuracy — the main one)
- Intro: "per-direction, per-note depth control" → "per-direction depth control … right in the view".
- §Settings model preamble rewritten: **every setting is global, no per-note settings**, two surfaces
  editing one value. `### Global defaults` → `### The settings`.
- **Depth** bullet now states the panel steppers explicitly and that one pair covers the active note
  *and* every pinned central, so nudging it changes every graph.
- `### Per-note depth overrides` section DELETED (pin-on-toggle, per-field override, reset-to-global).
- Restore-defaults tail: "Per-note depth overrides and pins are never touched" → pins.
- §Pinning: the "subtle bit" (`centralDepths` inside Y) deleted; replaced by "pins are docid-keyed, so
  renames/moves keep them" + "pinned centrals share the one global depth". Restart-lag caveat KEPT
  (verified still real — see below) with "missing from the toolbar list" removed, since that
  disclosure no longer exists.
- Node exclusion / V1 limits / V2 roadmap / the `VICINITY_E2E_VAULT` caveat: `doc-data/*.json` and
  "no per-note override" wording corrected.

### `docs-internal/architecture-map.md`
- Persistence layer: `data.json` is the ONLY store, `DocDataStore` gone, stale dirs ignored, sweep
  prunes stale pins.
- Key seams: `OwningViewPort` + `view/settingsWriteScope.ts` no longer exist → refresh reach is the one
  `ViewsRefreshPort` (this was a second stale claim in the file, beyond the ticket's `:24-27`).

### `docs-internal/notes/settings.md` — the ratified-bar restatement (OWNER ACCEPTED 2026-07-29)
- The "not a hole" parenthetical no longer names `ViewSettingsResolver.resolve`; it states that **no
  site enumerates `ViewSettings` fields** since 2.5 and that the parse layer is the one place that
  rebuilds the type, guarded by `ParsedViewFields`.
- The ratified acceptance bar (was ":73-78") now carries a third paragraph: **"Restated on 2026-07-29
  with 2.5 (owner accepted the restatement)"** — completeness is compile-forced by the descriptor
  model, named precisely as it exists in the tree: the `ParsedViewFields` mapped type
  (`persistedShapes.ts:135`) plus the `Exclude<keyof ViewSettings, …>` guards in
  `engine/SettingsSpec.ts` and `view/settingsSectionFields.ts`, backed by the all-fields-non-default
  round-trip pair in `persistedShapes.test.ts`. **"Read the bar as: do not weaken THOSE."** and
  "Tickets 4/5/6 inherit this reworded bar, not either earlier wording."
  - Deviation from the brief's wording, deliberate: I did **not** write `satisfies Record<keyof
    ViewSettings, …>` because no such construct exists in the tree (grep: only `Exclude<keyof …>` and
    the mapped type). Naming a guard that does not exist would be exactly the drift this file kills.
- Standing decision "Absent override means inherit" → **"An absent field means 'inherit the spec
  default'"**, scoped to descriptor/parse semantics: no override layer and no `ViewSettingsOverride`
  type; the live rule is that a field missing from `data.json` parses `undefined` and merges over
  `PersistedShapes.defaultPluginData()`, so "absent ≠ present-but-default" must stay distinguishable.
  Chain-table row 2's one-line invariant matched to it.
- Two dead symbol names in the closed-holes list fixed (`parseViewOverride` → renamed;
  `settingsWriteScope` deleted).

### Step docs — superseded banners only, history intact
- `step-03-adapters-and-persistence.md` and `step-06-controls.md` each got a blockquote naming the
  ticket, listing exactly which clauses are superseded, pointing at the current source of truth, and
  stating what SURVIVES (docid/filename-safety/pin plumbing; pinning UI).

### `docs-internal/RELEASE_CHECKLIST.md`
- New **§7 "Release notes — stored-data breaks and behaviour shifts"** (License note renumbered to §8;
  the "see §6" cross-reference is unaffected), with two checkboxes:
  1. per-note depth/view overrides removed, settings global-only, stored overrides **discarded**,
     `doc-data/` no longer read or written and deletable by hand, **pins and globals are kept**;
  2. the **UX shift**: the panel's depth steppers now change a GLOBAL setting affecting every note and
     every open view, and one depth pair drives MAIN + every pinned central.

### `e2e/`
- **`pinnedCentralScenario.e2e.ts`** — the deferred rewrite. Header now describes both parts; the
  `TODO(PHASE 2)` is gone. Two new BDD tests appended after the pin-lifecycle test (the file is
  `mode: "serial"`, and each states + verifies the GIVEN it inherits):
  - *"WHEN the global outgoing depth is raised THEN MAIN's own reach grows by a hop"* — unpins `sc_x`
    (leftover pin from the test above, verified via `data-tier=regular`), asserts `sc_x1` absent at the
    shipped depth 1, bumps the panel's outgoing stepper to 2, asserts `sc_x1` enters.
  - *"WHEN a note is pinned THEN it traverses from ITSELF at that same global depth"* — at depth 2
    `sc_x2` is three hops from MAIN, hence unreachable; pinning `sc_x` brings it in. That is the only
    root that reaches it, so the assertion cannot pass vacuously.
  - New locators mirror `controlsRestart.e2e.ts`: `.vicinity-graph-depth-controls`,
    `.vicinity-graph-stepper__value`, `aria-label="Increase outgoing depth"` (read off
    `DepthStepper.tsx`), toolbar opened via the native `open` property with the existing WHY-NOT.
- **`controlsRestart.e2e.ts`** — **confirmed already correct, left untouched.** It mutates the global
  depth stepper, a pin, a sizing weight and the node cap, restarts real Obsidian, and re-reads all of
  them from `data.json` via `harness.readGlobalView()` — i.e. globals only. Its pin tail still documents
  the 15s sweep warm-up, which is the still-open lag defect, not a stale comment.
- **`settingsBaseline.ts`** — `PINNED_CENTRALS_SUMMARY` + `PINNED_CENTRALS_SUMMARY_PATTERN` deleted;
  the exhaustiveness doc comment now says the panel list is exhaustive with NO name-based exemption
  ("Advanced spacing" is still excluded structurally).
- **`settingsUxVisual.e2e.ts`** — the `hasNotText` filter dropped (locator is now all top-level
  summaries), the import removed, and the "no Pinned centrals disclosure" absence test deleted: the
  disclosure it guarded was deleted from `GraphToolbar`, so the test is vacuous forever, not merely
  passing. The count+identity+order pin it backstopped is now fixture-independent.
- **`vaultTarget.ts` (3 spots) / `obsidianHarness.ts` (2 spots)** — comment-only `doc-data/` scrub.
- **`e2e/vaultCopyReseed.test.ts`** — does not exist in this tree (already noted in PHASE 1); nothing
  to remove. No harness wipe of `doc-data/` remains (PHASE 1 removed the code).

### `CLAUDE.md`
- One stale FACT fixed: the persistence bullet said "Per-doc files, never a single blob" — now
  "`data.json` is the only store … Nothing is per-document; every setting is global." No deep-memory
  file states anything about this repo's persistence, so none was touched.

### Beyond the brief (found while checking, both live artifacts, not history)
- **`docs-internal/tickets/ticket-step-06-controls-human-smoke-run.md`** is an OPEN **release gate**
  (RELEASE_CHECKLIST §2) whose human checklist told the runner to verify inherited-vs-pinned depth
  styling, the per-control ↺ reset and the per-`centralDepths` scenario — all deleted. Re-scoped with a
  banner: item 4 now asks the human to judge the GLOBAL-depth UX risk, item 5 adds the depth-row indent
  change, item 6 is the global-depth scenario, and the "already verified automatically" bullets name
  the surviving tests. Also corrected a **pre-existing** error (it claimed MAIN offers no pin gesture;
  `pinnedCentralScenario.e2e.ts` asserts it does). `.ai_out/step-06-controls/main/QA_CHECKLIST.md`
  still has pre-simplification wording — flagged in the banner, not edited (ai_out artifact).

## The two deferred suggestions — judged

| # | suggestion | disposition |
|---|---|---|
| 6 | Depth disclosure summary honesty ("Depth (all notes)" / a hint) | **NOT implemented — escalated as `#QUESTION_FOR_HUMAN` below.** I agree the gap is real, but the brief is explicit that new user-facing copy is the owner's call. Mitigated meanwhile: the README now says outright that the panel's Depth applies to every note and every pinned central, and the release note carries the UX-shift line. |
| 7 | `.vicinity-graph-depth-controls` card chrome is redundant nesting | **ACCEPTED and implemented** (`src/view/graph-view.css`) — and it turned out to be more than taste, so it did not need eyes on real Obsidian to decide: the rule set `background: var(--background-primary)` on a child of `.vicinity-graph-disclosure`, which already paints that exact variable (invisible), and added `padding: var(--size-4-2)` on top of the disclosure body's own padding, insetting the two depth rows deeper than every sibling section's rows (`.vicinity-graph-sizing__metrics` has no such wrapper) — an altitude mismatch, not a grouping cue. Reduced to layout only; the tighter `--size-4-1` gap is kept with a WHY. No test asserts the removed properties; the smoke-run gate now lists the indent as something to eyeball. |

## Ticket bookkeeping for TOP_LEVEL_AGENT (I closed nothing, wrote no change_log entry)

1. **`docs-internal/tickets/ticket-per-doc-write-leaves-sibling-views-stale.md` → CLOSE.** I added a
   banner in the file recording the resolution; suggested closing note:
   > Closed by `nid_ez38gf1mrdgh5kxedzrdicwzl_e` (global-only settings), which took option (a):
   > `settingsWriteScope.ts`, the `SettingsWriteScope` type and `OwningViewPort` are deleted and
   > `ControlsActions.applySettings` unconditionally calls `refreshAllViews()`, so the defect is gone
   > by construction. The "flip the two per-doc tests" instruction is moot — those tests covered
   > per-doc scope and were removed with it (owner-aligned); the fan-out is pinned by the global-scope
   > tests in `src/view/ControlsActions.test.ts`.
2. **`nid_7fq9y51mbucmduzf9z31hmwmq_e` (doc-data dir-name constant) → CLOSE as obsolete.** Suggested
   note:
   > Obsolete: `nid_ez38gf1mrdgh5kxedzrdicwzl_e` deleted the doc-data subsystem, including
   > `src/persistence/docDataDirName.ts` and its e2e counterpart. There is no dir name left to share.
3. **`docs-internal/tickets/ticket-pinned-central-status-lags-after-restart.md` → KEEP OPEN, adjusted
   (do NOT close).** Re-verified against the current tree: the root cause is untouched — `PathDocIdMap`
   is still in-memory only (`src/persistence/PathDocIdMap.ts`), warmed only by `OrphanSweeper.run()`
   (`:54`) plus MAIN's own id in `VicinityGraphBuilder:42` and the pinned doc in
   `PersistenceServices:48`; the sweep still starts at `SWEEP_DELAY_MS = 15_000`; the assembler still
   skips a pin whose docid does not resolve. **Still reproducible.** I edited the ticket in place: the
   scope-check banner now records the re-verification, and the two stale remarks are corrected
   (per-doc depth settings no longer exist; the "Pinned centrals" disclosure is gone, so the lag shows
   purely as node styling). Options A/B/C stand unchanged.
4. Also worth annotating (my own edit already landed, no close):
   `docs-internal/tickets/ticket-step-06-controls-human-smoke-run.md` — re-scoped for global-only
   settings, still OPEN as a release gate.

## Callouts

- **`npm run test:e2e` was not run** (real Obsidian required). The two new specs and the two deletions
  are my highest-risk deliverable. The new specs' one runtime assumption I could not exercise: that the
  panel's `<details>`-hidden Depth section still resolves `getByRole("button", …)` after
  `openToolbar()` — mirrored from `controlsRestart.e2e.ts`, which does exactly this and is green in CI.
- **Ordering dependency, by design**: the two new specs consume the pin state and the depth value left
  by the tests above them. The file already declares `mode: "serial"`, and each test verifies its GIVEN
  before acting, so a broken assumption fails loudly instead of silently passing.
- The UX shift (panel depth = global) is now documented in three places that must stay in sync if the
  copy changes: `README.md` §Settings model, RELEASE_CHECKLIST §7, and the smoke-run gate's item 4.
- `main.js` / `styles.css` remain untracked build artifacts. The CSS change means the next build
  regenerates `styles.css`.

## `#QUESTION_FOR_HUMAN`

`#QUESTION_FOR_HUMAN:` The graph controls panel still summarises its depth section as plain **"Depth"**
with "Outgoing"/"Incoming" rows, but a bump there now writes the GLOBAL setting: it changes every note's
graph and fans out to every open view. Reviewer + implementer both flagged this as a POLS gap. Do you
want the surface to say so, and in what words — e.g. summary **"Depth (all notes)"**, or keeping "Depth"
with a one-line hint under the steppers? I deliberately invented no wording: it is user-facing copy, it
must match the release-note sentence, and it drags an anchored identity+order e2e assertion
(`e2e/settingsBaseline.ts` `CONTROLS_PANEL_DISCLOSURES`) plus the depth locators in
`controlsRestart.e2e.ts` and `pinnedCentralScenario.e2e.ts` with it. Answer "leave it" and I will drop it.
