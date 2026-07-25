# TOP_LEVEL_AGENT — node-content-preference

Feature: `node-content-preference` · Branch: `node-content-preference`

## Task (from ask.dnc.md)

Allow users to smoothly choose whether they want to view the **outline** (when
present and it fits) or an **image**. Add a **PILL** setting for that choice,
exposed in **both** the settings tab and the in-graph controls. The setting
**takes precedence** over the existing "show image if the image comes before the
outline" rule.

## Flow status

## Human-approved decisions (CLARIFICATION)

1. **3-way pill**: `Auto` / `Outline` / `Image` — `Auto` preserves today's
   document-position rule, so **nothing is removed**.
2. **Default `Auto`** — upgrades look identical until the user opts in.
3. **Global scope only** — both surfaces edit one `globalView` value.

See `CLARIFICATION__PUBLIC.md` for the binding requirement list.

| Phase | Role | Status |
|---|---|---|
| EXPLORATION | Explore ×2 | DONE |
| CLARIFICATION | TOP_LEVEL_AGENT | DONE (human-approved) |
| DETAILED_PLANNING | PLANNER (THINK_HARDER) | DONE |
| DETAILED_PLAN_REVIEW | PLAN_REVIEWER | DONE — approved, 0 blocking, 7 inline fixes |
| PLAN_ITERATION | PLANNER ↔ PLAN_REVIEWER | **SKIPPED** (reviewer signalled not needed) |
| IMPLEMENTATION wave A (plan phases 1–2) | IMPLEMENTATION | RUNNING |
| IMPLEMENTATION_REVIEW wave A | IMPLEMENTATION_REVIEWER | pending |
| IMPLEMENTATION wave B (plan phases 3–4) | IMPLEMENTATION | pending |
| IMPLEMENTATION_REVIEW wave B | IMPLEMENTATION_REVIEWER | pending |
| IMPLEMENTATION wave C (plan phase 5) | IMPLEMENTATION | pending |
| IMPLEMENTATION_REVIEW final | IMPLEMENTATION_REVIEWER | pending |

## Implementation waves (why split)

The approved plan has 5 phases. Delegated in 3 serial waves — code-modifying
agents must never overlap (merge conflicts), and splitting keeps each agent well
clear of compaction.

| Wave | Plan phases | Content |
|---|---|---|
| A | 1–2 | Decision moves downstream (adapter reports `imagePrecedesOutline`); setting end-to-end. **Zero behavior change.** |
| B | 3–4 | Settings-tab row + shared copy + CSS; controls-panel section. |
| C | 5 | Docs, e2e, tickets. |

**Baseline note**: `linkStrengthFactor.max` in `SettingsSpec.test.ts` is a
known-RED pre-existing failure (author-only per its ticket) — every implementer
is told not to touch it and not to attribute it to their work.

## Artifacts

- `EXPLORATION__CONTENT_RULES__PUBLIC.md` — image/outline decision + fits logic
- `EXPLORATION__SETTINGS_CONTROLS__PUBLIC.md` — settings model, pill pattern, controls panel
- `EXPLORATION_PUBLIC.md` — index of the above (written by TOP_LEVEL_AGENT)
