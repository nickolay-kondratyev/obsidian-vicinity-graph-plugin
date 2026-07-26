# IMPLEMENTATION_REVIEW__PUBLIC — settings-e2e-baseline-dry

Reviewed: `git diff main...HEAD` (`a24113a`, `3c20d03`); `.ai_out/` doc commits ignored.
Ticket `nid_3399ajdcy5lq21lx5v0jxh9i4_e`.

## Summary

Adds `e2e/settingsBaseline.ts` — one e2e-side description of the settings-tab
cards (scope + heading + reset-row name, render order) and the controls-panel
disclosures — plus `e2e/settingsBaseline.test.ts` as the literal pin, and rewires
all three settings specs to consume it. **The change is sound. No assertion was
weakened; one was strengthened. Acceptance criteria met.** Findings below are
quality-level, none blocking.

## Verification I ran myself (not the implementer's numbers)

| Command | Result |
|---|---|
| `npm run check` | exit **0** |
| `npx tsc -p e2e/tsconfig.json` | exit **0** |
| `npm test` | **74 files / 992 tests passed**, exit 0 (matches the claim) |
| `npx vitest run e2e/settingsBaseline.test.ts` | 6 passed |
| `npm run test:e2e` (FULL suite, real Obsidian) | exit **1** — 71 passed, **1 failed**, 1 skipped, 6 did not run |

The single e2e failure is `e2e/vicinityGraph.e2e.ts:160` ("singleton-folder note
shows a folder breadcrumb…", `.vicinity-graph-node__breadcrumb` element not
found). **It is not caused by this branch**: the branch touches zero `src/` files
and does not touch `vicinityGraph.e2e.ts`, and the failure reproduces in
isolation (`npm run test:e2e -- vicinityGraph` → 13 passed, 1 failed). All **34**
tests across the three settings specs passed in my run, confirming the
implementer's 34/34. Their report is accurate but only ever ran the two filtered
subsets, so the full-suite red was never observed — worth a follow-up ticket.

Logs: `.tmp/rev_check.txt`, `.tmp/rev_tsc_e2e.txt`, `.tmp/rev_test.txt`,
`.tmp/rev_e2e.txt`, `.tmp/rev_e2e_iso.txt`.

## Checks against the brief

**1. No assertion weakened — confirmed.** I reconstructed every pre-change
literal from `git show main:<file>`:
- 4× `toHaveCount(6)` → `SETTINGS_TAB_SECTIONS.length` / `SECTION_RESET_NAMES.length`, both 6 (`SECTION_RESET_SCOPES` in `src/view/settingsResetPlan.ts:179-186` has exactly 6 entries).
- The 6-string `toHaveText([…])` and 7-string `toEqual([…])` reduce to byte-identical strings in identical order (`SETTINGS_RESET_SCOPES[*].label`, verified against `settingsResetPlan.ts:82,87,94,113,72,148,63`).
- 3× `"Restore all Vicinity Graph settings?"` → `ALL_SETTINGS_RESET_CONFIRM_TITLE`, identical.
- **Self-fulfilling risk is properly mitigated**: reset names are derived from src, but `e2e/settingsBaseline.test.ts:41-54` re-types them as literals, and `src/view/settingsResetPlan.test.ts:269-303` keeps its shape-level pin (nothing removed there). A rename still turns exactly one thing red.
- The one delta is **additive**: `e2e/settingsUxVisual.e2e.ts:137-139` newly asserts the six card headings in DOM order. I verified `src/view/VicinityGraphSettingTab.ts` has exactly 6 `setHeading()` calls, one per section (lines 216, 240, 282, 303, 373, 435), and `display()` renders them in the order `SECTION_RESET_SCOPES` lists.

**2. "ONE edit updates every site" — holds for the three specs.**
- Add a 7th card → `SECTION_CARD_HEADINGS` (+ the literal pins in `settingsBaseline.test.ts`, which is the deliberate pin). **Zero spec edits.**
- Rename a card + its reset label → src label + `SECTION_CARD_HEADINGS` (+ pin). **Zero spec edits.**
- Add a panel disclosure → one entry in `CONTROLS_PANEL_DISCLOSURES`. **Zero spec edits.**

**3. Compile-time exhaustiveness — verified empirically, with a caveat (see S-1).**
I reproduced it: with a 7th scope in `SECTION_RESET_SCOPES`, tsc emits
`e2e/settingsBaseline.ts(40,7): error TS2741: Property '"edge-routing"' is missing …`.

**4. `.first()` semantics — preserved exactly.** `summaryAlsoMatchesAnAncestor` is
`true` only for `Depth` and `Force layout`, matching the pre-change unrolled form
one-for-one. Order (Depth, Node exclusion, Node sizing, Node contents, Force
layout), `startsOpen` flags, and the `disclosure()` helper are all unchanged. The
per-entry `expect(locator, "panel disclosure=[…]")` message preserves the
diagnostic the unrolled form gave for free — good.

**5. Serial ordering — intact.** Diffed the full test-title list of all three
specs against `main`: same titles, same order, `mode: "serial"` unchanged, no
test removed, no `describe` scope changed. One rename ("renders six framed
section cards" → "renders one framed card per section, headed and…"), which
preserves meaning and drops a hand-maintained "six" — acceptable and disclosed.

**6. Guard compatibility — OK.** Both new files use no `fs` and import no
`node:fs`, so `e2e/vaultTarget.test.ts`'s mutation scan and namespace-import
check pass (they run green in `npm test`).

**7. Layering — OK.** `e2e/settingsBaseline.ts` imports only
`src/view/settingsResetPlan`, whose transitive imports (`../engine`,
`nodePreviewPreferenceMeta`, type-only `settingsWritePlan`) pull in no `obsidian`
and no `react`. Confirmed at runtime: the new vitest file loads and passes under
plain node.

**8. `ap_XXX_E` anchors** — byte-identical in all three specs (diffed).

## 🚨 CRITICAL Issues

None.

## ⚠️ IMPORTANT Issues

**S-1 (SHOULD-FIX) — the advertised compile-time guard is not run by any
command.** `e2e/settingsBaseline.ts:117-118` says a new scope "fails `tsc` HERE".
That is true only under `npx tsc -p e2e/tsconfig.json`, which is in **no** npm
script: `check` is bare `tsc -noEmit` against a root `tsconfig.json` whose
`include` is `["src/**/*.ts", "src/**/*.tsx"]`, `build` is `check` + esbuild, and
there is no `.github/workflows/`. A contributor adding a scope runs `npm run
build` and sees green. (There *is* a runtime net — the missing `Record` key makes
`SETTINGS_TAB_SECTION_HEADINGS` contain `undefined` and `settingsBaseline.test.ts`
fails under `npm test` — but that is not what the comment claims.)
Fix: add `"check:e2e": "tsc -p e2e/tsconfig.json"` to `package.json` and make
`"check": "tsc -noEmit && npm run check:e2e"`; then the comment is honest.

**S-2 (SHOULD-FIX) — `e2e/settingsBaseline.test.ts:30-39` re-creates the very
duplication the ticket removes.** Unlike the reset-name test (which pins a value
*derived from src*), this one asserts a hand-written const equals its own
hand-written literals, both in `e2e/`. It has no independent authority — the real
pin for headings is the new DOM assertion at `e2e/settingsUxVisual.e2e.ts:137-139`
— and it makes a card rename a **two**-file edit instead of one.
Fix: delete that test. Keep the reset-name and `ALL_SETTINGS_RESET_NAME` pins,
which are load-bearing.

## 💡 Suggestions

**N-1 — the panel list has no exhaustiveness pin, unlike the tab.** The tab now
catches an unlisted card via `toHaveText(SETTINGS_TAB_SECTION_HEADINGS)` (count +
identity). `CONTROLS_PANEL_DISCLOSURES` has no equivalent, so a newly added
disclosure still silently escapes — the exact failure mode the ticket cites. An
exhaustive count needs care (the doc at `e2e/settingsBaseline.ts:177-181`
correctly excludes the conditional "Pinned centrals" and nested "Advanced
spacing"), so a scoped assertion — e.g. direct-child disclosures of the panel
root equals `CONTROLS_PANEL_DISCLOSURES.length` — would be the 80/20. Follow-up
ticket rather than a change request.

**N-2 — `settingsBaseline.test.ts:60-64` and `:68-72` are change-detectors.** The
"heading and reset name are both present" test is vacuous by construction, and
"exactly one starts open" restates the const's own literals. Neither can fail for
a reason a maintainer cares about. Consider dropping both; six tests where two
carry the weight dilutes the file's stated purpose.

**N-3 — `ALL_SETTINGS_RESET_CONFIRM_TITLE` (`e2e/settingsBaseline.ts:159`)
mirrors src's `` `${ALL_SCOPE_LABEL}?` `` rather than deriving it.** Tiny (one
`?`), and `planSettingsResetConfirmation` needs a `SettingsWriteContext` so it
cannot be called from here — the mirroring is a reasonable 80/20. Noted only so
it is a conscious choice.

## Follow-up tickets suggested (out of scope)

1. **`e2e/vicinityGraph.e2e.ts:160` fails on the full e2e suite in this
   environment** (breadcrumb element never appears; reproduces in isolation,
   unrelated to this branch). The release gate is currently red — it needs an
   owner, and the failure means 6 further tests never run.
2. N-1 above (panel-disclosure exhaustiveness).
3. `nid_g4iae40tww9abtwrexdrvic0y_e` already filed by the implementer for the
   remaining `openSettingsTab` / `card` / `resetButton` helper duplication and the
   divergent local `setTheme` — good catch, correctly deferred.

## Documentation Updates Needed

None required. If S-1 is taken, update the `CLAUDE.md` "Commands" table so
`npm run check` is described as covering `e2e/` too.

---

# Round 2 — convergence check (delta `817cd23`)

**Verdict: SIGNAL READINESS to converge. 0 BLOCKING, 0 SHOULD-FIX beyond one
one-line doc line, everything else NIT.**

## My own re-run (real numbers, this environment)

| Command | Result |
|---|---|
| `npm run check` | exit **0** (`.tmp/r2_check.txt`). Wall time **2.3s**; bare `tsc -noEmit` alone is 1.4s → the added `check:e2e` costs **~0.9s**. Negligible. |
| `npm test` | **74 files / 988 tests passed**, exit 0 (`.tmp/r2_test.txt`) — matches the implementer's claim exactly. |
| `npm run test:e2e -- settingsUxVisual settingsReset` (real Obsidian; filter matches the 3 settings specs) | **34 passed (8.2s), exit 0** (`.tmp/r2_e2e_settings.log`). |

Full e2e suite deliberately NOT re-run: the `vicinityGraph.e2e.ts:160` red is
already confirmed pre-existing and ticketed (`nid_yccejkvl0ccqc77olsgg5deka_e`).

## 1. Round-1 findings — dispositions

- **S-1 — RESOLVED.** `package.json` now `"check": "tsc -noEmit && npm run check:e2e"`,
  `"check:e2e": "tsc -noEmit -p e2e/tsconfig.json"`. `e2e/settingsBaseline.ts:36-39`
  now names `npm run check`, so the advertised guard matches a real command. `CLAUDE.md`
  Commands line updated.
- **S-2 — RESOLVED.** The heading tautology is gone; the surviving
  `settingsBaseline.test.ts` is 2 tests, both pinning **src-derived** values. The
  added WHY-NOT docstring states the retained criterion — good, it stops the
  tautology from being re-added later.
- **N-2 — ACCEPTED and taken**, plus one further self-referential test
  (`EVERY_SETTINGS_RESET_NAME === [...SECTION, ALL]`) they spotted themselves.
- **N-1 — DEFERRED to `nid_vqw34wdpmb5qzn52cy6qugqgd_e`.** Correct call; the ticket
  even records the direct-child-scoping trap. Agreed.
- **N-3 — REJECTED with the right rationale** (`planSettingsResetConfirmation` needs a
  `SettingsWriteContext` unbuildable from `e2e/`). Accepted.

## 2. `scripts/run-e2e.sh` regression risk — CLAIM VERIFIED, no gap

Read end to end (42 lines, `set -euo pipefail`, no `exit`, no `return`, no other
`if`/`case` that can skip work):

- L16-19 `OBSIDIAN_PATH` branch — binary resolution only, both arms fall through.
- L25-28 display-flag branch — env only, both arms fall through.
- L33-38 the only build-relevant fork:
  - `VICINITY_E2E_VAULT` set → `npm run build` → `check` → `tsc` + `check:e2e`. ✅
  - unset → `npm run setup:dev-vault` → `scripts/setup-dev-vault.sh:377` runs
    `npm run build` and **`exit 1` on failure** (`set -euo pipefail` also propagates). ✅
- L42 `exec npx playwright test`.

There is **no skip-build / reuse-artifact / cached path**. Every route to Playwright
still type-checks `e2e/`. The deletion is a strict de-duplication, not a coverage loss,
and my `test:e2e` run above exercised the non-vault branch for real.

## 3. Test deletions — all 4 were introduced by THIS branch

`git show main:e2e/settingsBaseline.test.ts` → *"exists on disk, but not in `main`"*.
`git diff main...HEAD --stat -- '*.test.ts' '*.test.tsx' ':!e2e/settingsBaseline.test.ts'`
is **empty**: not a single pre-existing test file is touched by the branch. 992 → 988
is 4 same-file tautologies removed from a file this branch created. **No
behaviour-capturing test was removed** — CLAUDE.md's rule is not engaged.

## 4. `npm run check` cost / ordering — fine

`build` = `check` + esbuild, unchanged and green (it ran inside the e2e run above).
`dev` does not call `check`, so the watch loop is untouched. `e2e/tsconfig.json`
extends the root config and re-checks `src/` transitively, so `src/` is compiled
twice per `check` — measured cost **~0.9s**, well under any threshold worth
engineering around. Ordering (`tsc && check:e2e`) means an `src/` error short-circuits,
which is the right failure order.

## 5. Round-1 core verdicts re-confirmed

`817cd23` touches no spec file (`e2e/settingsBaseline.ts` diff is comment-only), so
round 1's conclusions stand unchanged: no assertion weakened (one strengthened), the
one-edit property holds, `.first()`/`summaryAlsoMatchesAnAncestor` semantics preserved,
`mode: "serial"` and test order intact, `vaultTarget.test.ts` fs guards still vacuously
green (neither new file uses `fs`), `ap_XXX_E` anchors byte-identical. `CLAUDE.md`'s
Commands table is now accurate.

## 🚨 BLOCKING

None.

## ⚠️ SHOULD-FIX

**R2-1 — `README.md:215` still documents the old `check`.** The Scripts table says
`| npm run check | tsc -noEmit (strict type check) |` and the `build` row says
`tsc -noEmit type check`. `CLAUDE.md` was updated; the developer-facing README was not,
so the two now disagree. One-line fix: mirror the CLAUDE.md wording (src, then `e2e/`
via `check:e2e`).

## 💡 NITs

- **R2-2** — `docs-internal/notes/e2e-obsidian-docker-setup.md:80` reproduces
  `run-e2e.sh` verbatim *including* the deleted `npx tsc -p e2e/tsconfig.json` line
  (and the prose "Seed the vault, type-check specs, run Playwright"). It is a
  historical setup recipe, but it is now a wrong recipe for this repo.
- **R2-3** — `scripts/run-e2e.sh:7` header still reads "seeds the dev vault,
  type-checks the specs, and runs Playwright". Still true, but only indirectly; the
  WHY-NOT at L39-41 already explains it, so the header could just say "builds".
- **R2-4 (conscious tradeoff, no action)** — producing `main.js` now fails on an
  **e2e-only** type error, since `build` → `check` → `check:e2e`. That is the point of
  S-1's fix and the cost is ~0.9s, but it is a new coupling of the production bundle to
  test-code type health. Flagging so it is a chosen property, not a surprise.

## Documentation Updates Needed

R2-1 (README Scripts table). R2-2 optional.
