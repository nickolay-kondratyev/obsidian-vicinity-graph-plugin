# DOC_FIXER — `edge-routing__05` close-out

No `src/`, `e2e/` or `scripts/` changes. Nothing committed (TOP_LEVEL_AGENT commits).

## New ticket

- **id:** `nid_j2jwp6x9rij34kbkewo03m0mb_e`
- **path:** `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2/_tickets/edge-routing06-non-exclusive-group-boundary-pins-reduce-and-expose-the-libavoid-shape-buffer.md`
- title: `edge-routing__06: non-exclusive group boundary pins + reduce and expose the libavoid shape buffer`
- `type=feature`, `priority=1`, `tags=edge-routing,layout,aesthetics`, assignee `CC_WITH-nickolaykondratyev`
- **linked** (symmetric) to the closed `edge-routing__05` (`nid_4lmhpfc64eb4auw27wqis8wqe_e`).

Covers (a) `setExclusive(false)` on the group boundary pins (82→40 non-facing,
−2.3% length, fixes today's latent centre-fallback bug) and (b) reducing
`EDGE_ROUTING_SHAPE_BUFFER_PX` from 17px toward the human's proposed 5px, exposed
as a user setting. It states the 17px value is **load-bearing and test-locked**
(`buffer = EDGE_PAIR_CURVATURE_PX / 2`; `buffer > EDGE_ARROWHEAD_INSET_MIN_PX = 14`;
both asserted at `src/view/edgeRouting.test.ts:109-131`, behavior-capturing, not to
be loosened without human alignment), makes **resolving those two invariants with
the human the FIRST task** (three options laid out, choice left to the human),
mandates a **measured sweep 5 / 8 / 11 / 14 / 17** with per-value non-facing count,
maxDetourRatio, meanDetourRatio, routing/layout ms and a screenshot, spells out the
settings cost (engine ranges → versioned persisted shape → settings tab → README,
plus the `obsidian-settings` skill), and flags the "no new settings" reversal as
deliberate and human-approved.

## Files created

- `docs-internal/research/facing-side-edge-attachment.md` — the parking doc.
  Leads with the negative result (0/818, 0/43, still 0 at cost 100 000, positive
  control live, independently reproduced), then the parked two-pass pin-CLASS
  design with **1.30×** recorded as the human's tolerance, the M1 caveat that all
  its numbers were measured without `setExclusive(false)` and with a non-total
  facing rule, why keep-shorter (1.0) fails, the M4/M5 fixture-artifact caveats,
  the parked follow-ups (note-square pins @ ~8838ms vs ~1450ms, detour-triggered
  re-route, `ClusterRef` unbound on 0.4.5), and revisit triggers.

## Files changed (surgical)

- `docs-internal/research/research-layout-aesthetics.md` — §B1 measurement update
  + link to the new doc; §C disposition now says __05 closed as a negative result
  and names `edge-routing__06`; §C1 gains a "read the companion doc first" banner,
  strikes the `setConnectionCost` bullet (disproved), strikes/inverts the
  `setExclusive(true)` bullet, adds the `shapeBufferDistance` bullet, and marks
  `ClusterRef`/`clusterCrossingPenalty` **infeasible on 0.4.5**; §E item 1 updated.
  No `ap_XXX_E` anchors or wiki links exist in this file — none touched.
- `docs-internal/research/crossing-penalty-and-worker-offload.md` — stale companion
  link `../notes/…` → `./research-layout-aesthetics.md` (+ the new doc); the
  ClusterRef bullet corrected to infeasible; the two `edge-routing__05` references
  updated (`__06` for the revisit trigger).
- `docs-internal/specs/graph/arrows.md` — pre-existing staleness found while here
  (was follow-up §8.2 of the plan, now fixed rather than ticketed): the removed
  `edgeRouting` setting no longer gates the pass (verified: no `edgeRouting` in
  `src/engine/`, ticket 02 closed), heading "default ON" → "always on", and the
  "libavoid pins connector ends to the box centre" claim replaced with the actual
  12 `BOUNDARY_PIN_SPECS` pins on group boxes / centre pin on notes.

## For TOP_LEVEL_AGENT

- The `edge-routing__05` ticket file already carries its RESOLUTION note and points
  at `docs-internal/research/facing-side-edge-attachment.md` — that path now exists.
- **CHANGELOG suggestion** (docs-only release line): "Investigated facing-side edge
  attachment on folder-group boxes (`edge-routing__05`): facing-side pin costs
  measured inert against the real libavoid wasm (0 of 818 attachments, still 0 at
  cost 100 000) — closed as a negative result, no behaviour change. Findings and
  the parked two-pass design recorded in `docs-internal/research/facing-side-edge-attachment.md`;
  the surviving levers are ticketed as `edge-routing__06`."
- Remaining `edge-routing__05` §8 follow-ups NOT ticketed (per the "research docs,
  not tickets" instruction) and NOT covered by `edge-routing__06`:
  `ObsidianHarness` hardcodes `.dev-vault` (no `VICINITY_E2E_VAULT` override), and
  `detourStats` has no unit test. Flagging in case you want them recorded somewhere.
- Scratch inputs left under `.tmp/ticket-*.md` (gitignored); safe to delete.

## `#QUESTION_FOR_HUMAN`

None.
