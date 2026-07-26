# IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC — settings-e2e-baseline-dry

Ticket `nid_3399ajdcy5lq21lx5v0jxh9i4_e` (chore, p3) — settings section-count and
reset-name baselines triplicated with no shared constant.

Commits on `settings-e2e-baseline-dry`: `a24113a`, `3c20d03`.

## What changed

**New — `e2e/settingsBaseline.ts`** (pure; no `obsidian` / `react` / `fs`):

| Export | Shape | Source |
|---|---|---|
| `SectionResetScope` | `(typeof SECTION_RESET_SCOPES)[number]` | src |
| `SETTINGS_TAB_SECTIONS` | 6 × `{ scope, heading, resetName }`, render order | scope+label from src, heading hand-written |
| `SETTINGS_TAB_SECTION_HEADINGS` | 6 strings | hand-written table |
| `SECTION_RESET_NAMES` | 6 strings | `SETTINGS_RESET_SCOPES[scope].label` |
| `ALL_SETTINGS_RESET_NAME` | 1 string | `SETTINGS_RESET_SCOPES.all.label` |
| `EVERY_SETTINGS_RESET_NAME` | 7 = sections + all | derived |
| `ALL_SETTINGS_RESET_CONFIRM_TITLE` | `` `${ALL_…_NAME}?` `` | derived (mirrors src's construction) |
| `CONTROLS_PANEL_DISCLOSURES` | 5 × `{ summaryText, startsOpen, summaryAlsoMatchesAnAncestor }` | hand-written, panel order |

Card headings are a `Readonly<Record<SectionResetScope, string>>`. **Verified the
compile-time guard actually bites**: deleting the `performance` key produced
`e2e/settingsBaseline.ts(40,7): error TS2741: Property 'performance' is missing …`
(then restored; `tsc -p e2e/tsconfig.json` green again).

**New — `e2e/settingsBaseline.test.ts`** (vitest, BDD, 6 tests): the literal pin
for the derived copy (see "no assertion weakened" below).

**Edited specs** — every site now `<CONST>.length` / `<CONST>`:

| Site | Before | After | Same value? |
|---|---|---|---|
| `settingsResetReview:81` | `toHaveCount(6)` | `toHaveCount(SETTINGS_TAB_SECTIONS.length)` | 6 — `SECTION_RESET_SCOPES` has 6 entries |
| `settingsResetVerify:59` | `toHaveCount(6)` | same expression | 6 |
| `settingsUxVisual` (cards) | `toHaveCount(6)` + prose comment | `toHaveCount(SETTINGS_TAB_SECTIONS.length)` + **new** heading assertion | 6; heading assertion is additive |
| `settingsUxVisual` (resets) | `toHaveCount(6)` | `toHaveCount(SECTION_RESET_NAMES.length)` | 6 |
| `settingsUxVisual` (reset names) | 6 inline literals in `toHaveText([…])` | `toHaveText(SECTION_RESET_NAMES)` | identical 6 strings, identical order (pinned by the vitest test) |
| `settingsResetReview:196` | 7 inline literals in `toEqual([…])` | `toEqual(EVERY_SETTINGS_RESET_NAME)` | identical 7 strings |
| `settingsResetReview:270,283` / `settingsUxVisual:253` | `toContainText("Restore all Vicinity Graph settings?")` | `toContainText(ALL_SETTINGS_RESET_CONFIRM_TITLE)` | identical — `"Restore all Vicinity Graph settings" + "?"` |
| `settingsResetVerify:165` | `toContain("Restore all Vicinity Graph settings")` | `toContain(ALL_SETTINGS_RESET_NAME)` | identical |
| `settingsUxVisual:52-58` | 5 unrolled disclosure assertions | loop over `CONTROLS_PANEL_DISCLOSURES` | identical — see below |

**Panel-disclosure loop, per entry.** Order preserved exactly (Depth, Node
exclusion, Node sizing, Node contents, Force layout). `.first()` is carried as a
per-entry flag `summaryAlsoMatchesAnAncestor`, `true` only for `Depth` and
`Force layout` — the two that had it. No `.first()` added or dropped anywhere.
`startsOpen` is `true` only for Depth → `toHaveAttribute("open","")`; the other
four → `not.toHaveAttribute("open","")`. Each assertion gained an
`expect(locator, "panel disclosure=[…]")` message so a loop failure still names
the offending entry (a loop otherwise loses the per-line diagnostic the unrolled
form had).

## No assertion weakened — reasoning

Deriving `SECTION_RESET_NAMES` from `settingsResetPlan` would, on its own, make a
label rename self-fulfilling across all three specs. Mitigation:
`e2e/settingsBaseline.test.ts` re-types the 6 + 1 labels as literals and pins
their exact order. That is precisely the strength the specs used to carry
(literal lists), now in **one** place instead of five — so a rename still turns
something red, and turns exactly one thing red. `src/view/settingsResetPlan.test.ts`
remains a second, shape-level pin; nothing was removed from it.

The only *behavioural* delta is **additive**: the settings-tab card test now
asserts the six card headings in DOM order
(`.setting-item-heading .setting-item-name`), which previously existed only as a
stale prose comment. This is what makes the heading table load-bearing rather
than dead data. Verified green in a real Obsidian (below).

## Deviations from the recommended shape

- **Did NOT rewrite the ~25 `card("Performance")` / `resetButton("Node exclusion")`
  call sites** to go through the heading table. Rationale: `card("Performance")`
  reads better than `card(sectionHeading("performance"))`, these are *selectors*
  not assertions (a renamed card makes them fail loudly, not silently), and the
  AC scopes the change to counts + enumerated lists. The headings are still
  centralised and now DOM-asserted, so a rename is caught in one place.
- **Renamed one test title**: `"settings tab renders six framed section cards …"`
  → `"settings tab renders one framed card per section, headed and with plugin
  CSS applied"`. The literal "six" in the title was itself a hand-maintained
  baseline; `settingsResetPlan.ts` sets the "count-free copy" precedent. This
  changes a `--grep`-able string; noted here because nothing else flags it.

## Verification (actual results)

- `npm run check` (tsc strict) → **exit 0**.
- `npx tsc -p e2e/tsconfig.json` → **exit 0**.
- `npm test` (vitest) → **74 files / 992 tests passed** (was 986; +6 new).
- `npm run test:e2e` **ran successfully in this environment** (contrary to the
  brief's expectation):
  - `-- settingsUxVisual` → **15 passed** (3.5s), incl. the new heading assertion
    and the rewritten disclosure loop.
  - `-- settingsReset` → **19 passed** (5.2s) across `settingsResetReview` +
    `settingsResetVerify`.
  - Total 34/34 against a real Obsidian. Logs: `.tmp/e2e.log`, `.tmp/e2e2.log`.
- Harness mutation scan (`e2e/vaultTarget.test.ts`) green: the two new files use
  no `fs` at all, and no `OUT_DIR` / `VAULT_COPY_DIR` / `SANDBOX_CONFIG_DIR`
  identifier or `mkdirSync` call site was touched.

## Out of scope → filed, not patched

`nid_g4iae40tww9abtwrexdrvic0y_e` (chore, p3) — the three specs still duplicate
`openSettingsTab` / `card` / `resetButton` / `confirmDialog` / `readGlobals`, and
`settingsResetVerify` has a divergent local `setTheme("moonstone"|"obsidian")`
against `harness.setTheme("light"|"dark")`. Ticket records the `vaultTarget.test.ts`
`OUT_DIR` constraint and the `mode: "serial"` no-reorder rule for whoever takes it.

Default-value literals (`nodeCap` 100, `outlineMaxDepth` 2, …) were left alone —
already covered by the pre-existing research ticket on per-setting plumbing cost.

## Review round 1 dispositions

| Finding | Disposition | What changed |
|---|---|---|
| **S-1** — compile-time guard run by no command | **ACCEPTED** | `package.json`: `"check:e2e": "tsc -noEmit -p e2e/tsconfig.json"`, `"check": "tsc -noEmit && npm run check:e2e"`. `scripts/run-e2e.sh`: its own `npx tsc -p e2e/tsconfig.json` line **removed** (WHY-NOT comment left in place) — both branches of that script already run `npm run build` → `check` → `check:e2e`, so keeping the line would only make every e2e run slower for zero extra coverage. `e2e/settingsBaseline.ts` comment now names `npm run check`. `CLAUDE.md` Commands line updated. |
| **S-2** — heading test asserts hand-written literals against a hand-written const | **ACCEPTED** | Deleted from `e2e/settingsBaseline.test.ts`. Agreed with the reasoning: the test had no independent authority (both sides live in `e2e/`) and made a card rename a two-file edit. The heading pin that *does* have authority is the DOM assertion in `settingsUxVisual.e2e.ts` — real Obsidian, verified green below. |
| **N-2** — two change-detector tests | **ACCEPTED** (suggestion, taken) | Deleted "heading and reset name are both present" (vacuous by construction) and "exactly one starts open" (restates the const's own literals). |
| *(beyond N-2, same criterion)* `EVERY_SETTINGS_RESET_NAME` ordering test | **DELETED** | It asserted `EVERY === [...SECTION, ALL]` — verbatim the const's own definition. The real order authority is the DOM `toEqual(EVERY_SETTINGS_RESET_NAME)` in `settingsResetReview.e2e.ts`. |
| **N-1** — panel disclosures have no exhaustiveness pin | **DEFERRED → ticket** `nid_vqw34wdpmb5qzn52cy6qugqgd_e` | Out of scope for the DRY ticket; needs a scoped (direct-child) count to avoid the conditional / nested disclosures. |
| **N-3** — `ALL_SETTINGS_RESET_CONFIRM_TITLE` mirrors src's `` `${label}?` `` | **REJECTED (no change)** | Deriving it needs a `SettingsWriteContext`, which cannot be built from `e2e/`. The reviewer agrees it is a reasonable 80/20; recording it as the conscious choice they asked for. |

**Surviving test file** — `e2e/settingsBaseline.test.ts` is now 2 tests, both pinning
values **derived from `src`** (the 6 section reset names, the tab-wide reset name).
The file's docstring states the retained criterion: a literal here is only worth
writing when it is an independent second opinion on derived copy. **No assertion was
weakened** — the deleted tests were all same-file tautologies added by this branch,
never assertions the specs previously carried.

**Guard re-proved under the new command**: deleting the `performance` key made
`npm run check` exit **2** with
`e2e/settingsBaseline.ts(41,7): error TS2741: Property 'performance' is missing …`
(restored; `npm run check` exit 0 again).

**Pre-existing e2e red — verified and ticketed, not fixed.** Ran
`npm run test:e2e -- vicinityGraph` in a **clean `main` worktree** (`d10b817`,
node_modules symlinked, `OBSIDIAN_PATH` reused): **13 passed, 1 failed**, the same
`vicinityGraph.e2e.ts:160` breadcrumb timeout. `git diff --stat main...HEAD -- src/`
is empty. Confirmed pre-existing → ticket `nid_yccejkvl0ccqc77olsgg5deka_e` (bug, p2)
with the failure output attached. Worktree removed.

## Round-1 verification (actual results)

- `npm run check` (now src + e2e) → **exit 0**.
- `npm test` → **74 files / 988 tests passed** (992 − 4 deleted tautologies).
- `npm run test:e2e -- settingsUxVisual settingsReset` (real Obsidian; filter matches
  `settingsUxVisual.e2e.ts`, `settingsResetReview.e2e.ts`, `settingsResetVerify.e2e.ts`)
  → **34 passed (8.2s), exit 0**. This run also exercised the run-e2e.sh change (the
  e2e type-check now happens inside `npm run build`). Log: `.tmp/r1_e2e_settings.log`.
- Full `npm run test:e2e` still red on `vicinityGraph.e2e.ts:160` only — pre-existing,
  ticketed above.

## Not done (owner: TOP_LEVEL_AGENT)

- No `change_log` entry written (per brief).
- Ticket `nid_3399ajdcy5lq21lx5v0jxh9i4_e` left **open** for the review stage to
  close, matching the repo's prior pattern (`e3ae56c`).
