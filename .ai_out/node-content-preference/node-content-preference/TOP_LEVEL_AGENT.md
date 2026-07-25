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
| IMPLEMENTATION wave A (plan phases 1–2) | IMPLEMENTATION | DONE — `7b9995a`, `f065510` |
| IMPLEMENTATION_REVIEW wave A | IMPLEMENTATION_REVIEWER | DONE — APPROVED, 0 blocking |
| IMPLEMENTATION wave B (plan phases 3–4) | UX_UI_IMPLEMENTATION | DONE — `2ded9db`, `c50ed40` |
| IMPLEMENTATION_REVIEW wave B | IMPLEMENTATION_REVIEWER | DONE — APPROVED-WITH-FOLLOWUPS, 0 blocking |
| IMPLEMENTATION wave C (plan phase 5) | IMPLEMENTATION | DONE — `ac27f8d` |
| IMPLEMENTATION_REVIEW final | IMPLEMENTATION_REVIEWER | DONE — NEEDS-ITERATION, 1 blocking (e2e regression) |
| IMPLEMENTATION_ITERATION round 1 | IMPLEMENTATION | DONE — `1623084` (B1 root fix + S1/S2) |
| CONFIRMATION | IMPLEMENTATION_REVIEWER | DONE — **SHIP** |

## Final state

`change_log` entry: `jztbtexrke2bsbtiz1gargm0q`
(`_change_log/2026-07-25_04-27-28Z.md`) — the ONE entry for this whole flow.

**Verified by TOP_LEVEL_AGENT directly** (not taken on trust):
`npm run check` exit 0 · `npm run build` exit 0 · `npm test` 894 passed / 1
known-RED (`linkStrengthFactor.max`, author-only) · full `e2e/nodeOutline.e2e.ts`
via the repo wrapper, no `--grep`: **14 passed, exit 0**.

⚠ `npx playwright test` directly does NOT work (`OBSIDIAN_PATH is not set`) —
always go through `scripts/run-e2e.sh` / `npm run test:e2e`. I hit this myself
and briefly mistook it for a real failure.

**Branch NOT merged to `main`** — left for the human's decision (prior features
in this repo were merged via `git merge`, but merging was not requested here).

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

## Second human decision (during wave B review)

**Pill trough colour**: the reviewer measured the unselected trough
(`--background-primary`) as identical to both hosts' backgrounds, leaving only a
1px border to delineate the control. Human chose **`--background-modifier-form-field`**
(Obsidian's own form-field interior) so the pill reads as a real inset input.
Folded into wave C.
