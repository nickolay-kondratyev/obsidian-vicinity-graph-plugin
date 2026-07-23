# CLARIFICATION__PUBLIC — Global Node Exclusion

Human-aligned decisions (2026-07-23). These are binding requirements for implementation.

## Confirmed decisions
1. **Pill scope = GLOBAL.** One vault-wide enable/disable toggle for exclusion. Mirrors the existing `edgeRouting` global-toggle precedent. No per-doc override. The pattern list is also global.
2. **Roots exempt.** Exclusion applies **only to discovered neighbor nodes**, never to the active/central note or explicitly pinned nodes — even if they match a pattern. (So the root eligibility gate must NOT apply exclusion; only neighbor discovery does.)
3. **Case-sensitive** regex matching (standard `new RegExp(pattern)` behavior; users may add `(?i)`-style inline flags themselves if they want).
4. **Invalid regex → silently skipped.** A pattern that fails to compile excludes nothing and never breaks the graph. (No settings-tab validation UI in this iteration — can be a follow-up.)

## Derived semantics (decided by orchestrator, consistent with task + above)
- **Match target**: the full vault-relative path **including extension**, e.g. `rel/some-relationship.md`.
- **Regex-lite**: each list entry is a raw JS regex tested **unanchored** via `regex.test(vaultPath)`. Therefore `rel/` matches anywhere in the path (`rel/x.md`, also `a/rel/x.md`); `^rel/` anchors to the vault root as the task requests.
- **Excluded iff** ANY enabled+valid pattern matches. Empty list or disabled flag ⇒ no exclusion (no-op matcher).
- **Applied at the data layer**: reject at BFS neighbor discovery (`VicinityTraversal`, sibling to `isNodeBearing`) — excluded neighbors are never enqueued, never expanded through, never fetch metadata. This is the performance win. Nodes reachable ONLY through an excluded node are consequently not discovered (acceptable, documented semantic).
- **Count ("N excluded for that graph")**: number of **distinct** vault paths rejected by exclusion during this graph's traversal. Surfaced next to the pill; shown only when exclusion is **enabled AND count > 0**.

## Persistence shape (decided)
- New global-only field on `PluginData` (`persistedShapes.ts`), NOT inside `ViewSettings` (which resolves after traversal). Suggested: `nodeExclusion: { enabled: boolean; patterns: readonly string[] }`, defaulted `{ enabled: false, patterns: [] }`, defensively parsed (non-throwing). Version stays v1 (additive).
- Reaches engine as a **top-level `GraphBuildRequest` field** via `GraphRequestAssembler` from `PluginDataStore`.

## Surfaces to build
- **Settings tab** (`VicinityGraphSettingTab`): a patterns textarea (one regex per line) + it is the source of truth for the pattern list. (Enable toggle can also live here for parity, but the primary enable control is the toolbar pill.)
- **Toolbar pill** (`GraphToolbar`): enable/disable exclusion (writes the global flag), showing the excluded count when enabled and > 0.
