---
id: nid_8p0nn2g34d97finokwlz3u1dt_e
title: "[decide] RESEARCH: cut the per-setting plumbing cost — one field currently costs ~15 files and ~8 hand-maintained lists"
status: open
deps: []
links: [nid_3k0a4zl6in0mj8lcjibkjq2dx_e, nid_niz5dz6uqeyv237ckm15ittqa_e, nid_abreq4lmpo8vnvf61y9k9yly0_e]
created_iso: 2026-07-25T14:37:25Z
status_updated_iso: 2026-07-25T14:37:25Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [settings, architecture, research, dx]
---

## Why this ticket exists

Adding ONE enum settings field (`nodePreviewPreference`, branch
`node-content-preference`) cost roughly **180 lines across 15 files** of pure
plumbing — separate from the feature logic it enabled. The human engineer flagged
this as disproportionate recurring cost and asked for a research pass on better
abstractions.

This is a **research/design ticket**: produce a recommendation + decision record,
not an implementation. Implementation should be split into follow-up tickets once
a direction is chosen.

## Measured evidence (from `git diff main..node-content-preference`)

Pure settings plumbing for one field, excluding feature logic and the pill UI:

| File | Lines | What had to be added |
|---|---|---|
| `src/engine/SettingsSpec.ts` | +11 | spec entry (default + allowed values) |
| `src/engine/constants.ts` | +1 | `EngineDefaults.viewSettings()` projection |
| `src/engine/types.ts` | (part of +41) | `ViewSettings` field + the enum union |
| `src/engine/ViewSettingsResolver.ts` | +1 | the explicit per-field return list |
| `src/engine/index.ts` | +2 | re-export |
| `src/persistence/persistedShapes.ts` | +8 | `parseViewOverride` clamp/validate branch |
| `src/view/settingsWritePlan.ts` | +5 | `SettingsInteraction` variant + `planSettingsWrite` case |
| `src/view/settingsResetPlan.ts` | +11 | reset scope plan + `ALL_SCOPE_DESCRIPTION` |
| `src/view/VicinityGraphSettingTab.ts` | +66 | the settings-tab row (much of it control markup) |
| tests: `persistedShapes.test.ts` +27, `settingsResolvers.test.ts` +17, `settingsResetPlan.test.ts` +18, `settingsWritePlan.test.ts` +10, `SettingsSpec.test.ts` +3 | ~75 | per-field enumeration cases |

## Root cause (the thing to actually fix)

**A settings field has no single declaration.** Its identity is smeared across
~8 *hand-maintained parallel lists* that must independently agree:
`SETTINGS_SPEC.globalView`, `EngineDefaults.viewSettings()`, the `ViewSettings`
interface, `ViewSettingsResolver`'s explicit return object, `parseViewOverride`,
`SettingsInteraction`/`planSettingsWrite`, `SETTINGS_RESET_SCOPES` +
`ALL_SCOPE_DESCRIPTION`, and the settings-tab render method.

Most of those fail **silently** when you forget one — the field just resolves to
`undefined`, or a reset quietly doesn't reset, or a test passes vacuously.

## This is already causing real bugs — three open tickets are the same root cause

- `nid_abreq4lmpo8vnvf61y9k9yly0_e` — `SettingsSpec.test.ts` "exact shipped
  baseline" `toEqual` **silently omits `outlineMaxDepth`** (a live enumeration gap).
- `nid_3k0a4zl6in0mj8lcjibkjq2dx_e` — `EDGE_VISIBILITY_MODES` re-lists a union
  inside persistence with **no completeness guard**.
- `nid_niz5dz6uqeyv237ckm15ittqa_e` — `groupByFolder` / `edgeVisibility` are
  **orphan settings**: fully wired through type/persistence/resolver with **zero
  UI**, and nothing detected that.

Historical precedent: commit `c5583d5` ("wire the merged Node contents section
into restore-defaults") was exactly this failure mode — a settings card shipped
with no reset row and it compiled fine. The existing
`_assertEveryResetScopePlaced` guard catches an *orphaned* scope but NOT a
*missing* one.

Also note: three e2e files
(`e2e/settingsResetReview.e2e.ts`, `e2e/settingsResetVerify.e2e.ts`,
`e2e/settingsUxVisual.e2e.ts`) each hardcode their own
`.vicinity-graph-settings-section` count and exact reset-button name lists, with
no shared constant — a known, deliberately-deferred DRY target that belongs in
this analysis.

## Candidate directions to evaluate (evaluate, don't assume)

**Option A — compile-time completeness guards only (cheapest, high value)**
Make omission a *type error* instead of a silent default: e.g.
`satisfies Record<keyof ViewSettings, ...>` on the resolver's return, the parser's
branch table, and the spec object; derive the enumeration test literals from the
spec instead of hand-listing them. Structurally changes nothing, kills the entire
silent-omission bug class. Likely the PARETO winner.

**Option B — one field descriptor, derive the rest**
Declare a field once (`key`, `default`, allowed values/bounds, `label`,
`description`, reset scope, parser) and derive spec + defaults + parse + resolver
+ reset plan from it. Largest reduction in per-field cost; largest blast radius;
must not regress the deliberate `ViewSettings` / `ViewSettingsOverride` split
(absent = inherit) or the engine's purity rules.

**Option C — declarative control rendering for both surfaces**
Today a mirrored setting shares data (`*FieldMeta`) but hand-duplicates markup,
because Obsidian's `Setting` API cannot mount inside React. Evaluate one
descriptor → two thin renderers (tab `Setting` builder + panel JSX component),
which would also fix the missing "every field has a controls-panel row" parity
guard (`outlineMaxDepth` and `edgeVisibility` have no panel row and no test
notices).

**Option D — property-based invariant tests instead of per-field cases**
Replace hand-enumerated `toEqual` literals and per-field cascade/parse cases with
tests that iterate the spec, so a new field is covered the moment it is declared
and `TUNED_VIEW`-style fixtures cannot go vacuous.

**Option E — accept the cost** (the honest baseline: document the checklist well
and stop there). Include this in the comparison so the recommendation is real.

## Constraints any solution MUST respect

- `src/engine/` and `src/shared/` stay pure: no `obsidian` / `obsidian-id-lib` /
  `react` imports (guarded by `src/engine/importGuard.test.ts`).
- Layering `view -> adapters -> engine`; persistence implements engine-defined ports.
- The `ViewSettings` / `ViewSettingsOverride` cascade (main-doc override -> pinned
  -> global, absent field = inherit) is deliberate and must survive.
- `PERSISTED_SHAPE_VERSION` must not be bumped for additive fields with a spec
  default (bumping would discard every user's stored globals).
- Prefer compile-time checks over runtime (repo standard). Prefer KISS/PARETO —
  do NOT build a settings framework.
- Restore-defaults semantics: only scopes that destroy user-authored content confirm.

## Design

Start by re-deriving the touch-point list from the actual source (do not trust this ticket's table blindly - verify), then cost each option in (a) lines saved per future field, (b) bug classes eliminated, (c) blast radius / migration risk. Recommend ONE direction, or an ordered combination (Option A + D look independently cheap and may capture most of the value without the restructuring of B/C). Ground the recommendation in the three existing symptom tickets: a good solution should make each of them either impossible or trivially detected.

## Acceptance Criteria

1) A written comparison of the options with the measured per-field cost before/after each. 2) A single recommended direction with explicit rationale, and explicit rejection rationale for the others (including why NOT to build a full settings framework if that is the call). 3) Confirmation the recommendation preserves every constraint listed in the description. 4) Follow-up implementation tickets created for the chosen direction, split so each fits one agent's context. 5) An explicit statement of which of the three existing symptom tickets the recommendation resolves, and which it does not.


## Notes

**2026-07-26T15:30:39Z**

[decide] Research can be executed by an agent, but CLOSING it requires the owner to pick among options A-E, which differ hugely in blast radius (compile-time completeness guards vs. a field-descriptor rewrite vs. accepting the cost). No research artifact exists yet; the three linked symptom tickets are all still open.
