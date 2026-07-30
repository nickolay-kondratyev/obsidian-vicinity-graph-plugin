# Stage 3 — the outgoing-embed channel + its depth budget (DONE)

Ticket: `_tickets/separate-depth-budget-for-embedded-outgoing-links.md`
(`nid_fay1hu5sxcoygizopkkg0f0d7_e`). Branch: `nid_fay1hu5sxcoygizopkkg0f0d7_e_2026-07-29T20-38-42PDT`.

**Status after ITERATION 1 (see bottom): `npm test` 1213 passed / 91 files (was 1199).
`npm run check` (src + e2e) clean. Tree clean. Seven commits on the current branch,
`8a25a98` … the iteration commit.**

---

## READ THIS FIRST — the ticket's D1 rationale is WRONG, and I pinned the truth

The ticket says the kind-pure mixed-chain gap *"only appears once a user deliberately
diverges the budgets"*. **It does not.** A chain needs TWO hops to change kind, so the
gap appears at **any budget above one hop — equal budgets included**. With both
outgoing budgets at 2, the graph is strictly **smaller** than the old kind-blind
depth-2 walk.

What actually holds is a **one-hop property**, and it is exactly the acceptance
evidence the brief asked for: at the shipped defaults (`linkDepthOut ===
embedDepthOut === 1`) the two outgoing channels union to *exactly* the old kind-blind
outgoing BFS — same nodes, same edges. **Zero observable change at ship.**

I found this because the equivalence test I wrote at budget 2 FAILED. I did not
weaken it; I split it into two honest suites (`VicinityTraversal.test.ts`):

- `channel split at the shipped defaults` — equivalence, asserted against
  `EngineDefaults.depthSettings()` rather than a literal, so it tracks the spec.
- `kind-changing chains (the cost of kind-pure channels)` — the gap at budget 2,
  plus its control case (a single-kind chain still walks two hops).

No decision is needed to proceed: this is inherent to 6a, which is settled, and 6b is
rejected on the "expand once, shallowest first" invariant. But the OWNER SHOULD KNOW,
because it changes what the feature costs a user who turns depth up. The spec comment,
`high-level-plan.md`, `README.md`, the release note and the ticket note now all state
the true property instead of the ticket's version.

---

## MEASUREMENT

The mandate: what does ONE new settings field cost under the declarative descriptor
model? I isolated `embedDepthOut` in its own commit (`21b3152`) so the number is not
contaminated by the rename or the traversal work.

### Counting method (stated so the table can be re-derived)

Source: `git show 21b3152 --stat` — the commit that adds `embedDepthOut` and nothing
else. **A file** = one path in that `--stat` (25 paths). **Production** = any path
that is not `*.test.*`, not under `e2e/`, not under `testFixtures/` (6 paths).
**Real code** = added lines that are not comments and not object-literal fixture
entries. **Fixture churn** = a file whose ONLY change is widening a `DepthSettings`
object literal to carry the new required key — churn the descriptor model neither
causes nor prevents, and every instance a `tsc` error rather than a silent gap.

### The number

**25 files, +91 / −43 lines. ~14 lines of actual code; the rest is doc comments and
mechanical fixture churn.**

| Slice | Files | What |
|---|---|---|
| **Production, COMPILE-FORCED** | 4 | `SettingsSpec.ts` (spec completeness guard), `constants.ts` (`EngineDefaults` return type), `persistedShapes.ts` (`definedFieldsOnly<DepthSettings>`), `settingsSectionFields.ts` (section completeness guard) |
| **Production, source of truth** | 1 | `types.ts` — the `DepthSettings` field itself |
| **Production, HAND-MAINTAINED (silent if missed)** | 1 | `settingsRows.ts` — the row declaration. Nothing ties a spec field to a declared row. |
| **Test tables, hand-maintained BY DESIGN (loud)** | 2 | the literal defaults tripwire, the bounds-enforcer classification |
| **Fixture churn** | **17** (13 unit + 4 e2e) | full `DepthSettings` object literals. Every one a compile error. |
| **TOTAL** | **25** | reconciles with `--stat` |

The ~14 real-code lines, itemised so the number is checkable: `types.ts` 1,
`SettingsSpec.ts` 2, `constants.ts` 1, `persistedShapes.ts` 1,
`settingsSectionFields.ts` 1, `settingsRows.ts` 6 (the row object), plus 2 test-table
lines = **14**. The other ~77 added lines are doc comments and fixture literals.

**Zero SPEC-WALKING settings suites needed an edit.** The suites that derive their
cases from `SETTINGS_SPEC` — persistence round-trip / absent / garbage /
sibling-preservation (`settingsSpecPersistence.test.ts`), reset plans, bounds
enforcement, tab⇄panel parity — all picked the new leaf up for free. I verified this
is not a vacuous claim: deleting the one parse line reddens
`settingsSpecPersistence.test.ts` with 2 failures naming the field.

*Precision the reviewer was right to ask for:* this claim covers SPEC-WALKING suites,
not RULE suites with hand-written fixtures. `persistedShapes.test.ts` is the latter
and took two fixture edits — counted above under fixture churn, not hidden.

### Against the baseline (~180 lines / ~15 files / ~8 hand-maintained SILENT lists)

- **Hand-maintained lists that fail SILENTLY: 8 → 1.** That is the headline. The one
  survivor is "declare the row", which is irreducible-ish (it *is* the act of saying
  the setting exists) but is genuinely unguarded: a spec field with no row ships as a
  setting you can only reach by hand-editing `data.json`. **Now filed as
  `nid_xy56b20jbvaedbl0610m3j2ls_e`** — a ~10-line test that every settings spec leaf
  has a declared row, which would take the silent count 1 → 0.
- **Files you must touch to make the field WORK: ~15 → 6**, and 4 of those 6 are the
  compiler telling you, by name, in one `tsc` run. I did it by adding the field and
  reading the error list; there was nothing to *remember*.
- **Lines: ~180 → ~91 added**, and **17 of the 25** files are fixture churn the
  descriptor model neither causes nor prevents (that is "a required interface field
  grew"), all of it compile-forced.

### The honesty caveats — both material

1. **A large part of the drop is NOT the descriptor model.** The per-doc settings
   layer was removed by a SEPARATE ticket (`nid_ez38gf1mrdgh5kxedzrdicwzl_e`): no
   per-doc parse branch, no per-central stepper (the research's "2 → 4 controls" line
   is void), no cascade resolver, no reset-to-global control. On the old per-doc
   codebase this same field would have cost several more files no matter how good the
   descriptors were. Attribute maybe half the delta there.
2. **The remaining silent step is the one that matters most.** A missing row is the
   only failure mode that ships a setting nobody can see, and it is still silent.

### Verdict

**The descriptor model delivered.** The mandate says a disappointing number is the most
valuable signal; this one is not disappointing, and I would not recommend revisiting
`nid_wimjq4ewgbg21n4zx9d4qq3a0_e`. What I *would* recommend is the row-completeness
guard above — it closes the last silent gap for ~10 lines.

---

## What I built, commit by commit

1. **`8a25a98` — rename only.** `outgoingDepth → linkDepthOut`, `incomingDepth →
   linkDepthIn` (TS + persisted JSON), labels **Links out** / **Links in**. Clean
   break, no shim, **no `PERSISTED_SHAPE_VERSION` bump** (unknown keys already fall
   back; a bump would widen the reset to every global). Zero behavior change.
2. **`4f29883` — `Direction` → `Channel`.** Still two members
   (`outgoing-link | incoming`). `DIRECTION_DEPTH_FIELD → CHANNEL_DEPTH_FIELD`,
   `DepthTag.direction → .channel`. The traversal's private `DIRECTIONS` array moved
   to `types.ts` as `CHANNELS` with `_assertEveryChannelListed` — **a channel the BFS
   loop forgets to walk is now a compile error**, not a silently unspent budget. Zero
   behavior change.
3. **`f4257e5` — a depth row names its FIELD, not a channel.** `SettingsRowControl`'s
   `depth` arm and the `global-depth` interaction now carry `field: keyof
   DepthSettings`. The view stops importing traversal vocabulary, and
   `CHANNEL_DEPTH_FIELD` is read in exactly one place (the BFS). This is also what let
   commit 4 add a settings field with no channel — i.e. what made the measurement
   possible. Zero behavior change.
4. **`21b3152` — THE MEASURED COMMIT.** `embedDepthOut` and nothing else. For one
   commit the row writes a value the engine ignores.
5. **`54eacf5` — the `outgoing-embed` channel.** Three BFS runs per root, unioned,
   kind-pure. `OutgoingReferences.targetsOfKind` is the one new seam; `neighborsOf` is
   an exhaustive switch; the depth limit is a `CHANNEL_DEPTH_FIELD` lookup instead of a
   ternary; `CHANNEL_LINKER` (a `Record<Channel, …>`) normalises edge orientation so a
   future incoming-side channel is a compile error rather than a back-to-front edge.
6. **`4860a6b` — docs.** `high-level-plan.md` (channel table, kind-purity + its cost,
   D5), `README.md` Depth section, `RELEASE_CHECKLIST.md` §7 release note, e2e locator
   renames, `docs-internal/notes/settings.md` LANDED marker.

## Tests added (13 new, all BDD, one behavior each)

- `outgoing-embed channel` (5): embeds walk on their own budget; `embedDepthOut: 0`
  suppresses them however deep `linkDepthOut` is; edges still point linker → linked;
  the depth tag names the channel; a both-embedded-and-linked target is ONE node
  reachable on either channel alone.
- `channel split at the shipped defaults` (3) — the acceptance proof, read from the spec.
- `kind-changing chains` (2) — the gap and its control case.
- `embedded attachments (D5)` (3) — an embedded image is still not a node, both an
  embedded and a plainly-linked image are attachments, and an embedded attachment
  survives `embedDepthOut: 0`. **No production code was written for D5**, exactly as
  the brief required.

**No behavior-capturing test was weakened or deleted.** Changed tests, all disclosed:
depth-key literals in ~18 fixture files (the rename + the new required field);
`depthTags` expectations now say `channel: "outgoing-link"`; two `settingsWritePlan`
test titles renamed to describe the field rather than the channel. The two
`Partial<DepthSettings>` test helpers mirror an unstated embed budget onto the link
budget — the shipped default relationship — so every pre-existing fixture keeps its
meaning rather than silently gaining a 0 or a 1.

## Decisions I made (Stage-1 acceptance items)

- **Uncached-markdown boot window: ACCEPT the degradation.** A markdown file not yet in
  `getFileCache` still reports every reference as `kind: "link"`, so with
  `embedDepthOut: 0` an embedded note from such a source still appears for a moment.
  The alternative (return `[]`) would make that source's WHOLE neighbourhood vanish for
  the same window. Rendering one node too many looks like "the setting hasn't applied
  yet"; rendering a graph too few looks like a broken plugin. The next `metadataCache`
  event rebuilds either way. Reasoned in a `DECIDED` block on
  `ObsidianLinkProvider.outgoingReferencesOf`, and its existing test is now labelled as
  the tripwire against silently switching to `[]`.
- **`getLinkCount` stays kind-blind.** Stage 1 deviated here with reason; Stage 3 still
  does not need counts (the traversal never asks). Handed to the Stage 2 ticket.
- **No `DEFAULT_EMBED_DEPTH_OUT` alias.** `DEFAULT_LINK_DEPTH_OUT`/`_IN` are read only
  by their own test — adding a third unused export to match two unused exports is worse
  than the asymmetry. Filed as `nid_6kjmn2y8jc8a9gxynudusbmlk_e`.

## Deviations from the brief

1. **The settings row carries `field: keyof DepthSettings`, not `channel: Channel`**
   (commit 3). The brief implied the channel would thread into the presenters. Better
   layering (the view stops importing BFS vocabulary), and it is what let the new field
   be measured in isolation. Same rows, same labels, same writes.
2. **`CHANNELS` lives in `types.ts`, not as a local array in `VicinityTraversal`.** The
   brief named `DIRECTIONS` in the traversal; leaving it there would have left "the BFS
   walks every channel" unguarded with three members. Guarded now.
3. **The D1 equivalence claim was narrowed to one hop** — see the top of this file.

## Follow-ups filed

- `nid_2qygmn0z59t8fdlb5e9pap49m_e` — **Stage 2** (D3): render embed edges distinctly.
  Depends on this ticket. Body states the real work: nothing downstream of the
  traversal carries the kind, and a pair can be BOTH, so the edge kind is a summary
  (`link | embed | both`), not a scalar.
- `nid_6kjmn2y8jc8a9gxynudusbmlk_e` — the unused `DEFAULT_LINK_DEPTH_*` exports.

## Known gaps a reviewer should weigh

- **No e2e spec drives the new "Embeds out" stepper specifically.** The e2e suite
  covers the depth section generically (section reset, `saveGlobalDepths` now carrying
  three keys, the Links out / Links in steppers), and `npm test` renders no React by
  design, so the new row's *rendering* is covered only by the source-scan parity test.
  `npm run test:e2e` needs a real Obsidian and was not run here (release gate).
- **A spec field with no declared row is still silent.** See MEASUREMENT.

## COST

`git diff --shortstat e387f5a HEAD` (branch point, includes Stage 1): **74 files,
+2875 / −557**. Stage 3 alone (`8a25a98..HEAD`): the six commits above; the
per-commit split is in MEASUREMENT — the new FIELD is 25 files / +91 −43, the rename
is 29 files / +132 −132, the channel work is small and concentrated in
`VicinityTraversal.ts` + `types.ts`.

---

# ITERATION 1 — reviewer feedback (0 BLOCKING, 5 SHOULD-FIX, 4 NITs)

`npm test` **1213 passed / 91 files** (was 1212 — one new test), `npm run check`
clean, tree clean. All work on the current branch; the ticket stays `status: open`
for the orchestrator to close.

## SHOULD-FIX

**1. MEASUREMENT arithmetic — INCORPORATED, and recounted from the diff, not patched.**
The reviewer was right and both my numbers were wrong (the table said 13, the commit
message said 18). Recount: **17 fixture-churn files (13 unit + 4 e2e)**, so the table
now sums to its own headline of **25**. I also added an explicit **counting method**
paragraph (what counts as a file / production / real code / fixture churn) and
itemised the ~14 real-code lines so a reader can re-derive them without trusting me.
**The headline is unchanged and honest: 25 files, +91 / −43, ~14 lines of real code,
silent hand-maintained steps 8 → 1.** Only the internal breakdown was defective —
which is exactly the kind of defect that discredits a measurement, so it deserved to
be the top item. The correction is recorded on the ticket too (I cannot rewrite the
`21b3152` commit message without rewriting history on a reviewed branch, so the
ticket note names the wrong figure explicitly and supersedes it).

**2. The acceptance equivalence test could not fail — INCORPORATED, and I verified
the fix EMPIRICALLY.** The reviewer's diagnosis was exact: the fixture had no two-hop
chain, so `asAuthored()` and `kindBlind()` agreed at any budget. Fixed by giving the
fixture a **kind-changing second hop** (`a ![[b]]` then `b [[d]]`), plus a new test —
*"WHEN the SAME vault is walked two hops THEN the two providers DIVERGE"* — which is
the tripwire's own tripwire: it fails if a future fixture edit defangs the suite.
Verified by temporarily setting both shipped outgoing defaults to 2: the suite now
goes **RED with 2 failures**; before this change it stayed green. A test that cannot
fail is worse than no test, and this one now genuinely pins "the equality holds at
whatever the spec currently ships".

**3. `high-level-plan.md:62` claimed a deleted test — INCORPORATED.** The line now
says the `Reference.original[0] === "!"` cross-check is **not asserted anywhere** (the
suite was deleted as circular in `eab9bd2`), that array provenance is therefore an
UNGUARDED assumption, and names the real-Obsidian measurement ticket that tracks it
(`nid_t0x7ap99djfuzvz5p261ao7rn_e`). A doc promising a guard that does not exist is
worse than silence — the reviewer's framing, and correct.

**4. Row-completeness guard not filed — INCORPORATED.** Filed as
**`nid_xy56b20jbvaedbl0610m3j2ls_e`** (tags `settings, settings-cleanup, testing`,
linked to this ticket): the measured finding, the one-directional nature of the hole,
the ~10-line shape, and an acceptance criterion that is itself a tripwire ("delete the
Embeds out row → `npm test` must fail naming `globalDepths.embedDepthOut`").

**5. Close the ticket — REJECTED (deferred by instruction, not by disagreement).**
The orchestrator closes it and writes the single `change_log` entry for the whole
flow. Left `status: open` deliberately; this is the "note explicitly that the
orchestrator closes it" branch the reviewer offered.

## NITs

**NIT 1 ("zero structural suites" loosely worded) — INCORPORATED** (one clause):
the claim now says **SPEC-WALKING** suites and states outright that
`persistedShapes.test.ts` is a *rule* suite with hand-written fixtures and did take
two edits, counted under fixture churn.

**NIT 2 (round-trip literal lost discriminating power) — INCORPORATED**, and slightly
further than asked: `persistedShapes.test.ts:25` now reads
`{ linkDepthOut: 3, embedDepthOut: 4, linkDepthIn: 2 }` — **every** value non-default,
with a comment saying why, so "parsed" can never be mistaken for "fell back to the
default" for any of the three fields.

**NIT 3 (node sizing stays kind-blind) — INCORPORATED as a note on the Stage 2
ticket**, not as a doc edit here. It is the same "downstream is kind-blind" question
that ticket already has to settle for `getLinkCount`; splitting it across two
documents would duplicate the knowledge (DRY). Recorded on
`nid_2qygmn0z59t8fdlb5e9pap49m_e`.

**NIT 4 (no e2e for the Embeds out stepper) — REJECTED as out of scope.** Already
disclosed under "Known gaps"; `npm test` renders no React by design and the general
fix is the repo's known limit, tracked by `nid_7qot0m6nuxxmd5z0yb9jylsd6_e`. Adding a
one-off e2e for this single row would be gold-plating a release-gate suite that was
not run here anyway.

## Tickets filed this iteration

- **`nid_xy56b20jbvaedbl0610m3j2ls_e`** — every settings spec leaf must have a
  declared row (SHOULD-FIX 4; closes the last silent step).
- **`nid_2qygmn0z59t8fdlb5e9pap49m_e`** — Stage 2 visual embed distinction. **Already
  filed during Stage 3** (owner decision D3, deps on this ticket, CSS-only dashed /
  weighted stroke on `vicinity-graph-edge`), so this iteration extended it with the
  NIT-3 sizing note rather than creating a duplicate. **Push-back on the tagging ask:**
  it is tagged `graph, ui` and I deliberately did NOT add `settings-cleanup`. It is a
  graph-rendering ticket with no settings surface; tagging it into the settings-cleanup
  loop would mis-route it to an agent expecting settings work. It is already reachable
  the correct way — as an open `deps` edge on this ticket.
