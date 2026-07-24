# IMPLEMENTATION REVIEW — ticket-04 force-layout tuning sliders (PUBLIC)

Reviewed commit: `3291aaf` (`feat(ticket-04): force-layout tuning sliders — native-parity 4 + advanced spacing, live re-layout, restore defaults`)
Range considered: `bed6ca8..3291aaf` (post ticket-03 merge).

## Verdict: **APPROVED-WITH-MINORS**

0 BLOCKING · 0 MAJOR · 2 MINOR · 1 NIT. The implementation is complete,
well-layered, and the "no default behavior change" requirement — including the
tricky Link-force override — holds up under independent scrutiny. The two
minors are cheap test/compile-guard hardenings; neither blocks landing.

## Test-run results (run by reviewer, not trusted from claims)

| Command | Result | Log |
|---|---|---|
| `npm test` | PASS — 60 files / 722 tests | `.tmp/t04-review-test.log` |
| `npm run check` (tsc strict) | PASS — clean | `.tmp/t04-review-check.log` |

No `sanity_check.sh` exists in this repo (checked).

## Deep-verification highlights

- **Link force default reproduces d3's default exactly (the flagged risk)** —
  `src/view/d3ForceRefinement.ts` replicates d3 forceLink's internal per-node
  link count (`linkCountById`, both endpoints incremented per link) and sets
  `.strength(link => linkStrengthFactor / min(count(source), count(target)))`.
  At the default factor `1` this evaluates the identical expression d3 uses
  when strength is left unset — per-link, degree-dependent, NOT a flat
  constant. Compounding evidence: the untouched ticket-03 stranding test is
  green, and `GraphLayoutRunner.test.ts` asserts explicit-defaults positions
  equal omitted-parameter positions.
- **Ticket-03 stranding test unmodified** — `src/view/d3ForceStranding.test.ts`
  does not appear anywhere in `git diff bed6ca8..3291aaf`; it passes; it flows
  through `GraphLayoutRunner.layout(elkRoot)` whose default param equals the
  engine defaults, which a dedicated guard test pins to the exact ticket-03
  constants (0.05 / 300 / 1 / 40 / 20 / 40).
- **Defaults sit on slider step grids** — all six defaults are reachable from
  each range's min by integer steps (e.g. 0.25 + 15·0.05 = 1.0).
- **Live path traced end-to-end** — slider → `global-force-layout` interaction
  → `planSettingsWrite` (whole-object merge) → `saveGlobalView` →
  `refreshOpenViews()` → rebuild → `decideLayout` value-equality forces
  `"relayout"` → controller passes `graph.viewSettings.forceLayout` to the
  runner; elk spacing travels via the graph's resolved viewSettings.
- **Engine purity intact** — new engine code imports only `./types`; ranges,
  defaults, and clamping single-sourced in `src/engine/constants.ts`
  (`FORCE_LAYOUT_RANGES`, per-field WHY comments); the persistence parser
  clamps with the same table, closing the hand-edited-JSON path.
- **No lost functionality** — every removed view constant reappears with the
  same value as an engine default or option factory; WHY comments migrated;
  internal knobs (`D3_FORCE_COLLIDE_ITERATIONS`, `ELK_GROUP_PADDING`, elk seed
  params, alphaDecay) untouched per ticket; no `ap_` anchors removed; all test
  diffs are pure additions (no weakened/removed behavior tests).

## Acceptance-criteria checklist

| Criterion | Status | Evidence |
|---|---|---|
| 4 native-parity sliders, native names | **MET** | `src/view/VicinityGraphSettingTab.ts` `renderForceLayout()` — "Center force", "Repel force", "Link force", "Link distance" |
| Advanced section: Node spacing, Group member spacing | **MET** | Same file — native `<details>`/`<summary>` "Advanced spacing" with both sliders |
| Ranges clamp degenerate combos unreachable | **MET** | `src/engine/constants.ts` `FORCE_LAYOUT_RANGES` + `clampForceLayoutSettings`; parser clamps too (`src/persistence/persistedShapes.ts` `parseForceLayout`); anti-collapse invariant `centerPull.max 0.15 < linkStrength.min 0.25` asserted in `src/engine/forceLayoutSettings.test.ts` |
| Live effect, no plugin reload | **MET** | `src/view/GraphStructureDiff.ts` `sameForceLayout` relayout trigger (+2 BDD tests); `refreshOpenViews()` after every settings write |
| Defaults = ticket-03 values; restore-defaults affordance | **MET** | Defaults guard test pins exact values; "Restore force layout defaults" button resets all 6 and re-renders |
| Tests across write-plan/persistence/resolver; test+check pass | **MET** | +2 resolver, +5 persistence, +1 write-plan, +2 diff, +2 runner, +2 elk-mapping tests; both commands pass (reviewer-run) |
| Stranding metric test unmodified and green at defaults | **MET** | Not in commit range; passes in reviewer's run |

## Findings

| # | Severity | Location | Description | Suggested direction |
|---|---|---|---|---|
| 1 | MINOR | `src/view/GraphViewController.ts:213` / `src/view/GraphViewController.test.ts:88` | The single line forwarding `graph.viewSettings.forceLayout` into the layout runner is untested: the test fake declares `layout(graph: ElkNode)` and ignores the optional second arg. Removing the argument keeps all 722 tests green while the 4 d3 sliders silently become no-ops (the optional-param-with-default design's silent-fallback trap; the elk-spacing knob would mask it by still working). | Have the fake record the received `forceLayout` and add one BDD assertion that a rebuild forwards the resolved settings. |
| 2 | MINOR | `src/view/GraphStructureDiff.ts` (`sameForceLayout`) | Third hand-enumeration of the 6 fields, and the only one with no compile-time exhaustiveness: `clampForceLayoutSettings`/`parseForceLayout` return whole objects (a 7th field is a compile error there), but a field missed in this `&&` chain compiles fine — that future slider would never trigger live relayout. | Derive keys from `FORCE_LAYOUT_RANGES` (`Object.keys(...) as (keyof ForceLayoutSettings)[]` + `.every(k => a[k] === b[k])`) or add an exhaustiveness guard. |
| 3 | NIT | `src/view/VicinityGraphSettingTab.ts` (`addForceLayoutSlider`) | Each slider drag tick persists + triggers a full relayout rebuild. Consistent with the existing depth-slider pattern (consistency wins), and acceptable for a tuning harness — only worth a debounce if real-vault tuning feels janky. | None required; revisit only if observed. |

## Not verified (scope notes)

- `npm run test:e2e` (release gate) and visual rendering of the `<details>`
  Advanced block inside Obsidian's settings tab were not exercised — the human
  will see both during the intended real-vault tuning pass.
- The implementer's HEAD-worktree byte-identical position-dump probe was
  deleted per their doc; taken on trust, but independently compensated by the
  analytic link-strength verification and the threading tests above.

#QUESTION_FOR_HUMAN: none — no ambiguities requiring alignment were found.
