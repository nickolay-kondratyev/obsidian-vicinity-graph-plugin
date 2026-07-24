# MERGE_INTEGRATION — `node-outline` × settings restore-defaults refactor

Semantic integration pass over merge `9b786ab` (parents: `f57828b` main / `f0d11b0`
`node-outline`). The textual merge compiled and `npm run check` passed, but the two
branches each changed the settings tab in a way the other never saw.

## Verdict per task item

### 1. Per-section restore-defaults — **GENUINELY BROKEN → fixed**

Main's `3c86c7f` established the idiom: every `.vicinity-graph-settings-section` card ends
with `addSectionReset(section, <scope>)`, scope copy declared in `SETTINGS_RESET_SCOPES`.
The merged `renderNodeContents()` had **no** reset row — the only card of six without one.
README already claimed "**every** section ends with its own restore row", so the merge made
the README a lie.

Fixed by following the existing idiom exactly (no new variant):

- `src/view/settingsResetPlan.ts` — new `"node-contents"` scope: label
  `"Restore node contents defaults"`, description read from
  `SETTINGS_SPEC.globalView.outlineMaxDepth.default`, plan = one whole-object `global-view`
  write merging `outlineMaxDepth` back to spec default (byte-identical shape to the
  `performance` scope, which resets the other lone `global-view` scalar).
- Added to `SECTION_RESET_SCOPES` **after `node-sizing`**, matching settings-tab render
  order (that array's documented contract).
- `src/view/VicinityGraphSettingTab.ts` — `this.addSectionReset(section, "node-contents")`
  as the card's last row.

No confirmation for this scope: the established rule is that only scopes destroying
user-authored *content* confirm (exclusion patterns). Outline depth is a numeric knob, so
it applies instantly — and the pre-existing test "WHEN a section that only holds numeric
knobs is reset THEN it applies without a confirmation" iterates `SECTION_RESET_SCOPES` and
now covers it for free.

### 2. Tab-wide restore-defaults — **ALREADY CORRECT (traced, not assumed)**

The `all` scope plans a **whole-slice** write, `EngineDefaults.viewSettings()`, not a merge.
`EngineDefaults.viewSettings()` (`src/engine/constants.ts:160`) reads every field off
`SETTINGS_SPEC.globalView`, `outlineMaxDepth` included at line 164. So restore-all *did*
already reset it. That was luck of the whole-slice design, not intent.

It was however **untested**: `settingsResetPlan.test.ts`'s `TUNED_VIEW` claims in its
docstring to move "EVERY user-editable setting off its default", but `outlineMaxDepth` sat
at its default — so the strong assertion `toEqual(EngineDefaults.viewSettings())` passed
vacuously for that field. Fixed by adding `outlineMaxDepth: 5` to `TUNED_VIEW`, which
**strengthens** three pre-existing assertions rather than weakening any.

### 3. Confirmation-modal scope / honesty — **GENUINELY BROKEN → fixed**

`ALL_SCOPE_DESCRIPTION` **enumerates** the sections it clears ("depth defaults, node
sizing, force layout, node exclusion and performance"). That sentence is used verbatim both
as the footer row description and as the confirm modal's body. Post-merge it silently
omitted node contents while the reset *did* clear it — the modal understated its own blast
radius. Added "node contents" to the enumeration, in render order.

`ConfirmModal` itself needed no change; the honesty problem was entirely in the copy.

### 4. Section count / order assertions — **3 stale, all corrected upward**

| Location | Was | Now | Why this is not a weakened assertion |
|---|---|---|---|
| `e2e/settingsResetVerify.e2e.ts:59` | `toHaveCount(5)` | `6` | Written pre-merge on main. The 6th card (**Node contents**) legitimately belongs — it is a shipped feature with its own heading and control. This spec would have **failed** as merged. |
| `e2e/settingsResetReview.e2e.ts:75` | `toHaveCount(5)` | `6` | Same; same failure. |
| `e2e/settingsUxVisual.e2e.ts:159` | `toHaveCount(5)` + 5 names | `6` + 6 names | Passed as merged **because** the bug was real (only 5 reset rows existed). Raised because the fix adds the 6th legitimately. |
| `e2e/settingsResetReview.e2e.ts` aria-label list | 6 entries | 7 | `Restore node contents defaults` inserted in render order. |
| `e2e/settingsUxVisual.e2e.ts:127` | comment "Depths, sizing, node contents, **layout, force layout**, node exclusion" | actual six named | Comment was wrong on the `node-outline` branch (named a non-existent "layout" card, omitted Performance). Count itself was right. |

**Explicitly stated:** the new section legitimately belongs. It is a user-facing settings
card shipped by the `node-outline` feature, not test scaffolding — so raising 5 → 6 records
reality rather than accommodating a defect.

### 5. Other integration seams — **checked, all already fine**

Traced `outlineMaxDepth` through every seam main touched or introduced:

- **Write plan** (`settingsWritePlan.ts`) — `global-outline-depth` → `global-view` merge,
  present and tested. No gap.
- **Persistence parse** (`persistedShapes.ts`) — clamps via `clampOutlineMaxDepth`, with
  absent / non-numeric / 0 / 99 cases all covered. No gap.
- **Resolver** (`ViewSettingsResolver.ts`) — `outlineMaxDepth: field("outlineMaxDepth")`,
  main-override and pinned-fallback cases tested. No gap.
- **Persisted shape version** — correctly *not* bumped; the field is additive with a
  spec default.

### Bonus finding (documented, not silently patched)

Both branches independently filed a ticket for the same `22bd5cb` baseline drift:
`ticket-settings-baseline-tests-stale-after-spacing-change.md` (node-outline, OPEN) and
`ticket-settings-spec-baseline-tests-stale-after-node-spacing-bump.md` (settings, CLOSED).
Rather than delete either, the OPEN one now carries a one-line cross-reference so a reader
is not confused by two tickets on one commit.

## Files changed

- `src/view/settingsResetPlan.ts` — `node-contents` scope; `SECTION_RESET_SCOPES`;
  `ALL_SCOPE_DESCRIPTION`; doc "five cards" → "six".
- `src/view/VicinityGraphSettingTab.ts` — section reset on the Node contents card; three
  stale count comments (five→six cards, six→seven reset buttons).
- `src/view/settingsResetPlan.test.ts` — **+6 tests**, `TUNED_VIEW` strengthened.
- `e2e/settingsResetReview.e2e.ts` — counts, aria-label list, `dirtyEverySection` now
  genuinely dirties every section, new Node-contents isolation-matrix branch,
  `outlineMaxDepth` survival assertions across all sibling branches, restore-all coverage.
- `e2e/settingsResetVerify.e2e.ts`, `e2e/settingsUxVisual.e2e.ts` — counts, names, comment.
- `docs-internal/tickets/ticket-settings-baseline-tests-stale-after-spacing-change.md` —
  rewritten: 3 failures → the 1 that remains, cross-reference added.
- `docs-internal/CHANGELOG.md` — one clause on the existing `outlineMaxDepth` bullet (no new
  section).

## Tests added (BDD, all mutation-verified failable)

`src/view/settingsResetPlan.test.ts`:

1. WHEN the node-contents section is reset THEN the outline depth returns to its spec default
2. WHEN the node-contents section is reset THEN every other view field keeps its tuned value
3. WHEN the node-contents section is reset THEN neither the depths nor the exclusion are written
4. WHEN everything is reset THEN the outline depth is restored too
5. WHEN a section label is reduced to its noun THEN the noun is non-empty (anti-vacuity guard)
6. WHEN the tab-wide description is read THEN every section it resets is named in it

Test 6 is the general guard for the class of bug this merge produced: it derives each
section's noun from that section's own label, so a future section added without extending
the tab-wide sentence fails loudly instead of shipping a dishonest modal. Test 5 exists so
test 6 cannot pass vacuously via `includes("")`.

**Mutation verification** (each applied, run, reverted — `.tmp/mutate.py`, `.tmp/mutate2.py`):

| Mutation | Result |
|---|---|
| node-contents plan → no-op merge | RED (1 failed) ✔ |
| `all` plan preserves `ctx.globalView.outlineMaxDepth` | RED (3 failed, incl. the two strengthened pre-existing ones) ✔ |
| "node contents" dropped from the enumeration | RED (1 failed) ✔ |

e2e: the Node-contents isolation-matrix branch dirties `outlineMaxDepth` to 5, clicks the
new reset, and asserts it returns to 2 while all five sibling sections keep their dirty
values — it cannot pass unless the new button exists and is correctly scoped.

## Final status

### `npm run check` — **PASS** (`tsc -noEmit`, exit 0)

### `npm test` — **1 failure**, the known pre-existing one, unchanged

```
Test Files  1 failed | 66 passed (67)
     Tests  1 failed | 852 passed (853)
```

- **PRE-EXISTING (untouched, per instruction):** `src/engine/SettingsSpec.test.ts` › "WHEN
  the spec is read THEN its limits equal the exact shipped baseline" —
  `linkStrengthFactor.max` expected `2`, spec says `4`. Re-pinning is the author's call.
- **NEW failures: none.** Baseline before this work was 1 failed / 846 passed; now 1 failed
  / 852 passed (+6 new tests, all green).

### `npm run test:e2e` — **58 passed, 2 failed, 7 did not run**

- **PRE-EXISTING failure 1:** `edgeRoutingEval.e2e.ts:171` › "radial layout SKIPS routing
  (gated)…" — a routing pass of 138.6ms was measured where the gate should give
  `undefined`. Edge-routing territory; the radial gate is documented in
  `docs-internal/CHANGELOG.md`. Untouched by this work.
- **PRE-EXISTING failure 2:** `vicinityGraph.e2e.ts:160` › "singleton-folder note shows a
  folder breadcrumb…" — ticketed as `ticket-e2e-gamma-breadcrumb-fails-headless.md`.
- **7 did not run:** downstream of those two in `serial`-mode files (5 in
  `vicinityGraph.e2e.ts`, 2 in `edgeRoutingEval.e2e.ts`). Not settings tests.
- **NEW failures: none.** Every settings spec ran and passed: all 12
  `settingsResetReview` cases, all 8 `settingsResetVerify`, all 7 `settingsUxVisual` —
  including the three specs whose counts changed and the new isolation branch.

Neither pre-existing e2e failure can be attributed to this change: the diff touches only
`settingsResetPlan*`, `VicinityGraphSettingTab.ts`, three settings e2e specs and docs.

## Questions for human

None — no genuine conflict of intent was found between the branches. They agree on the
model (one card per section, one reset per card, whole-object `global-view` writes); the
new section simply predated the reset machinery on its own branch.
