# IMPLEMENTATION_REVIEW — PHASE 2 (docs / e2e / release note) — nid_ez38gf1mrdgh5kxedzrdicwzl_e

**Verdict: APPROVE — ticket READY (0 BLOCKING, 2 SHOULD-FIX, 2 NIT).**
Both SHOULD-FIX items are outside the shipped behaviour (one stale open-ticket pointer, one
user-facing-copy question that belongs to the already-escalated owner decision). Nothing found
that would justify holding the ticket.

## Gates I ran myself (not trusted from the implementer)

| gate | result | log |
|---|---|---|
| `npm test` | **exit 0** — 82 files / **1083** tests passed | `.tmp/rev2-test.log` |
| `npm run check` | **exit 0** — both `src/` and `e2e/` projects | `.tmp/rev2-check.log` |
| `npm run test:e2e` | **NOT run** (needs real Obsidian; release gate). Reviewed statically — see §3. | — |

PHASE 1 **B1 is fixed**: `e2e/settingsResetVerify.e2e.ts` no longer hard-codes the reset copy;
`e2e/settingsBaseline.ts:87` derives `ALL_SETTINGS_RESET_DESCRIPTION` from
`settingsResetPlan.ts:73` (commit `6c6c7f9`). The e2e red gate I flagged is gone, and the fix is
better than the one I asked for (derived, not re-typed).

## 1. Do the docs match the code? — YES

Residue grep over `src/ e2e/ docs-internal/ README.md CLAUDE.md` for `doc-data`, `DocData`,
`centralDepth`, `per-doc`, `per-note`, `perDoc`, `settingsWriteScope`, `OwningViewPort`,
`resolvePinnedDescriptors`, `ViewSettingsResolver`, `TraversalSettingsResolver`,
`NOT_PERSISTABLE`: **every surviving hit is either a deliberate WHY-NOT, a
"kept as shipped" history note, or a superseded-banner clause.** No sentence anywhere still
*describes current behaviour* as per-doc. Specifically verified:

- **No dangling file references.** Scanned every `src/…`/`e2e/…` path mentioned in `README.md`,
  `CLAUDE.md`, `docs-internal/architecture-map.md`, `high-level-plan.md`, `notes/settings.md`
  and all of `docs-internal/tickets/*.md` against the tree — the only miss is the deliberate one
  in the ticket being closed (`ticket-per-doc-write-leaves-sibling-views-stale.md`, naming the
  file it records as deleted). Exception: see SHOULD-FIX **S1**.
- **README §Settings model** — "every setting is global … two surfaces edit the same values …
  refreshes every open graph" is true: `VicinityGraphSettingTab.ts:850,867` → `refreshOpenViews()`,
  and `ControlsActions.ts:72` → `viewsRefresh.refreshAllViews()` unconditionally
  (`main.ts:44` implements it over the same leaf walk). No narrower reach exists.
- **README Depth bullet** — "one pair … applies to the active note *and* every pinned central"
  matches `GlobalDepthControls.tsx:32-33` + `VicinityEngine`'s single `globalDepths` for
  `[main, ...pinned]`. Default outgoing depth is `1` (`SettingsSpec.ts:162`), which the new e2e
  relies on.
- **README restart caveat** — re-verified against code, still real, and the removed clause
  ("missing from the toolbar list") was correctly dropped: `GraphToolbar.tsx` has no pinned
  disclosure at all now.
- **README §Pinning** — "pins are keyed by a stable note id" matches the docid-keyed pin set;
  `centralDepths` "subtle bit" correctly deleted.
- **architecture-map** — `data.json` as sole store, `OrphanSweeper` pruning **pins only**
  (`SweepPlanner.ts:25` filters `pinnedDocids`), and refresh reach as ONE `ViewsRefreshPort`
  (`viewPorts.ts:57`) all check out. The second stale claim (`OwningViewPort`) was beyond the
  ticket's brief and was right to fix.
- **CLAUDE.md** persistence bullet is now correct and still succinct.
- **high-level-plan** — Goal 3, traversal bullet, truncation-chain tail, §Pinning and settings,
  §Persistence, Phase 1/3/6 summaries and the V2 line all match the tree. The per-root-BFS
  survival caveat ("a pinned node keeps its own reach even when disconnected") is accurate.
- **Step banners** (`step-03`, `step-06`) name exactly which clauses die and what survives, and
  keep the documents as shipped-history. Correct treatment — no history was rewritten.

## 2. `docs-internal/notes/settings.md` restatement — the implementer's claim is TRUE

I verified the guard names in the tree rather than trusting the write-up:

- `satisfies Record<keyof ViewSettings, …>` — **does not exist anywhere in `src/`** (grep clean).
  The implementer was right to refuse the brief's wording; writing it would have created exactly
  the drift this file exists to kill.
- The guards it *does* name all exist, at the cited sites:
  `ParsedViewFields` mapped type — `src/persistence/persistedShapes.ts:135` (used at `:143`);
  `Exclude<keyof ViewSettings, keyof ViewSpec>` etc. — `src/engine/SettingsSpec.ts:115-117` and
  the orphan direction at `:124-126`; `Exclude<keyof ViewSettings, SectionedField<"view">>` —
  `src/view/settingsSectionFields.ts:69-71`; runtime companion documented at
  `persistedShapes.test.ts:246`.
- `settings.md:80-90` names `ViewSettingsResolver.resolve()` **only** inside "the bar *used to*
  name … That class is deleted" — honest history, not a live claim. The "not a hole" parenthetical
  at `:35-37` no longer names it. Both correct.
- **"Absent field = inherit the spec default" survives, correctly re-scoped** (`:163-170`): it now
  governs the read path (missing key parses `undefined`, merged over
  `PersistedShapes.defaultPluginData()`), and keeps the real constraint —
  "absent ≠ present-but-default must stay distinguishable at parse time".
- **Downstream bar is unambiguous**: "Read the bar as: do not weaken THOSE" + "Tickets 4/5/6
  inherit this reworded bar, not either earlier wording." Steps 4/5/6 now have one bar, named by
  file. Good.

## 3. e2e honesty — the two new specs are locator-accurate and CANNOT pass vacuously

`e2e/pinnedCentralScenario.e2e.ts` (read against `src/view/`):

- Every locator exists: `.vicinity-graph-depth-controls` (`GlobalDepthControls.tsx:31`),
  `.vicinity-graph-stepper` / `__value` and `aria-label="Increase outgoing depth"`
  (`DepthStepper.tsx:25,37,43` — the label is built from `label.toLowerCase()`, so "Outgoing" →
  exactly that string). `filter({ hasText: "Outgoing" })` cannot also match "Incoming".
- The Depth disclosure is `defaultOpen` (`GraphToolbar.tsx:37`), so `openToolbar()` is sufficient
  to reach the stepper — the one runtime assumption the implementer flagged is structurally sound,
  and it is the same pattern `controlsRestart.e2e.ts` already runs green.
- **Test 2 is non-vacuous**: it inherits `sc_x` pinned from test 1, so the `data-tier=regular`
  assertion at `:148` is a real unpin proof, and `sc_x1` is genuinely present-then-absent before
  the bump. Fixture chain `sc_hub → sc_x → sc_x1 → sc_x2 → sc_x3` puts `sc_x1` two hops out, so
  it must be absent at depth 1 and present at 2.
- **Test 3's key claim checks out**: `sc_x2` is 3 hops from `sc_hub` and 2 from `sc_x`, so at
  global depth 2 **`sc_x` is the only root that reaches it** — no other root, no incoming path
  (nothing links into `sc_x2` except `sc_x1`). The assertion can fail, and it fails for the right
  reason. The `:164` pre-assertion (`count 0`) closes the vacuity loophole.
- Serial ordering + explicit GIVEN verification is the right call for this file; a broken
  inherited assumption fails at the GIVEN, not silently.

`e2e/controlsRestart.e2e.ts` — **confirmed genuinely global-only**: it now mutates the one depth
section, a pin, a sizing weight and the node cap, restarts real Obsidian, and re-reads all four
from `data.json`. The deleted tail (`pinnedDisclosure()` `toBeAttached()`) lost **no** coverage:
the disclosure it asserted no longer exists, and the pin's restart survival is still proven by the
`data-tier="pinned-central"` `toPass` block above it.

**Deletions cost nothing and one of them strictly improved coverage.** Removing the
`hasNotText: PINNED_CENTRALS_SUMMARY_PATTERN` filter makes the panel exhaustiveness pin
*unfiltered and fixture-independent* — strictly stronger than before. The deleted absence test
guarded a `pinned.length > 0` guard that no longer exists in `GraphToolbar.tsx`; it was vacuous
forever, not merely passing. Absence assertions remain plentiful elsewhere, so
`selectorGuard.test.ts`'s `ABSENCE_ASSERTION_PATTERN` is not left dead.

**No dangling doc-data harness code or comments remain** — `obsidianHarness.ts` dropped the
`DOC_DATA_DIR_NAME` runtime import and the second `rmSync`, and its WHY comment now correctly
explains that wiping `data.json` alone is sufficient *because pins live there*. That is the right
justification, not a hand-wave. `vaultTarget.ts` scrub is comment-only and the destructive-call
source scan in `vaultTarget.test.ts` is un-weakened (still green).

## 4. Release note / checklist — the break is stated, never silent

`RELEASE_CHECKLIST.md` §7 states both required things and states them plainly: (a) stored per-note
overrides are **discarded**, `doc-data/` is no longer read or written, and **pins + globals are
kept**; (b) the **UX shift** — the panel's depth steppers now write a GLOBAL setting affecting
every note and every open view, and one pair drives MAIN + every pinned central. §8 renumbering
is clean (the surviving "see §6" cross-reference is unaffected). This satisfies CLAUDE.md's
"never break stored data *silently*".

The re-scoped **step-06 smoke-run gate is still a meaningful human gate**: items 1, 2, 3, 5, 6, 7
all remain real human work (restart round-trip, native pin feel on both surfaces incl. MAIN,
~300px overflow + the new depth indent, the §10 scenario, tab→open-view refresh), and item 4 was
turned into the *sharpest* item in the file — it asks the human to judge precisely the UX risk this
ticket introduced. Correcting the pre-existing "MAIN offers neither" error was right (the e2e
asserts MAIN *does* offer the pin gesture).

## 5. The CSS change — justification holds

`src/view/graph-view.css:499-514`. Both halves of the stated reason are verifiable in the tree:
the deleted `background: var(--background-primary)` sat on a child of
`.vicinity-graph-disclosure`, which already paints that same variable (so the "card" was
invisible), and the deleted `padding: var(--size-4-2)` stacked on the disclosure body's own
padding, insetting the two depth rows deeper than every sibling section's rows (e.g.
`.vicinity-graph-sizing__metrics` has no such wrapper). That is an altitude mismatch, not a
grouping cue — this is the right call and it did not need real-Obsidian eyes to decide. Keeping
the tighter `--size-4-1` gap with a WHY is correct: two steppers *are* one control.

The rest of the block is dead-rule removal that could not regress anything, because the
attributes selecting it are gone from the DOM: `[data-pinned]`, `[data-disabled]`,
`.vicinity-graph-stepper__reset`, `.vicinity-graph-central*`. One visible change is deliberate and
right: `__value` is now unconditionally `--text-normal` (previously muted unless pinned) — with no
inherited/pinned distinction, muting every value would have been a lie. No test asserted any
removed property, and the smoke-run gate now lists the indent to eyeball (item 5). Nothing visual
regressed that no test covers, beyond that eyeball item.

## 6. Ticket bookkeeping — all three verdicts sanity-checked, all three correct

1. **`ticket-per-doc-write-leaves-sibling-views-stale.md` → CLOSE.** Verified: `settingsWriteScope.ts`
   is gone from the tree and `ControlsActions.ts:72` calls `refreshAllViews()` with no branch. The
   defect is gone by construction, i.e. option (a). Correct.
2. **`nid_7fq9y51mbucmduzf9z31hmwmq_e` (doc-data dir constant) → CLOSE as obsolete.** Verified:
   `src/persistence/docDataDirName.ts` is gone and the harness no longer imports it. Correct.
   (Its interim drift guard `e2e/vaultCopyReseed.test.ts` does not exist on `main` either, so
   nothing was silently dropped here.)
3. **`ticket-pinned-central-status-lags-after-restart.md` → KEEP OPEN. Re-verified independently and
   I agree.** Every link in the root-cause chain is untouched: `PathDocIdMap` is in-memory only and
   warmed for neighbour docids by `OrphanSweeper.ts:54` alone (plus `VicinityGraphBuilder.ts:42`
   for MAIN and `PersistenceServices.ts:48` on pin); `SWEEP_DELAY_MS = 15_000`
   (`OrphanSweeper.ts:8`); `GraphRequestAssembler.ts:32,56` still skips an unresolvable pin. **Still
   reproducible.** The two in-place corrections (no per-doc depth settings; the lag now shows purely
   as node styling) are both accurate.
4. `ticket-step-06-controls-human-smoke-run.md` — correctly left OPEN as a release gate, re-scoped.

## Findings, ranked

### BLOCKING — none

### SHOULD-FIX

**S1 — `docs-internal/tickets/ticket-controls-optimistic-input-latency.md:10` points at a deleted
file.** It reads `` (`src/view/DepthStepper.tsx` / `CentralDepthControls.tsx`) `` and describes
"each `+`/`−` waits a full write→rebuild". `CentralDepthControls.tsx` no longer exists. This is an
OPEN ticket (queued behind pipeline step 3), so the pointer will be read by whoever picks it up.
It escaped my automated scan only because the second name is written without its `src/view/`
prefix.
*Fix:* drop the second name, leaving `` (`src/view/DepthStepper.tsx`, rendered by
`GlobalDepthControls.tsx`) ``, and note the latency now concerns the ONE global stepper pair — the
bound is still `MAX_STEPPER_DEPTH = 5`, so the ticket's substance is unchanged.

**S2 — the settings tab still heads its depth card "Depth defaults"
(`src/view/VicinityGraphSettingTab.ts:461`), which now implies an override layer that no longer
exists.** This is the *same* POLS gap as the escalated `#QUESTION_FOR_HUMAN` about the panel
summary ("Depth" → "Depth (all notes)"), on the other surface. It is user-facing copy, it drags
`e2e/settingsBaseline.ts`'s anchored section-name/reset-name literals, and the section reset
description already says the honest thing ("Resets the outgoing and incoming depth used for every
central note", `settingsResetPlan.ts:131`).
*Fix:* do not decide it separately — fold it into the open owner question so both surfaces get one
coherent answer (or one "leave it"). The implementer was right not to invent the copy.

### NIT

**N1 — `README.md:80-82`**: the Sizing bullet lost its line wrapping in the edit (one ~200-char
line where the rest of the file wraps at ~80). Cosmetic; rewrap on the next touch.

**N2 — sequencing between the open question and the gate**: smoke-run item 4 asks the human to
*judge* the global-depth UX risk, and the `#QUESTION_FOR_HUMAN` asks them to *decide the copy*.
Worth stating explicitly in the question that the gate is its natural input — answer it after the
smoke run, not before — so the owner is not asked the same thing twice from two directions.

## Documentation updates needed

None beyond S1. `docs-internal/notes/settings.md`, `high-level-plan.md`, `architecture-map.md`,
`README.md`, `CLAUDE.md` and `RELEASE_CHECKLIST.md` are all consistent with the tree as of
`375ad33`. The three-places-must-stay-in-sync callout (README §Settings model / checklist §7 /
smoke-run item 4) is the correct thing to have flagged, and it becomes live the moment S2 is
answered.

## Readiness verdict for the whole ticket

**READY.** PHASE 1 + ITERATION_PHASE_1 (code) I approved previously and the one BLOCKING item from
that round is fixed and verified. PHASE 2 (docs / e2e / release note) is accurate against the tree
on every substantive claim I could check, and I could check nearly all of them. The honest residual
risk is unchanged and correctly disclosed by the implementer: **`npm run test:e2e` has not been
run.** The two new specs are the highest-risk deliverable; I found no reason they should fail and
two reasons to trust them (locators verified against source; both assertions provably non-vacuous
from the fixture), but a real-Obsidian run is still the release gate. One owner decision is
outstanding (the Depth copy, now covering both surfaces per S2) and it does not block merge.
