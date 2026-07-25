# DOC_FIXER — PRIVATE

## Scope
Single flagged staleness: `ControlsActionsPort` doc comment in `src/view/viewPorts.ts`.

## What was stale
1. "resolves the target `TFile`" — executor now takes a `VaultPort` (`VaultFilePort`), no `App`/`TFile`.
2. "then triggers an immediate rebuild" / "then rebuild" on each method — unconditional, but
   `ControlsActions` gates on `WriteOutcome` ("not-persisted" ⇒ no rebuild) and branches on
   `settingsWriteScope` (global ⇒ `ViewsRefreshPort.refreshAllViews()`, per-doc ⇒
   `OwningViewPort.handleSettingsChanged()`). Pin/unpin always fan out (pinned set lives in data.json).

## Decisions
- Mirrored `ControlsActions` header wording/tone (landed-vs-not, blast radius, pointer to
  `settingsWriteScope.ts`) rather than re-explaining the mechanism — DRY across the two comments;
  the port doc says WHAT a caller can rely on, the impl doc keeps the WHY-NOT detail.
- `unpinNode` kept the "always lands" phrasing from its impl comment (`unpinDoc` reports no verdict).
- No `ap_XXX_E` anchors present in the touched region; none added (nothing referenced from notes).
- Comment-only; no executable code or tests touched. No other doc found repeating the stale claims.

## Verification
`npm run check` → 0. `npm test` → 70 files / 938 tests passed. Logs in `.tmp/doc-fixer-{check,test}.log`.
