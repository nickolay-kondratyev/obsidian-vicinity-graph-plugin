# PHASE C — IMPLEMENTATION_REVIEW (public)

(Phase A/B public reviews archived at `PHASE_A_REVIEW__PUBLIC.md` /
`PHASE_B_REVIEW__PUBLIC.md`.)

## VERDICT: APPROVE-WITH-NITS

Blocking: **0**. Docs + tickets only; `npm run check` EXIT 0
(`.tmp/reviewC-check.log`); no product/engine/view/manifest/package/versions code
touched (scope discipline holds). Every risky README claim was cross-checked
against source and is accurate — most importantly the settings-model section (the
"users will ask" section), correct down to the centralDepths nuance.

## What was verified true (highlights)
- **Settings model = SHIPPED behavior.** Pin-on-toggle per-field with no
  equality-to-default check (`settingsWritePlan.ts:11-14` + `planSettingsWrite`),
  reset deletes the field → inherit (`DocDataMutations.setDepthField` /
  `setOrRemove`), a pinned central's depth adjusted while viewing note Y is stored
  in **Y's** doc data keyed by the pinned id (`setCentralDepthField(mainFile,
  centralDocid, …)` → `doc.centralDepths[centralDocid]`), pinning = extra global
  central surviving restart. README §Settings matches all of it.
- **Dev flow works from README alone.** submodule init → install →
  `setup:dev-vault` (runs `npm run build`, copies artifacts, idempotent) → `dev`.
  Every command exists in `package.json`; order correct. (Exit criterion met.)
- **Scope/roadmap faithful** to `high-level-plan.md` (lines 3, 14-19, 129-135).
- **CSS fix matches the closed ticket** (`graph-view.css`: pin-button
  `pointer-events:none` hidden → `auto` on hover/focus + `@container
  (min-height:72px)` gate).
- **Release checklist** factually correct on Obsidian requirements (7 manifest
  fields, versions.json `{version:minAppVersion}` shape, raw-asset release with
  tag == raw version, obsidian- id-prefix DEFERRED not fix-now, store submission
  out of scope, KSAL note).
- **Ticket triage** correct: hover-pin `_tickets/` YAML frontmatter open→resolved
  (id preserved) with an accurate Phase B1 pointer; new culling-smoke ticket uses
  the existing `docs-internal/tickets` `# Ticket:` / `**Status:**` format. No
  ticket wrongly closed.

## Findings

| # | Tag | File:line | Finding |
|---|-----|-----------|---------|
| 1 | [NIT] | `README.md:100` | V1-scope sizing bullet trims the plan's trailing clause "once the data format settles" (→ "per-view sizing overrides come later"). Semantically intact and the dropped idea reappears verbatim-ish in the V2 bullet "(the data format is already shaped for it)", so nothing is lost. Optional to restore for exact fidelity. |
| 2 | [NIT] | `README.md:28` | Public README ships with `> Screenshots: TBD.` Honest (no binaries source-controlled; `.out/` gitignored) so not a false claim, but a screenshot-less public README reads slightly unfinished. Consider a follow-up ticket to add one before any store push. |

No `#QUESTION_FOR_HUMAN`. Nothing blocking; both NITs are optional and do not gate
commit.
