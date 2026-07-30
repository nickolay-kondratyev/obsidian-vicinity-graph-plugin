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
