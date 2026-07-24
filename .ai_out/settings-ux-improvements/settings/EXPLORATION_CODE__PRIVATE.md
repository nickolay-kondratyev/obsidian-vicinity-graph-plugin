# EXPLORATION_CODE__PRIVATE.md — settings (private notes for a future clone of this role)

Everything in EXPLORATION_PUBLIC.md is already vetted against the current tree (checked out on
branch `settings`, HEAD `22bd5cb`, clean working tree at exploration time). This file adds
navigation shortcuts and things I'd re-check first if continuing this line of work.

## Fast re-orientation commands

- `git log --oneline -15` shows the two relevant prior rounds back to back:
  `094d9e9` (merge settings-ux-improvements) then `07c4db7`/`22bd5cb` (settings-centralization,
  later). Read commits in that order if you need to replay history.
- The prior round's FULL doc trail (exploration → clarification → implementation → review, all
  4 phases) lives at `.ai_out/settings-ux-improvements/settings-ux-improvements/*.md` — read
  EXPLORATION_PUBLIC.md and CLARIFICATION__PUBLIC.md and UI_IMPLEMENTATION_REVIEW__PUBLIC.md fully
  (I did, and inlined the load-bearing parts into the PUBLIC doc); the two PRIVATE `_PLAN` files
  add nothing new for exploration purposes (implementation planning detail only).
- `docs-internal/CHANGELOG.md` has scattered relevant entries (search `-i settings`); the
  force-layout-sliders entry (line ~5) and the exclusion-feature entry (line ~98) predate the
  settings-ux-improvements round and are worth reading if scoping sizing/exclusion further.

## Things I verified directly by reading source (not just trusting the prior docs)

- `groupByFolder`/`edgeVisibility` dead-UI finding: confirmed by grepping
  `src/view/*.ts(x)` for both names outside test files — `groupByFolder` only appears in
  layout/diff/mapping consumers (GraphStructureDiff.ts:32, elkMapping.ts:31, flowMapping.ts,
  folderGrouping.ts), never in a `Setting`/JSX control or a `SettingsInteraction` case.
  `edgeVisibility` had literally zero non-test hits anywhere in `src/view`. Also confirmed
  `settingsWritePlan.ts`'s `SettingsInteraction`/`SettingsCommand` unions (lines 25-62) have no
  case that could write either field — so even a hypothetical hidden UI couldn't exist without a
  new interaction kind. This is a genuinely new finding not mentioned in the prior round's docs
  (they were scoped narrowly to exclusion/force-layout/cards and never audited full ViewSettings
  coverage).
- The prior round's e2e file `e2e/settingsUxVisual.e2e.ts` (4 tests, confirmed via
  `test(` grep) supersedes an earlier reviewer-authored `.tmp/review-e2e/settingsUxReview.e2e.ts`
  mentioned in UI_IMPLEMENTATION_REVIEW__PUBLIC.md — that `.tmp/` file still exists on disk
  (`find` showed `./.tmp/review-e2e/settingsUxReview.e2e.ts`) but `.tmp/` is scratch/ignored, not
  a committed spec; don't count it as real coverage, it was the reviewer's throwaway validation
  spec. Only `e2e/settingsUxVisual.e2e.ts` is the committed, maintained one.
- Restore-defaults scope: grepped `Restore defaults\|Restore .* defaults` across `src/view` — only
  2 hits (settings tab + `ForceLayoutSection.tsx`), both force-layout-only. No restore button
  exists for sizing/depth/exclusion/node-cap on either surface. Confirmed by absence of any other
  `.addButton` in `VicinityGraphSettingTab.ts` (only one `addButton` call in the whole 361-line
  file, at line 104).
- Debounce claim: grepped for `debounce` in `src/view/VicinityGraphSettingTab.ts` (zero hits) and
  confirmed every `onChange` callback in that file calls `applyInteraction`/`applySizing`/
  `applyForceLayout` synchronously with no timer wrapper. The existing debounce infra
  (`GraphViewController`'s rebuild debounce, mentioned in CHANGELOG "Phase B — performance pass")
  is a DIFFERENT debounce — it debounces the REBUILD pipeline reacting to vault file events, not
  settings-tab keystrokes; settings-tab writes explicitly bypass it per the "active-file/settings
  changes rebuild immediately, cancelling any pending debounce" changelog line. So a future fix
  for the exclusion-textarea/sizing-number keystroke-storm ticket would need a NEW debounce at the
  settings-tab control level (e.g. wrap `onChange` in a leading/trailing-edge debounce before
  calling `applyInteraction`), not reuse of the controller's existing one.

## Areas I did NOT deep-dive (flag for a future pass if in scope)

- `src/persistence/persistedShapes.ts` full parse/clamp implementation — I only confirmed it
  exists and clamps against the same spec-derived bounds (`clampForceLayoutSettings`); did not
  read every field's clamp function line-by-line. If a later ticket touches persistence-side
  validation (e.g. surfacing invalid-regex feedback), read this file fully first.
- `src/engine/PathExclusionMatcher.ts` — only read the EXPLORATION_PUBLIC.md's prior summary
  (raw unanchored case-sensitive regex, invalid patterns silently skipped), did not re-read the
  file myself. Cited third-hand; low risk since it's a small, stable pure module, but verify
  before quoting exact matching semantics in an implementation ticket.
- Did not run the actual e2e suite or take fresh screenshots — this was a read-only exploration
  pass, not a hands-on QA pass (no obsidian-add-e2e / run skill invoked). Screenshots referenced
  in UI_IMPLEMENTATION_REVIEW__PUBLIC.md under `.out/settings-ux-review/*.png` still exist on disk
  (confirmed via `find`) if visual re-verification is wanted before further design work.
- Did not check `README.md`'s settings-model section for consistency with the current inventory
  table — CHANGELOG mentions README was rewritten to describe "the settings model users will ask
  about" (global defaults, per-note depth pin, pinning semantics) but I did not cross-check it
  still matches current field names/defaults after the settings-centralization refactor.

## Suggested next steps if asked to actually redesign

1. Decide whether `groupByFolder`/`edgeVisibility` deserve settings-tab exposure (dead field) vs.
   staying code-only intentional constants (if intentional, they arguably shouldn't live in
   `ViewSettings`/`SETTINGS_SPEC` at all — that's a scope question for a human, mirrors the
   CLARIFICATION-doc pattern already established by this codebase).
2. The keystroke-storm-on-every-onChange pattern is repeated 4x (exclusion textarea, sizing
   weight/min/max/decay-k, node cap) — a single reusable debounced-`onChange` helper in the
   settings tab would fix all of them at once and is a natural "simplify" pass, not just a UX fix.
3. `this.display()` full-teardown re-render on 2 specific toggles (exclusion enabled, any sizing
   metric enabled) is the same "diff-free full rebuild" pattern criticized in rough edges — a
   scoped fix would only touch the affected section's container, not `containerEl.empty()` +
   rebuild all 5 cards.
