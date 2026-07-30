# Stage 3 review — the outgoing-embed channel + its depth budget

Reviewed: commits `8a25a98 … d36f1b2` on
`nid_fay1hu5sxcoygizopkkg0f0d7_e_2026-07-29T20-38-42PDT`, read as diffs, not as
PUBLIC.md. Independently run:

- `npm test` → **1212 passed / 91 files**, exit 0 (`.tmp/rev3_test.log`)
- `npm run check` (src + e2e) → clean, exit 0 (`.tmp/rev3_check.log`)
- No `sanity_check.sh` in this repo.

**VERDICT: DONE and shippable.** No BLOCKING issues. 5 SHOULD-FIX, all small,
none of which changes shipped behavior; two of them are corrections to the
write-up itself, which matters more than usual because this ticket exists to
produce a trustworthy number.

**MEASUREMENT trustworthy as-is? ALMOST — one arithmetic defect must be fixed
first** (SHOULD-FIX 1). The method, the headline, the caveats and the "~14 lines
of real code / 8→1 silent lists" claims all survive independent audit; the
fixture-churn *file count* in the table does not, and the table's rows do not sum
to its own headline.

---

## 1. The corrected D1 claim — INDEPENDENTLY VERIFIED, and the implementer is RIGHT

I checked this from the code, not the write-up.

`VicinityTraversal.bfs` (`/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/src/engine/VicinityTraversal.ts:108-148`)
runs one independent BFS per channel, and `neighborsOf` (`:156-165`) hands each
outgoing channel **only its own kind** via
`OutgoingReferences.targetsOfKind`. So the node/edge set reached by
`outgoing-link ∪ outgoing-embed` at budget *D* is exactly the set of paths of
length ≤ *D* that are **kind-homogeneous end to end**. The old behavior was every
path of length ≤ *D* regardless of kind.

- Those two sets coincide **iff every path of length ≤ D is trivially
  homogeneous**, i.e. iff `D ≤ 1`. A chain needs two hops to change kind.
- At `D = 2` with **equal** budgets the new set is a **strict subset** — never a
  superset, since kind-pure paths are a subset of kind-blind paths.

So the ticket's D1 rationale ("*at equal defaults* the two outgoing channels
union to exactly today's outgoing BFS") is **wrong as stated**: the property is
carried by *one hop*, not by *equality*. The implementer's correction is correct,
and the fact that they found it by writing an equivalence test at budget 2,
watching it fail, and **splitting it into two honest suites rather than weakening
it** is exactly the behavior CLAUDE.md asks for.

**Practical blast radius, stated concretely (I read the spec, not the prose):**
`SETTINGS_SPEC.globalDepths` ships `linkDepthOut: 1`, `embedDepthOut: 1`,
`linkDepthIn: 1` (`src/engine/SettingsSpec.ts:160-177`), pinned literally in
`src/engine/settingsProductDefaults.test.ts:49-52`. Therefore:

- **At ship: zero observable change.** Correct, and pinned.
- **The moment a user nudges "Links out" or "Embeds out" from 1 to 2** — the most
  likely first interaction with this very feature — they can lose nodes relative
  to the old plugin. That is the honest one-line framing for the owner.

The correction is recorded in every place it needs to be: the spec default's own
doc comment (`SettingsSpec.ts:164-175`, including "Raising this default therefore
changes the default graph in TWO ways"), `docs-internal/plan/high-level-plan.md`
(traversal bullet), `README.md` (Depth note), `docs-internal/RELEASE_CHECKLIST.md`
§7, the `54eacf5` commit message, and two test-suite docblocks
(`src/engine/VicinityTraversal.test.ts:455-470` and `:503-513`). Nothing anywhere
still repeats the ticket's wrong version. This is well handled.

## 2. The MEASUREMENT — audited

Method is sound: the field really is isolated in `21b3152` and nothing else rides
in it. I re-derived the numbers.

| Claim | Audit |
|---|---|
| 25 files, +91 / −43 | **CONFIRMED** (`git show 21b3152 --stat`). |
| ~14 lines of real code | **CONFIRMED.** Counting non-comment additions: `types.ts` 1, `SettingsSpec.ts` 2, `constants.ts` 1, `persistedShapes.ts` 1, `settingsSectionFields.ts` 1, `settingsRows.ts` ~6, plus 2 test-table lines ≈ 14. The other ~77 added lines are doc comments and fixture literals. Honest. |
| 6 production files, 4 compile-forced | **CONFIRMED.** `SETTINGS_SPEC` (`_assertEverySettingsFieldSpecced`), `EngineDefaults.depthSettings` return type, `definedFieldsOnly<DepthSettings>`, `SECTION_SETTINGS_FIELDS` (`_assertEverySettingsFieldSectioned`) each fail `tsc` without the field. |
| "silent lists 8 → 1" | **CONFIRMED, and the survivor is correctly identified.** I verified the two hand-maintained test tables really are *loud*: both `settingsProductDefaults.test.ts` and `settingsSpecBounds.test.ts` walk `EVERY_SETTINGS_SPEC_LEAF` and fail naming the missing leaf. And I verified the direction of the remaining hole: a row naming a bogus field is a compile error (`keyof DepthSettings`), so the only silent failure is spec-field → **no row**. |
| "Zero structural settings suites needed an edit" | **Substantively true, loosely worded.** The spec-walking suite (`src/persistence/settingsSpecPersistence.test.ts`) needed nothing. But `src/persistence/persistedShapes.test.ts` — a *rules* suite — did need two fixture edits, and the write-up's bullet names "persistence round-trip … garbage" without distinguishing. See NIT 1. |
| Fixture churn: "13 files (9 unit + 4 e2e)" | **WRONG — see SHOULD-FIX 1.** |
| Caveat: per-doc layer removed separately | **Fairly weighted.** It is listed first among "honesty caveats", the "2 → 4 controls" research line is explicitly declared void, and "attribute maybe half the delta there" is a defensible, non-flattering estimate. I would not argue for a stronger discount. |

**Bottom line on the measurement: the conclusion ("the descriptor model
delivered") is supported by the evidence I can verify independently**, and the
write-up does not flatter itself on the load-bearing numbers. Fix the file-count
arithmetic and it is trustworthy as-is.

## 3. The remaining "exactly 1 still-silent step" — characterisation is right

Correct, and worth the follow-up the write-up itself proposes. A `DepthSettings`
/ `ViewSettings` leaf that is specced, parsed, persisted and reset but never
declared in `SETTINGS_GROUPS` compiles, round-trips, and ships as a setting
reachable only by hand-editing `data.json`. Nothing catches it: the parity test
(`src/view/settingsRowParity.test.ts`) walks the *rows*, so a missing row is
simply a smaller walk. The proposed guard ("every settings leaf has a declared
row") is ~10 lines and closes it. But it was **not filed** — see SHOULD-FIX 4.

---

## 🚨 BLOCKING

**None.**

## ⚠️ SHOULD-FIX

### 1. The MEASUREMENT table's file counts are wrong and do not sum to its own headline
`IMPLEMENTATION_STAGE3__PUBLIC.md:52-57` (and the `21b3152` commit message).

The table's rows are 4 + 1 + 1 + 2 + 13 = **21**, against a headline of **25**.
The fixture-churn row is the error: the actual churned files are **17** — 13 unit
(`GraphRequestAssembler`, `GraphTruncator`, `NodeSizer`,
`VicinityEngine.denseFixtures`, `VicinityEngine`, `VicinityTraversal`,
`truncationHarness`, `PluginDataStore`, `persistedShapes`, `ControlsModel`,
`settingsResetPlan`, `settingsSectionFields`, `settingsWritePlan`) + **4** e2e —
not "13 (9 unit + 4 e2e)". The commit message independently says "18", which is
also wrong.

*Failure scenario:* the owner reads a table that is meant to be the audited
artefact of the whole settings cleanup, adds it up, and finds it does not
reconcile — which is exactly the credibility the mandate asked to protect.
*Direction:* set the fixture-churn row to **17 (13 unit + 4 e2e)** so the rows sum
to 25, and correct the commit-message figure in the ticket note. The headline
(25 / +91 / −43 / ~14) and every conclusion stand unchanged.

### 2. The acceptance equivalence test is insensitive to the very default it claims to track
`src/engine/VicinityTraversal.test.ts:471-501`.

The suite deliberately reads `EngineDefaults.depthSettings()` instead of a
literal "so it tracks the spec" — good intent. But the fixture (`a [[c]]`,
`a ![[b]]`, `FILES` at `:473`) has **no two-hop chain**, so `asAuthored()` and
`kindBlind()` produce identical results at *any* budget ≥ 1. If someone raised
the shipped default to 2, this suite would keep passing green while asserting a
property that is false — precisely the failure the spec comment at
`SettingsSpec.ts:170-175` warns about ("Raising this default therefore changes
the default graph in TWO ways"). The only thing that would redden is the literal
tripwire in `settingsProductDefaults.test.ts`, which pins the *number*, not this
*equivalence*.

*Direction:* extend `FILES` with a kind-changing second hop (`b [[d]]` on top of
`a ![[b]]`) so the two providers diverge at budget 2. The suite then genuinely
means "this equality holds at whatever the spec currently ships", and breaks
loudly if the default rises.

### 3. `high-level-plan.md` asserts a test that no longer exists
`docs-internal/plan/high-level-plan.md:62`: "`Reference.original[0] === "!"` is
the independent cross-check, **asserted in tests**, not read in production."

That suite was **deleted as circular** in `eab9bd2` (Stage-1 review round;
`src/adapters/ReferenceOrder.test.ts`, −46 lines). The claim was added in
`5c13f8f` and never corrected. Stage 3's docs commit (`4860a6b`) edited the line
immediately above it and left this one standing.

*Failure scenario:* a future maintainer changes the provenance rule, reads the
plan, believes a cross-check guards them, and ships an unguarded change. A doc
that promises a guard which does not exist is worse than silence.
*Direction:* replace "asserted in tests" with the truth — the assumption is a
real-Obsidian measurement, tracked by the follow-up ticket filed in `eab9bd2`.

### 4. The measurement's own headline recommendation was not filed as a ticket
`IMPLEMENTATION_STAGE3__PUBLIC.md:70-71` and `:94-95` name the row-completeness
guard as the one thing the write-up "would recommend", and `:192` lists the
silent gap under "known gaps". Two other follow-ups *were* filed
(`nid_2qygmn0z59t8fdlb5e9pap49m_e`, `nid_6kjmn2y8jc8a9gxynudusbmlk_e`); this one
was not. CLAUDE.md: "Spot issues outside your task → file a ticket, don't
silently patch." A recommendation that lives only inside an `.ai_out/` write-up
is lost the moment this branch merges.

*Direction:* file it (title along the lines of "every settings spec leaf must
have a declared row"), with the ~10-line shape already described.

### 5. Ticket left `status: open`
`_tickets/separate-depth-budget-for-embedded-outgoing-links.md:5`. Stage 3 is the
final stage and the STAGE 3 LANDED note is written, but the ticket is not closed.
Close it once 1–4 are addressed (or note explicitly that the orchestrator closes
it).

## 💡 NITs (no action strictly required)

1. **"Zero structural settings suites needed an edit"** (`PUBLIC.md:60-61`) is
   true of `settingsSpecPersistence.test.ts` (the spec-walking suite) but the
   sentence lists "persistence round-trip / … / garbage", and
   `src/persistence/persistedShapes.test.ts` — the hand-fixtured *rules* suite —
   did take two edits. One clause distinguishing "spec-walking suites" from
   "rule suites with hand-written fixtures" would remove the ambiguity.
2. **A round-trip literal lost a little discriminating power.**
   `src/persistence/persistedShapes.test.ts:25` changed `linkDepthIn` from `2` to
   `1`, which is now the shipped default — so for that field the round-trip
   assertion can no longer distinguish "parsed" from "fell back to default". The
   fixture edit was compile-forced; the `2 → 1` part was gratuitous. Immaterial
   in practice because `settingsSpecPersistence.test.ts` proves a guaranteed
   non-default round-trip for *every* leaf, but there is no reason not to leave
   it at 2.
3. **Node sizing stays kind-blind.** `src/engine/NodeSizer.ts:140` counts
   outgoing links via `getOutgoingLinks` (kind-blind), so with
   `embedDepthOut: 0` a node is still *sized* by targets the graph will never
   walk. Defensible ("how connected is this note" is a different question from
   "what do I traverse") and consistent with `getLinkCount` staying kind-blind,
   but it is a POLS edge nobody has written down. One sentence in the plan, or a
   line on the Stage 2 ticket, would cover it.
4. **No e2e drives the "Embeds out" stepper specifically** — correctly disclosed
   in the write-up; `npm run test:e2e` is a release gate and was not run here
   either. The row's *existence* in both surfaces rests on the source-scan parity
   test, which is the repo's known and documented limit
   (`nid_7qot0m6nuxxmd5z0yb9jylsd6_e`).

---

## Checks that came back CLEAN

- **Rename completeness.** `git grep outgoingDepth|incomingDepth` over
  `src/ e2e/ docs-internal/ README.md CLAUDE.md` returns **only** the two
  deliberate historical mentions: the `RELEASE_CHECKLIST.md:99-100` release note
  (the D2-required mitigation, which *must* name the old keys) and
  `docs-internal/notes/settings.md:240` (a "DEFERRED then LANDED" provenance
  record). No stray key survives in code, tests, e2e or fixtures.
- **No migration, no dual-key shim.** `parseDepthFields`
  (`src/persistence/persistedShapes.ts:118-127`) reads the three new keys and
  nothing else; unknown keys fall through to spec defaults. Clean break as D2
  requires, and as CLAUDE.md's unpublished-plugin convention allows.
- **`PERSISTED_SHAPE_VERSION` untouched** — still `2` at
  `src/persistence/persistedShapes.ts:40`, identical to the branch point
  `e387f5a`. Matches D2's reasoning.
- **No behavior-capturing test removed or weakened.** I diffed every removed
  `it(`/`describe(`/`test(` line across `8a25a98~1..HEAD`: all six are **renames**
  with a matching `+` line and the same assertion (`direction` → `channel`
  vocabulary, `outgoingDepth` → `Links-out`). Nothing was deleted, skipped or
  assertion-aligned. 13 new tests added, all BDD `WHEN … THEN …`, one behavior
  each.
- **The 6a cost is pinned with a control case.** `VicinityTraversal.test.ts:529`
  ("WHEN the whole chain is ONE kind THEN two hops are walked as before") is what
  makes the gap test prove the gap is the *kind change* and not a broken budget.
  This is the difference between a test and an assertion-shaped placeholder.
- **D5 pinned with NO production code**, exactly as the ticket required
  (`VicinityTraversal.test.ts:546-573`): embedded image never a node, both
  written forms are attachments, embedded attachment survives `embedDepthOut: 0`.
  The `isNodeBearing` gate (`VicinityTraversal.ts:136`) is untouched.
- **Architecture / OCP.** `CHANNELS` + `_assertEveryChannelListed`
  (`src/engine/types.ts:43-60`), `CHANNEL_DEPTH_FIELD` as `Record<Channel, …>`
  (`:242-258`) and the new `CHANNEL_LINKER` table
  (`VicinityTraversal.ts:62-66`) each turn "a new channel was forgotten" into a
  compile error instead of, respectively, an unspent budget and a back-to-front
  edge. `neighborsOf` is an exhaustive `switch` with no `default`. The `Direction
  → Channel` generalisation is the additive shape the scope decision called for.
- **Layering / purity.** `src/engine/` gained only a `../shared/LinkKind` type
  import — permitted, and `importGuard.test.ts` passes. Deviation 1 (a settings
  row names `field: keyof DepthSettings` rather than a `Channel`) is a genuine
  **improvement** on the brief: the view no longer imports traversal vocabulary,
  `CHANNEL_DEPTH_FIELD` is read in exactly one place (the BFS), and it is what
  made the field measurable in isolation. Both deviations are disclosed.
- **Settings plumbing follows the CLAUDE.md conventions.** ONE row declaration
  drives both presenters; no hand-typed label, order or accessible name entered a
  presenter; the backtick style in the new description matches the existing
  exclusion-patterns row, so it is consistent, not a one-off.
- **The boot-window decision is made, reasoned and pinned.** The `DECIDED` block
  on `ObsidianLinkProvider.outgoingReferencesOf`
  (`src/adapters/ObsidianLinkProvider.ts:280-296`) states both options and why
  "one node too many for a moment" beats "a whole neighbourhood missing", and the
  existing test is relabelled as the tripwire against silently switching to `[]`.
  This is the right call and the right way to record it.
- **Release note delivered.** `RELEASE_CHECKLIST.md` §7 gains two items: the
  global depth reset (D2's required mitigation — announced, not silent) and the
  new "Embeds out" row, including both consequences (attachments unaffected;
  independent budgets above one hop).

## Documentation Updates Needed

- `docs-internal/plan/high-level-plan.md:62` — remove the false "asserted in
  tests" claim (SHOULD-FIX 3).
- `IMPLEMENTATION_STAGE3__PUBLIC.md:52-57` + the ticket's STAGE 3 LANDED note —
  fix the fixture-churn file count so the table reconciles to 25 (SHOULD-FIX 1).
- Optional: one line somewhere durable noting that node *sizing* remains
  kind-blind (NIT 3).

No `CLAUDE.md` change is needed: the ONE-pipeline / ONE-row-model / ONE-tripwire
conventions were followed as written, and this change is evidence they work.
