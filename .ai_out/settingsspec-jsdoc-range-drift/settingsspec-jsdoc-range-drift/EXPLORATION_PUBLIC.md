# EXPLORATION_PUBLIC — SettingsSpec JSDoc range drift

Ticket: `nid_2yygojiqkdi9hp73pgv0w7qfu_e` (`_tickets/linkstrengthfactor-jsdoc-documents-025-2-but-spec-ships-max-4.md`)

> Report produced by the Explore sub-agent (read-only; it could not write files, so
> TOP_LEVEL_AGENT transcribed its findings here verbatim in substance).
> **Line numbers are as-of branch base `3e85ecb` — re-verify before editing.**

## 1. Confirmed contradictions (the ONLY one)

| Setting | Spec values (line) | Prose claim (lines) | Verdict |
|---|---|---|---|
| `globalView.forceLayout.linkStrengthFactor` | `{ default: 1, min: 0.25, max: 4, step: 0.05 }` — `src/engine/SettingsSpec.ts:231` | ``[0.25, 2]`: min keeps links dominant over the max center pull (see above); above ~2 the stiff springs overshoot within the fixed-tick static run and the layout stops converging cleanly.`` — `src/engine/SettingsSpec.ts:227-229` | **CONTRADICTS on `max` only.** `min: 0.25` is correct in both places. |

**Important nuance for the fixer:** the stale prose is not a bare number — it carries a
*rationale* ("above ~2 the stiff springs overshoot … stops converging cleanly"). A
digit-swap `2` → `4` would leave an unsupported/incoherent justification. The rationale
must be rewritten honestly to match why `max: 4` is actually safe, or the claim dropped
if it cannot be substantiated. Check git history for the commit that raised the max.

## 2. Full per-setting audit — everything else matches

Every other bounded/defaulted entry in `src/engine/SettingsSpec.ts` has prose that either
matches its shipped `min`/`max`/`step`/`default` exactly, or states no numeric range at all
(not a contradiction):

`DEPTH_STEPPER_BOUNDS` {0,5,1} (:101) · `outgoingDepth`/`incomingDepth` default 1 (:124-125) ·
`NODE_SIZE_PX_BOUNDS` {1,400,4} (:115) · `nodeCap` {100,min 1} (:132) ·
`outlineMaxDepth` {2,1,6,1} (:141) · `nodePreviewPreference` "auto" (:147) ·
`groupByFolder` true (:149) · `edgeVisibility` "walked-from-center" (:155) ·
`sizing.metrics` — only `own-file-size` on, weight 1 (:159-163) ·
`metricWeight` {1,0,100,0.5} (:174) · `depthDecayK` {1,0,10,0.5} (:184) ·
`minPx` 40 (:185) · `maxPx` 160 (:186) · `centerPullStrength` {0.05,0,0.15,0.01} (:209) ·
`repelStrength` {300,50,1000,10} (:220) · `linkGapPx` {40,10,250,5} (:243) ·
`collidePaddingPx` {50,0,100,5} (:245-255) · `elkNodeSpacingPx` {40,10,120,5} (:265) ·
`edgeRoutingClearancePx` {11,6,14,1} (:266-294) · `nodeExclusion.enabled` false /
`patterns` [] (:299-300).

Notable: `centerPullStrength`'s JSDoc (:203-207) cross-references
`linkStrengthFactor` **min 0.25** — that cross-reference is accurate and must stay correct.

## 3. Drift check elsewhere in the repo — none found

- `src/engine/types.ts:271-273` — `linkStrengthFactor` JSDoc describes semantics ("`1` reproduces d3's built-in default"); states **no** numeric range. Not a contradiction.
- `src/view/forceLayoutFieldMeta.ts:25-28` — UI copy "Stiffness of the springs… 1 is the built-in default"; no numeric range. Slider bounds come from `FORCE_LAYOUT_RANGES`. No change needed.
- `README.md:75-80` — generic ("ranges are clamped so no combination can degenerate the layout"); no explicit bounds. No change needed.
- `docs-internal/architecture-map.md` — no mention of force-layout ranges.
- `src/engine/forceLayoutSettings.test.ts:64-68` — references only `linkStrengthFactor.min`; correct.
- `src/engine/constants.ts:116-128` — `FORCE_LAYOUT_RANGES` is a mechanical projection of the spec (verified by `SettingsSpec.test.ts:228-236`); carries no independent prose, cannot drift.
- `src/view/VicinityGraphSettingTab.ts` — reads bounds live from the ranges; no hard-coded prose.

**Conclusion: the JSDoc in `SettingsSpec.ts` is the single place needing a change.**

## 4. Authoritative pins (do not "fix" these — they are green and correct)

- `src/engine/SettingsSpec.test.ts:190` — baseline literal `linkStrengthFactor: { min: 0.25, max: 4, step: 0.05 }`. Re-pinned to `max: 4` in commit `258ec5a`.
- `src/engine/forceLayoutSettings.test.ts:15-23` — pins default `linkStrengthFactor: 1`.

Acceptance criterion 2 ("a sweep confirms no other SettingsSpec JSDoc range contradicts
its spec entry") is **satisfied by this audit** — no other contradiction exists.
