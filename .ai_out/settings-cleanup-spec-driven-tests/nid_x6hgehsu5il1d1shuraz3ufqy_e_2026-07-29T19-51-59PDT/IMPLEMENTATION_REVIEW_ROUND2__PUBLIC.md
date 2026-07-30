# IMPLEMENTATION_REVIEW — ROUND 2 (PUBLIC)

Subject: commit `9dee711` (iteration over `3468387`). Narrow review, per the round-2 charge.
Fresh reviewer instance. Every mutation experiment was reverted; `git status` clean on exit; no
source file modified by me.

## Verdict

**CONVERGED — 0 BLOCKING, 1 SHOULD-FIX (a hand-off/sign-off item, not code), 2 NITs.**

## Independently measured actuals

| Check | Result |
|---|---|
| `npm run check` | exit 0 (`.tmp/r2-check.log`) |
| `npm test` | exit 0, **91 test files / 1160 tests passed** (`.tmp/r2-test.log`) — matches the claim |
| e2e touched | NO. `git diff 3468387..9dee711 --stat` lists only 5 `src/` files, 1 `_tickets/` file, `.ai_out/` |
| render harness introduced | NO. `package.json` untouched; no jsdom / testing-library |
| production source changed | NONE this round (all 5 `src/` files are `*.test.ts` or the test fixture) |

Test-count accounting (`it(` counts, old vs new): `settingsProductDefaults.test.ts` 8→3 (−5),
`forceLayoutSettings.test.ts` 4→5 (+1, the relocated invariant), `settingsSpecBounds.test.ts`
10→9 (−1, same invariant leaving), `settingsRowParity.test.ts` 5→6 (+1, the new per-row scan).
Net −4. 1164 − 4 = 1160. **The accounting is honest.** No behavior coverage was lost: each of
the 5 collapsed `it`s asserted a value now pinned in the single table, and the one that asserted
a *derived* property ("own-file-size is the only metric shipped ON") is now pinned stronger —
every metric's `enabled` flag is in the table, and a metric added shipped-ON fails the table as
an extra/changed key.

## Question 1 — is the all-21 `toEqual` a regression? **ACCEPTABLE, not a regression.**

I ran the file-count experiment the charge asked for. Mutating one default in
`src/engine/SettingsSpec.ts` and running the FULL suite:

| Mutation | Files that must be edited to get back to green |
|---|---|
| `globalView.nodeCap` 100 → 250 | **1** — `src/engine/settingsProductDefaults.test.ts` (1 test) |
| `globalView.forceLayout.centerPullStrength` 0.05 → 0.15 | **1** — same file, same test |
| `globalView.sizing.minPx` 40 → 30 | 2 — that file **plus** `src/persistence/persistedShapes.test.ts` ("every field differs from the defaults" fixture guard) |
| RANGE `linkStrengthFactor.max` 4 → 8 | **1** — same file, the range-exception test |

So a deliberate retune is a one-line edit in exactly ONE place. The `minPx` second file is a
pre-existing fixture-must-differ guard (not introduced this round, and not a mirror of the
default value); a retune legitimately has to touch it. I also grepped for surviving literal
mirrors: the only default/range literals left anywhere under `src/**/*.test.ts*` are the two
range pins in `settingsProductDefaults.test.ts`. **There is one table, and it is the only one.**

That is decisive against the "regression" reading. The two resolved staleness tickets were about
THREE mirrored baselines (defaults + limits in `SettingsSpec.test.ts`, plus a seven-field one in
`forceLayoutSettings.test.ts`) that drifted apart and whose failures said nothing about intent.
The recurrence mechanism — hunt the mirrors, guess which one is authoritative — no longer exists.

Two further properties make the total table strictly better than the "SMALL set" it replaced,
and they are properties a partial set *structurally cannot have*:

- Because it is a single `toEqual` over the walk's own leaf ids, a leaf **added** to the spec
  (extra key) or **removed** (missing key) fails it. A curated subset cannot notice a NEW
  setting shipped with no tripwire at all.
- It removes a per-field judgement ("which suite happens to observe this constant") that round 1
  proved had already rotted for 3 of 7 fields. Nothing to re-measure means nothing to rot.

It is also non-vacuous by construction: if `EVERY_SETTINGS_SPEC_LEAF` ever went empty, `declared`
would be `{}` and the assertion would fail against 21 keys — no guard needed.

**The one real caveat (SHOULD-FIX below):** the ticket's words are "Keep a SMALL number of
literal assertions … (e.g. nodeCap default 100)". 21 is not small. The implementer served the
instruction's stated PURPOSE ("structural tests must not erase the ability to notice an
unintended default change") over its stated MEANS, with measurement behind the choice — a
defensible engineering call, but CLAUDE.md is explicit that deviations from an explicit human
requirement need the human's yes. Right now that deviation is argued only in `.ai_out/` and in
the test file's header. It must land in front of the owner.

For the record, the smaller alternative that would satisfy the literal wording is: the round-1
subset (nodeCap, both depths, outlineMaxDepth, nodePreviewPreference, minPx/maxPx, exclusion
off/empty, own-file-size-only) **plus** `centerPullStrength`, `linkStrengthFactor` and
`edgeRoutingClearancePx`, keeping the `linkStrengthFactor` max-4 range pin. ~12 literals, closes
the measured hole — but it gives up the added/removed-leaf detection above. My recommendation is
to keep the total table; the owner just has to say so.

## Question 2 — does the parity fix have teeth? **YES, independently confirmed.**

I re-ran three of the four mutations myself against `src/view/settingsRowParity.test.ts`
(each reverted immediately):

| Mutation | Result |
|---|---|
| `src/view/SettingsRowView.tsx` (panel row presenter): `if (row.label === "Node cap") return <></>;` inside `case "node-cap":` | **FAIL** — `WHEN a row is declared THEN no surface names it, so no surface can single it out` |
| `src/view/VicinityGraphSettingTab.ts` (tab): `if (row.label === "Node cap") return;` inside `case "node-cap":` | **FAIL** — same test |
| `src/view/SettingsRowView.tsx`: `case "node-cap":` commented out | **FAIL** — `WHEN the model declares a control kind THEN every presenter has a \`case\` for it` |

Mutation 1 is the exact one that PASSED in the implementer's first cut (the
`{...PRESENTERS, ...SECTION_WALKERS}` key collision on `"controls panel"`). It now reddens, so
the module-keying fix is real and not merely asserted.

Same-class-of-bug sweep over the new scan code — nothing else found:

- `EVERY_ROW_RENDERING_MODULE` (`settingsRowParity.test.ts:72-74`) dedupes over `Object.values`,
  not keys, so the collision class is gone at the root; the vacuity assertion at line 148
  (`3 modules > 2 surfaces`) would catch a regression to surface-keying. Correct guard, and it
  guards the right thing.
- `source()` (`:82-88`) only ever REMOVES text, so the comment stripper can produce a false
  FAILURE (loud) but never a false pass — the safe direction. The `/\/\*[\s\S]*?\*\//g` pass
  could in principle eat code between a `/*` inside a string/regex and a later `*/`; the result
  would be a missing-`case` failure, i.e. noisy, not silent.
- `readFileSync` throws if a module is renamed, so a scan can never quietly read nothing.
- The label scan's `.filter()` shrinking to zero is the PASS condition, and it is protected by
  the `EVERY_SETTINGS_ROW.length > SETTINGS_SECTIONS.length` vacuity check at line 144.
- The new `throw` in `alternateLeafValue` (`settingsSpecLeaves.ts:216-222`) converts a
  previously-misattributed failure into a named one. Correct direction.

Residual, correctly written down in the file header AND on the harness ticket: the label scan
misses an index/predicate-based subset (`rows.slice(1)`), and a per-row skip keyed on something
other than the label (`row.description`, a `SETTINGS_ROWS_BY_KIND` lookup) also names no row.
Not fixable without a render harness. Accepted.

## Findings

1. **[SHOULD-FIX] The widening from "SMALL" to all-21 needs the owner's explicit yes, in a place
   the owner reads.** `src/engine/settingsProductDefaults.test.ts:1-45` explains the change well,
   and `IMPLEMENTATION_ITERATION__PUBLIC.md` states it prominently — but neither is the ticket.
   Add a note on `_tickets/settings-cleanup-spec-driven-tests.md` (or the release note) saying:
   the owner's "SMALL number of literal assertions" was widened to ALL 21 spec-leaf defaults
   because measurement showed 3 defaults had zero tripwire under the small set, and because only
   a TOTAL table detects a newly added leaf; a one-line edit in one file is the cost of a retune.
   Cheap, and it is the difference between a documented decision and an unilateral one.

2. **[NIT] The measured "4 of 7 are geometry-observable, 3 are not" split is now prose in three
   places** — `src/engine/forceLayoutSettings.test.ts:19-25`,
   `src/engine/settingsProductDefaults.test.ts:15-22` and `:69-71`. This is the same volatile
   measurement the implementer just (correctly) argued "has to be re-measured on every layout
   change to stay honest", and it now carries no load at all: the baseline covers all 21
   regardless of which suite observes what. Three copies of a fact that can rot silently is the
   DRY smell CLAUDE.md names ("if you'd write the same WHY comment twice…"). Suggest keeping it
   once — in `settingsProductDefaults.test.ts`'s header, as the historical reason the rule
   changed — and deleting the forward-looking claim from `forceLayoutSettings.test.ts:22-25`.

3. **[NIT] One `it` now covers 21 behaviors** (`settingsProductDefaults.test.ts:96-101`), against
   the repo's "one behavior per test" convention. The rationale in the code (one diff names every
   offender, instead of stopping at the first) is a good one and I would not change it — noting
   it only so the deviation is a known one rather than an accident.

## NIT 5 rejection (both ticket dirs live) — reasonable

Yes: choosing between `_tickets/` and `docs-internal/tickets/`, or declaring the split in
`CLAUDE.md`, is a repo-convention decision the owner makes once for the whole repo, and round 1
itself called it "not this ticket's job".

## Documentation still owed at ticket close (TOP_LEVEL_AGENT's, unchanged from round 1)

- `docs-internal/notes/settings.md` — the "step 5 landed" line.
- `change_log` entry.
- Release-note line: every settings default now has a literal tripwire in
  `src/engine/settingsProductDefaults.test.ts`; retuning one is a one-line edit there. Plus
  finding 1's sign-off sentence.
