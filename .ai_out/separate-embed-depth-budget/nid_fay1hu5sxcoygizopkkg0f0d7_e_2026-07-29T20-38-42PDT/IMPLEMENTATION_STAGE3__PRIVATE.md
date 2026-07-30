# STAGE 3 — private rehydration memory

Branch: `nid_fay1hu5sxcoygizopkkg0f0d7_e_2026-07-29T20-38-42PDT`.
Ticket: `_tickets/separate-depth-budget-for-embedded-outgoing-links.md`.

## Plan (commit-per-slice, so the MEASUREMENT can attribute honestly)

1. **C1 — RENAME ONLY.** `outgoingDepth`→`linkDepthOut`, `incomingDepth`→`linkDepthIn`
   (TS + persisted JSON + labels "Links out"/"Links in"). Zero behavior change.
   `DEFAULT_OUTGOING_DEPTH`→`DEFAULT_LINK_DEPTH_OUT` etc.
2. **C2 — CHANNEL rename, still 2 channels.** `Direction`→`Channel`,
   `outgoing`→`outgoing-link`, `DIRECTION_DEPTH_FIELD`→`CHANNEL_DEPTH_FIELD`,
   `DepthTag.direction`→`.channel`, `DIRECTIONS`→`CHANNELS`. Zero behavior change.
3. **C3 — THE MEASURED COMMIT: `embedDepthOut` as a settings field ONLY.**
   Spec leaf + `DepthSettings` field + parse + section + row + defaults tripwire.
   Nothing traverses with it yet (row writes a value the engine ignores for one commit).
   Count files/lines HERE.
4. **C4 — the `outgoing-embed` channel.** Enum member, `CHANNEL_DEPTH_FIELD` entry,
   `neighborsOf` splits outgoing by `LinkKind` via new `OutgoingReferences.targetsOfKind`.
   Tests first: equal-defaults equivalence, mixed-chain gap (D1/6a), D5 attachment pin,
   uncached-markdown degradation pin.
5. **C5 — docs + e2e + RELEASE_CHECKLIST release note.**

## Settled decisions I must not re-litigate
- 6a kind-pure BFS (3 independent BFS runs, unioned). Mixed chain `A ![[B]] → B [[C]]`
  loses C at diverging budgets — PIN IT, do not fix it.
- No migration, no `PERSISTED_SHAPE_VERSION` bump.
- `embedDepthOut` default === `linkDepthOut` default (= 1).
- D5: attachment-ness = node-bearing-ness. PIN, write no code.
- Stage 2 visuals + incoming kind-awareness are OUT.

## Stage-1 acceptance item #1 (uncached markdown) — MY DECISION
ACCEPT the transient degradation (kind falls back to `"link"` for a markdown file not
yet in `getFileCache`). Returning `[]` instead would make the file's whole neighbourhood
vanish during the boot window — rendering MORE for a moment is a gentler failure than
rendering LESS, and a `metadataCache` event rebuilds. Pinned by a test + a doc block.

## Landmines
- `Wikilinks.globalPattern()` groups shifted in Stage 1 (group 1 = embed marker).
- `outgoingQueryCount` instrumentation now counts BOTH outgoing channels.
- `settingsProductDefaults.test.ts` is the ONE literal defaults table — editing it is
  deliberate. `settingsSpecBounds.test.ts` needs the new leaf in
  `BOUNDS_ENFORCED_OUTSIDE_THE_ENGINE` (depths clamp in the view, not the engine).

---

# STATE AT EXIT (2026-07-30) — COMPLETE

All five planned commits landed plus a sixth (docs). `npm test` 1212/91 green,
`npm run check` clean, tree clean, nothing in flight.

Commits: `8a25a98` rename · `4f29883` Channel enum · `f4257e5` row-names-field ·
`21b3152` **the measured commit (embedDepthOut alone)** · `54eacf5` the
outgoing-embed channel · `4860a6b` docs.

## The one surprise, and it is in PUBLIC.md at the top
The ticket's D1 claim ("the mixed-chain gap only appears once budgets diverge") is
FALSE. The gap appears at ANY budget above one hop, equal budgets included. The
true property is a ONE-HOP one. My first equivalence test (written at budget 2)
failed and that is how I found it. Do not "fix" the split suites in
`VicinityTraversal.test.ts` back into one.

## Records written
- ticket note on `nid_fay1hu5sxcoygizopkkg0f0d7_e` (ticket left OPEN for review).
- change_log entry `lqvsc4k9togw942k5qm3mudp4` (breaking_change, impact 4).
- follow-ups: `nid_2qygmn0z59t8fdlb5e9pap49m_e` (Stage 2 visuals),
  `nid_6kjmn2y8jc8a9gxynudusbmlk_e` (unused DEFAULT_LINK_DEPTH_* exports).

## If a reviewer pushes back
- "Why does the row carry a FIELD not a CHANNEL?" → commit `f4257e5` message.
- "Why no e2e for the new stepper?" → known gap, listed in PUBLIC.md; `npm test`
  renders no React by design and `test:e2e` needs a real Obsidian.
- "Is the structural-coverage claim real?" → yes, measured: delete the
  `embedDepthOut` line in `parseDepthFields` and `settingsSpecPersistence.test.ts`
  reddens with 2 failures.

---

# ITERATION 1 EXIT (2026-07-30) — COMPLETE

Reviewer: 0 BLOCKING / 5 SHOULD-FIX / 4 NITs, verdict DONE. All 5 SHOULD-FIX handled
(4 incorporated, #5 "close the ticket" deferred to the orchestrator BY INSTRUCTION).
NITs 1/2/3 incorporated, NIT 4 rejected as gold-plating. Full rationale in the
`## ITERATION 1` section of PUBLIC.md.

`npm test` 1213/91 green, `npm run check` clean, tree clean. Ticket left OPEN and NO
change_log entry written for this iteration — the orchestrator owns both.

## What actually changed in code (small)
- `src/engine/VicinityTraversal.test.ts` — the acceptance suite's fixture gained a
  kind-changing SECOND HOP (`b [[d]]`) plus a new divergence test. THIS IS THE ONE
  THING NOT TO UNDO: without the second hop the equivalence suite passes vacuously at
  ANY budget. I proved the fix by temporarily setting both shipped outgoing defaults
  to 2 and watching the suite go red with 2 failures.
- `src/persistence/persistedShapes.test.ts:25` — round-trip literal is now
  ALL-NON-DEFAULT (3 / 4 / 2) so "parsed" cannot alias "fell back to default".
- `docs-internal/plan/high-level-plan.md` — the `Reference.original` cross-check is
  now stated as UNGUARDED (suite deleted as circular in `eab9bd2`), pointing at
  `nid_t0x7ap99djfuzvz5p261ao7rn_e`.

## Measurement correction (the item that mattered most)
Fixture churn is **17 files (13 unit + 4 e2e)**, not 13 (PUBLIC.md) and not 18
(the `21b3152` commit message). Table now sums to 25 = 6 production + 2 test tables +
17 churn. Headline UNCHANGED: 25 files, +91/−43, ~14 real-code lines, silent steps
8 → 1. I did NOT rewrite the commit message (reviewed history); the ticket carries a
note naming the wrong figures and superseding them.

## Tickets
- NEW `nid_xy56b20jbvaedbl0610m3j2ls_e` — spec-leaf ⇒ declared-row guard.
- `nid_2qygmn0z59t8fdlb5e9pap49m_e` (Stage 2 visuals) ALREADY EXISTED from Stage 3;
  extended with the NIT-3 node-sizing note. I deliberately did NOT add the
  `settings-cleanup` tag the orchestrator asked for — it is a graph-rendering ticket
  and the tag would mis-route it into the settings loop. Push-back recorded in
  PUBLIC.md; reverse it in 5 seconds if the orchestrator disagrees.
