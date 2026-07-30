# IMPLEMENTATION_ITERATION — PUBLIC (round 1)

Input: `IMPLEMENTATION_REVIEW__PUBLIC.md` against commit `3468387` (READY, 0 BLOCKING,
2 SHOULD-FIX, 3 NIT). No scope expansion: no e2e, no render harness, no per-doc tests.

## Disposition table

| # | Finding | Disposition | Rationale |
|---|---------|-------------|-----------|
| 1 | SHOULD-FIX: `centerPullStrength`, `linkStrengthFactor`, `edgeRoutingClearancePx` have ZERO tripwire while comments claim coverage | **INCORPORATED — and gone further** | Reviewer's measurement was right, and it disproved the admission rule, not just three entries. `settingsProductDefaults.test.ts` now pins EVERY spec leaf's default (21) in ONE id-keyed table, checked by one `toEqual` that also fails on an added/removed leaf. The two overclaiming headers are rewritten to state exactly what the geometry suites do and do NOT react to. |
| 2 | SHOULD-FIX: parity test is kind-level; a per-row skip or dead `case` passes | **INCORPORATED (option a — strengthened per-row) + the honest write-down** | Two real strengthenings landed, both mutation-proven (below). Residual gap recorded on `nid_7qot0m6nuxxmd5z0yb9jylsd6_e` and stated in the file header. |
| 3 | NIT: anti-collapse invariant is a force-layout DOMAIN claim living in the generic bounds walk | **INCORPORATED** | Moved verbatim to `forceLayoutSettings.test.ts`; the now-unused `SETTINGS_SPEC` import dropped from `settingsSpecBounds.test.ts`. |
| 4 | NIT: `alternateLeafValue`'s string branch mis-attributes a second string leaf | **INCORPORATED** | One-line `throw` keyed on the leaf id — the failure now names the fixture as the cause instead of the round-trip. |
| 5 | NIT: `CLAUDE.md` says `docs-internal/tickets/` while follow-ups go to `_tickets/` | **REJECTED** | Both directories are live with real content; picking one (or declaring the split) is an owner call about repo convention, not a comment fix, and it is outside this ticket — the reviewer agrees it is "not this ticket's job". |

## SHOULD-FIX 1 — the fix, and why the rule changed rather than the list

The old admission rule was "a default belongs here only if changing it changes what the
user meets on first run; a tuning constant whose rationale is measured on the spec is
already protected by the geometry suites". The reviewer measured that second clause and it
was false for three of seven fields. The clause is not repairable by adding three names:
it is a per-field judgement about which suites happen to observe which constant, it has to
be re-measured on every layout change to stay true, and it was not. So it is gone.

`src/engine/settingsProductDefaults.test.ts` now holds `SHIPPED_SETTINGS_DEFAULTS` — every
leaf id → its literal shipped default — asserted with ONE `toEqual` against the walk's own
projection. That single assertion catches a changed value, a leaf added to the spec (extra
key) and a leaf removed from it (missing key), and it names every offender at once.

This is NOT the staleness the ticket removed: the baselines that went stale were DUPLICATES
(defaults + limits baselines in `SettingsSpec.test.ts`, plus a seven-field one in
`forceLayoutSettings.test.ts`) — three mirrors to hunt. There is one table now, and being
edited in the same commit as a deliberate retune is its whole job.

Ranges stay structural (enforced + default-reachable, per `settingsSpecBounds.test.ts`) with
TWO literal exceptions, each with a reason: `outlineMaxDepth` 1..6 (markdown's own ceiling)
and `linkStrengthFactor` 0.25..4 — the value the ticket names as stale in BOTH resolved
baseline tickets, and the one range number the spec itself calls maintainer-chosen headroom
rather than a measured limit. That no OTHER range has a literal tripwire is now stated in
the file rather than implied by silence.

## Mutation-experiment proof (all 17 mutations redden; script `.tmp/mutation_audit.py`)

Each mutation patches `src/engine/SettingsSpec.ts`, runs the full suite, records failing
test names, restores the file. Full log: `.tmp/mutation-audit.log`, `.tmp/mutation-audit.json`.

**The three the reviewer proved unguarded — each now reddens:**

| Mutation | Failing test |
|---|---|
| `centerPullStrength` 0.05 → 0.15 | `settingsProductDefaults.test.ts :: shipped settings defaults (the hand-pinned literal baseline) WHEN every spec leaf's default is read THEN it is exactly the value pinned here` |
| `linkStrengthFactor` 1 → 4 | same test (1 failing) |
| `edgeRoutingClearancePx` 11 → 14 | same test (1 failing) |

**Re-audit of every other default (the "is anything else unguarded" sweep):**

| Mutation | Outcome (failing count) |
|---|---|
| `repelStrength` 300 → 60 | REDDENS (1) |
| `collidePaddingPx` 50 → 0 | REDDENS (2) — also `D3ForceLayout.test.ts` overlap test |
| `elkNodeSpacingPx` 20 → 115 | REDDENS (2) — also `groupPacking.test.ts` |
| `linkGapPx` 40 → 240 | REDDENS (3) — also both `d3ForceStranding.test.ts` cases |
| `metricWeight` 1 → 2 | REDDENS (2) — also `sizingSettings.test.ts` NaN fallback |
| `depthDecayK` 1 → 2 | REDDENS (1) |
| every metric's default weight 1 → 3 | REDDENS (1) |
| `nodeCap` 100 → 250 | REDDENS (1) |
| `nodePreviewPreference` auto → outline | REDDENS (1) |
| `outgoingDepth` 1 → 2 | REDDENS (1) |
| `minPx` 40 → 30 | REDDENS (2) — also `persistedShapes.test.ts` fixture-differs guard |
| `nodeExclusion.enabled` false → true | REDDENS (4) |
| RANGE `linkStrengthFactor.max` 4 → 8 | REDDENS (1) — `… WHEN the link-force range is read THEN it is 0.25..4 (the twice-stale headroom ceiling)` |
| RANGE `outlineMaxDepth.max` 6 → 9 | REDDENS (1) — `… WHEN the outline depth range is read THEN it is 1..6 …` |

`Mutations with NO tripwire: []`. No default in the spec is now silently changeable, and no
comment in the suite claims coverage that was not measured.

## GOAL 2 decision — option (a): strengthened per-row, structurally, no harness

Two changes to `src/view/settingsRowParity.test.ts`:

1. **Comment stripping before every scan.** Block comments plus LINE-LEADING `//` / `*`
   only — a `//` inside a string literal (a URL) must survive, and commented-out code is
   line-leading by construction. This closes the reviewer's "a `case` in dead code
   satisfies the scan" hole.
2. **A genuinely PER-ROW assertion**: for every row in `EVERY_SETTINGS_ROW`, no
   row-rendering module may contain that row's `label` as a quoted literal. A row's only
   identity in the model is its label (there is no row id), and both surfaces render the
   label from `row.label` — so a literal one is always a special case. This closes the
   reviewer's per-row-skip hole, in either presenter or in the panel's section walker.

Proven with four mutations, each run against `settingsRowParity.test.ts`:

| Mutation | Failing test |
|---|---|
| panel row presenter: `if (row.label === "Node cap") return <></>` inside its `case` | `WHEN a row is declared THEN no surface names it, so no surface can single it out` |
| settings tab: same skip in its `case` | same test |
| panel section walker (`GraphToolbar.tsx`): a `SKIP_LABEL = "Node cap"` constant | same test |
| `case "node-cap":` commented out in the panel presenter | `WHEN the model declares a control kind THEN every presenter has a `case` for it` |

**A real bug in my own first cut, caught by that mutation run and worth stating**: the scan
was keyed by SURFACE via `{...PRESENTERS, ...SECTION_WALKERS}`, and both tables use the key
`"controls panel"` — so the spread silently DROPPED `SettingsRowView.tsx`, the panel's row
presenter, and the first mutation passed. The scan is now keyed by MODULE
(`EVERY_ROW_RENDERING_MODULE`, deduplicated) with a vacuity assertion that there are more
modules than surfaces, precisely so that collapse cannot recur.

**What the file still does not guarantee — now written in its header, not just here:**
a source scan proves a `case` EXISTS, never that it renders a control, with the declared
label, in the declared order; and the label scan misses an INDEX- or PREDICATE-based subset
(`rows.slice(1)`, `rows.filter(pred)`), which names no row. Both residuals need a surface
that can be RENDERED, i.e. the harness ticket. Recorded as a timestamped note on
`nid_7qot0m6nuxxmd5z0yb9jylsd6_e`, including the acceptance criterion that would close it.

## Files touched this round

- `src/engine/settingsProductDefaults.test.ts` — rewritten: total id-keyed defaults
  baseline + the two pinned ranges + an honest header.
- `src/engine/forceLayoutSettings.test.ts` — header corrected (no more coverage overclaim);
  gained the anti-collapse range invariant (NIT 3).
- `src/engine/settingsSpecBounds.test.ts` — lost that invariant and its now-unused import.
- `src/engine/testFixtures/settingsSpecLeaves.ts` — `NODE_PREVIEW_LEAF_ID` + a throw naming
  an unmodelled string leaf (NIT 4).
- `src/view/settingsRowParity.test.ts` — comment stripping, the per-row label scan,
  module-keyed scan set, honest header.
- `_tickets/test-infra-react-component-tests-for-the-panel-controls-jsdom-a-light-renderer.md`
  — the residual-parity-gap note.

No production source changed this round. No e2e file touched.

## Verification

- `npm run check` → exit 0 (`.tmp/iter-check.log`).
- `npm test` → exit 0, **91 test files / 1160 tests passed** (`.tmp/iter-test.log`).
  Previous round: 91 / 1164. The −4 is net of collapsing eight per-default `it` blocks into
  one total baseline plus two range pins (−5) and adding the per-row parity test (+1).
- `git status` clean at commit time; every mutation experiment restored its file.

## READINESS

**READY for convergence.** Both SHOULD-FIX items are addressed with measured proof rather
than assertion, two NITs applied, one NIT rejected with a stated reason, and the two
documentation follow-ups the reviewer asked for are either done (the harness-ticket note)
or remain TOP_LEVEL_AGENT's with the ticket close (`docs-internal/notes/settings.md`
"step 5 landed" line, plus the `change_log` entry). Release-note line worth carrying: no
force-layout default is unguarded any more — every settings default now has a literal
tripwire in `src/engine/settingsProductDefaults.test.ts`.
