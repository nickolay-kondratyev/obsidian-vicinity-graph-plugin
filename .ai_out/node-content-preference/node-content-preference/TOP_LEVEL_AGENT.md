# TOP_LEVEL_AGENT — node-content-preference

Feature: `node-content-preference` · Branch: `node-content-preference`

## Task (from ask.dnc.md)

Allow users to smoothly choose whether they want to view the **outline** (when
present and it fits) or an **image**. Add a **PILL** setting for that choice,
exposed in **both** the settings tab and the in-graph controls. The setting
**takes precedence** over the existing "show image if the image comes before the
outline" rule.

## Flow status

| Phase | Role | Status |
|---|---|---|
| EXPLORATION | Explore ×2 | RUNNING |
| CLARIFICATION | TOP_LEVEL_AGENT | pending |
| DETAILED_PLANNING | PLANNER | pending |
| DETAILED_PLAN_REVIEW | PLAN_REVIEWER | pending |
| PLAN_ITERATION | PLANNER ↔ PLAN_REVIEWER | pending |
| IMPLEMENTATION | IMPLEMENTATION | pending |
| IMPLEMENTATION_REVIEW | IMPLEMENTATION_REVIEWER | pending |
| IMPLEMENTATION_ITERATION | both | pending |

## Artifacts

- `EXPLORATION__CONTENT_RULES__PUBLIC.md` — image/outline decision + fits logic
- `EXPLORATION__SETTINGS_CONTROLS__PUBLIC.md` — settings model, pill pattern, controls panel
- `EXPLORATION_PUBLIC.md` — index of the above (written by TOP_LEVEL_AGENT)
