---
closed_iso: 2026-07-31T19:10:08Z
id: nid_ts4rx2pfo6o18verzk07z16g8_e
title: Depth for pinned nodes
status: closed
deps: []
links: []
created_iso: '2026-07-31T18:50:23Z'
status_updated_iso: 2026-07-31T19:10:08Z
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Right now when we are setting depth we are only setting depth for the central nodes.

We should have ability to set separate depth for the currently focused note VS the pinned notes. 

IF the pin node is currently central node then it uses central settings.

## Resolution (2026-07-31)

Implemented on branch `CC_nid_ts4rx2pfo6o18verzk07z16g8_e__depth-for-pinned-nodes_fable`, commit `fb9ea82`.

**Design — flat fields, per ROLE (never per note):**
- `DepthSettings` (`src/engine/types.ts`) now extends a new `ChannelDepths` interface (`linkDepthOut`/`embedDepthOut`/`linkDepthIn` — what a single traversal root consumes) and adds three flat fields: `pinnedLinkDepthOut`, `pinnedEmbedDepthOut`, `pinnedLinkDepthIn`. Flat fields were chosen over a parallel persisted `pinnedDepths` family so every `keyof DepthSettings` mechanism (rows, accessors, write plan, parser guard, section table, reset scopes, spec walks, parity/coverage tripwires) works unchanged.
- `DepthSettingsFacts.activeChannelDepths()/pinnedChannelDepths()` project role → `ChannelDepths`; `VicinityEngine.toRoots()` gives MAIN the active trio and every pinned root the pinned trio. `TraversalRoot.depths` narrowed to `ChannelDepths`; BFS untouched.
- **Pin == active note uses active settings** with zero new code: `GraphRequestAssembler` already drops a pin matching mainPath, and traversal's MAIN-first dedupe backstops it. Covered by a new engine test (pin the MAIN, split budgets, MAIN budgets win).

**Settings surface:** three new rows "Pinned links out / Pinned embeds out / Pinned links in" in a second panel block (`vicinity-graph-depth-controls--pinned`) declared once in `settingsRows.ts` — both presenters render them via the row model. Defaults ship at 1, equal to the active trio, so the split is invisible until a dial moves. Section heading renamed "Depth (all notes)" → "Depth". Persistence: parsed per-field with default fallback, no version bump (edgeRoutingClearancePx precedent).

**Tests:** new engine describe "active-vs-pinned depth budgets" (pinned frozen at 0 while MAIN walks; pinned reach beyond active; pinned-MAIN uses active); e2e `pinnedCentralScenario.e2e.ts` rewritten to prove each dial drives its role through the real UI; all locators disambiguated against the new `Pinned *` labels (`exact: true`, `:not(--pinned)` scoping). `npm run check` clean; `npm test` 1345/1347 — the 2 failures are PRE-EXISTING on a clean tree (elkNodeSpacingPx default mismatch, filed as ticket `nid_faeb5geo50afipdbwf1y2dz12_e`).

**Docs updated:** README (Depth section + pinning semantics), RELEASE_CHECKLIST (heading references + new entry), high-level-plan (per-role depth semantics).

Not done (deliberate): `npm run test:e2e` (Playwright against real Obsidian) was not run — it is the release gate, not part of `npm test`; the e2e specs type-check via `npm run check`.
