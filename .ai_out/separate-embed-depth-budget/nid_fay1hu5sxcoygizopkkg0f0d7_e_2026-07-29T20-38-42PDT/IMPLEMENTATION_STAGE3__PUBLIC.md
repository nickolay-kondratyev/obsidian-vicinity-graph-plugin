# Stage 3 — the outgoing-embed channel + its depth budget (DONE)

Ticket: `_tickets/separate-depth-budget-for-embedded-outgoing-links.md`
(`nid_fay1hu5sxcoygizopkkg0f0d7_e`). Branch: `nid_fay1hu5sxcoygizopkkg0f0d7_e_2026-07-29T20-38-42PDT`.

**Status: `npm test` 1212 passed / 91 files (was 1199). `npm run check` (src + e2e) clean.
Tree clean. Six commits on the current branch, `8a25a98` … `4860a6b`.**

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

### The number

**25 files, +91 / −43 lines. ~14 lines of actual code; the rest is doc comments and
mechanical fixture churn.**

| Slice | Files | What |
|---|---|---|
| **Production, COMPILE-FORCED** | 4 | `SettingsSpec.ts` (spec completeness guard), `constants.ts` (`EngineDefaults` return type), `persistedShapes.ts` (`definedFieldsOnly<DepthSettings>`), `settingsSectionFields.ts` (section completeness guard) |
| **Production, source of truth** | 1 | `types.ts` — the `DepthSettings` field itself |
| **Production, HAND-MAINTAINED (silent if missed)** | 1 | `settingsRows.ts` — the row declaration. Nothing ties a spec field to a declared row. |
| **Test tables, hand-maintained BY DESIGN (loud)** | 2 | the literal defaults tripwire, the bounds-enforcer classification |
| **Fixture churn** | 13 (9 unit + 4 e2e) | full `DepthSettings` object literals. Every one a compile error. |

**Zero structural settings suites needed an edit.** Persistence round-trip / absent /
garbage / sibling-preservation, reset plans, bounds enforcement and tab⇄panel parity
all picked the new leaf up by walking `SETTINGS_SPEC`. I verified this is not a
vacuous claim: deleting the one parse line reddens
`settingsSpecPersistence.test.ts` with 2 failures naming the field.

### Against the baseline (~180 lines / ~15 files / ~8 hand-maintained SILENT lists)

- **Hand-maintained lists that fail SILENTLY: 8 → 1.** That is the headline. The one
  survivor is "declare the row", which is irreducible-ish (it *is* the act of saying
  the setting exists) but is genuinely unguarded: a spec field with no row ships as a
  setting you can only reach by hand-editing `data.json`. Cheap follow-up if anyone
  wants it: a test that every `DepthSettings`/`ViewSettings` leaf has a declared row.
- **Files you must touch to make the field WORK: ~15 → 6**, and 4 of those 6 are the
  compiler telling you, by name, in one `tsc` run. I did it by adding the field and
  reading the error list; there was nothing to *remember*.
- **Lines: ~180 → ~91 added**, and 13 of the 25 files are fixture churn the descriptor
  model neither causes nor prevents (that is "a required interface field grew"), all
  of it compile-forced.

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
