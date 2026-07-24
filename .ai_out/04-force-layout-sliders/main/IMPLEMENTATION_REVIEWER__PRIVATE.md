# IMPLEMENTATION_REVIEWER — ticket-04 (PRIVATE memory)

Fresh review (no prior PRIVATE existed). Reviewed commit `3291aaf`
(feat(ticket-04)) against ticket `_tickets/04-expose-4-force-layout-sliders-mirroring-native-graph.md`
and the implementer's PUBLIC doc. Verdict: **APPROVED-WITH-MINORS** (0 blocking,
0 major, 2 minor, 1 nit).

## What I verified myself (do not re-do unless code changed)

- **Test runs (mine, not trusted claims)**: `npm test` → 60 files / 722 tests
  PASS; `npm run check` → clean. Logs: `.tmp/t04-review-test.log`,
  `.tmp/t04-review-check.log` (also the raw background-task output). No
  `sanity_check.sh` in repo root.
- **Stranding test untouched**: `git diff bed6ca8..3291aaf` contains NO change
  to `src/view/d3ForceStranding.test.ts` (checked via pathspec + full --stat
  list). It calls `new GraphLayoutRunner().layout(elkRoot)` (line 89) — the new
  optional param defaults to `EngineDefaults.forceLayoutSettings()` which the
  defaults-guard test pins to the exact ticket-03 constants (0.05/300/1/40/20/40).
- **Link force default is genuinely d3-default-preserving** (the scrutiny point):
  `d3ForceRefinement.ts` builds `linkCountById` from the links array (each link
  increments both endpoints), then `.strength(link => factor / min(count(src),
  count(tgt)))`. At factor 1 this is exactly d3's internal default
  `1 / min(count(source), count(target))` — NOT a flat constant. Strength
  callback runs post-initialize so `link.source` is a ForceBody; `linkCountOf`
  keys on `body.id`; `?? 1` fallback is unreachable-defensive (every strength
  call is for a link whose endpoints have count ≥ 1). Bit-identical claim holds
  analytically; implementer additionally did a HEAD-worktree position-dump diff
  (their claim, plausible, not re-run by me — the analytic argument + untouched
  green stranding test + GraphLayoutRunner.test "explicit defaults ⇒ identical
  positions" test suffice).
- **Defaults on slider step grids**: all 6 defaults are reachable from min via
  integer steps (checked arithmetic: 0.25+15·0.05=1.0 etc.).
- **Wiring end-to-end**: tab `addForceLayoutSlider` → `applyInteraction`
  (`global-force-layout`) → `planSettingsWrite` merges whole object over
  `ctx.globalView` → `store.saveGlobalView` → `this.plugin.refreshOpenViews()`
  (pre-existing, VicinityGraphSettingTab.ts:364) → rebuild → `decideLayout`
  value-equality check forces `"relayout"` → controller passes
  `graph.viewSettings.forceLayout` to runner (GraphViewController.ts:213) →
  d3 params via runner param, elk spacing via `graph.viewSettings` inside
  `vicinityGraphToElk`. Dual routes are documented WHY.
- **Persistence**: version stays 2; `parseForceLayout` repairs partial shapes
  from defaults + clamps with the SAME `FORCE_LAYOUT_RANGES` table; non-object
  → inherit (undefined). Backward-compat test present ("old data.json lacks
  forceLayout THEN engine default"). Round-trip, mangled, clamp, non-object,
  missing — all 5 covered in persistedShapes.test.ts.
- **Engine purity**: new engine code (`constants.ts`, `types.ts`) imports only
  `./types` — no obsidian/react/d3. importGuard untouched.
- **Layering**: view receives values via param/graph; ranges + defaults +
  clamp single-sourced in `src/engine/constants.ts` (FORCE_LAYOUT_RANGES with
  per-field WHY comments incl. anti-collapse invariant, asserted by test
  `centerPullStrength.max (0.15) < linkStrengthFactor.min (0.25)`).
- **No lost functionality**: removed view constants (D3_FORCE_CHARGE_STRENGTH
  -300, D3_FORCE_LINK_GAP_PX 40, D3_FORCE_COLLIDE_PADDING_PX 20,
  D3_FORCE_CENTER_PULL_STRENGTH 0.05, ELK_NODE_SPACING "40",
  ELK_FORCE_ROOT_OPTIONS/ELK_GROUP_MEMBER_OPTIONS) all reappear as engine
  defaults / option factories with same values; WHY comments migrated.
  D3_FORCE_COLLIDE_ITERATIONS + ELK_GROUP_PADDING stay internal per ticket.
  No `ap_` anchors touched. No behavior tests removed/weakened (checked the
  full 29-file --stat; all test diffs are pure additions).
- **AC checklist**: all 7 MET (see PUBLIC file table).
- **UI**: slider names exactly match native graph (Center force / Repel force /
  Link force / Link distance); Advanced = native `<details>`/`<summary>`
  "Advanced spacing" with Node spacing + Group member spacing; restore-defaults
  button applies `EngineDefaults.forceLayoutSettings()` then `this.display()`.
  Slider pattern (fresh store read per change, void applyInteraction) mirrors
  the existing addDepthSlider — consistent.

## Findings (detail)

1. **MINOR — controller→runner threading unguarded**: the one-line pass at
   `src/view/GraphViewController.ts:213` (`, graph.viewSettings.forceLayout`)
   has no test. The fake in `GraphViewController.test.ts:88` declares
   `layout(graph: ElkNode)` and ignores the optional second arg. Deleting the
   argument keeps ALL 722 tests green while the 4 d3 sliders silently become
   no-ops (elk spacing knob would still work — travels via the graph). This is
   the exact silent-fallback trap of the optional-param design the implementer
   chose in decision 5. Cheap fix: fake records the received `forceLayout`; one
   BDD assertion that a rebuild forwards `graph.viewSettings.forceLayout`.
2. **MINOR — third field-enumeration site without compile guard**:
   `sameForceLayout` (GraphStructureDiff.ts) hand-lists all 6 fields in an `&&`
   chain. Unlike `clampForceLayoutSettings`/`parseForceLayout` (whole-object
   returns — a 7th field is a compile error there), a missed field here compiles
   fine and that future slider just never triggers live relayout. Fix direction:
   derive keys (`Object.keys(FORCE_LAYOUT_RANGES) as (keyof ForceLayoutSettings)[]`)
   and `.every(k => a[k] === b[k])`, or a `satisfies`-style exhaustiveness trick.
3. **NIT — per-drag-tick rebuild**: slider onChange persists + full
   rebuild-with-relayout per tick. Consistent with existing depth-slider
   pattern (POLS/consistency wins) and acceptable for a tuning harness; note
   only if real-vault tuning feels janky (then debounce at applyInteraction).

## Open threads / not checked

- Did NOT run `npm run test:e2e` (release gate, not requested) nor manually
  drive Obsidian UI — slider rendering (`<details>` styling inside settings
  tab) unverified visually. If human wants, a PLAYWRIGHT pass could confirm.
- Implementer's HEAD-worktree byte-diff probe: taken on trust (deleted per
  their doc); compensated by analytic verification above.
- CHANGELOG entry present (not scrutinized word-by-word). README bullet
  accurate vs implementation.

## Sign-off pass (iteration 1) — fresh instance, commit `7c19b78`

Scope: iteration diff only (`git show 7c19b78`). Verdict: **APPROVED**.

- **Reran myself**: `npm test` → 60 files / 729 tests PASS (722 + 7 new);
  `npm run check` → clean. Logs: `.tmp/t04-signoff-test.log`,
  `.tmp/t04-signoff-check.log`.
- **MINOR-1 genuinely fixed**: `FakeLayout` in `GraphViewController.test.ts`
  now implements the full port signature (`layout(graph, forceLayout?)`,
  matches `viewPorts.ts:53`) and records `lastForceLayout`; new BDD test uses
  NON-default `linkGapPx: 77` (a default value could pass coincidentally) and
  asserts `toEqual(forceLayout)`. Failing-first evidence verified myself:
  `.tmp/t04-iter-ctrl-fail.log` shows the exact test failing with
  `expected undefined to deeply equal { centerPullStrength: 0.05, … }` — the
  silent-fallback trap is now caught.
- **MINOR-2 genuinely fixed, exhaustiveness claim verified at the source**:
  `constants.ts:126` declares `FORCE_LAYOUT_RANGES:
  Readonly<Record<keyof ForceLayoutSettings, ForceLayoutRange>>` — so a 7th
  field is a compile error in the ranges table, and `FORCE_LAYOUT_FIELDS =
  Object.keys(FORCE_LAYOUT_RANGES) as readonly (keyof ForceLayoutSettings)[]`
  auto-includes it in `sameForceLayout`'s `.every`. Export path clean
  (engine `index.ts:94`, view→engine via index — correct layering direction).
  Runtime backstop `it.each` uses `range.max + 1` (guaranteed ≠ any in-range
  value). Original single-field + identity-differs tests untouched.
- **NIT-3 rejection ACCEPTED**: my own prior suggested direction was "None
  required; revisit only if observed"; rejection rationale (consistency with
  depth-slider pattern, debounce = speculative complexity, wholesale-if-ever)
  matches it exactly.
- **Stranding test still unmodified**: `git show HEAD --stat` lists only 6
  files (3 src/test + 3 .ai_out docs); `d3ForceStranding.test.ts` absent;
  green in my run.
- **No new issues opened**: only production change is the `sameForceLayout`
  rewrite — semantics-preserving, covered by old + new tests.

## Method notes for future clone

Diff extracts live in `.tmp/t04-rev-diff-{engine,view,persist-tab,tests}.txt`
(regenerate via `git show 3291aaf -- <paths>`). Env prints noisy bash preamble —
ignore. Use `git diff bed6ca8..3291aaf` for the whole-ticket range (bed6ca8 =
ticket-03 merge).
