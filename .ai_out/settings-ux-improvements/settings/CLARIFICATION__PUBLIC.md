# CLARIFICATION — settings UX round 2 (branch `settings`)

## Human-confirmed scope

**IN SCOPE (only this):** Restore-defaults affordances.
- A **per-section "Restore defaults"** control for every settings section (sizing, depth, node cap, exclusion, force layout — force layout already has one; make it consistent with the rest).
- A **"Restore all defaults"** control at the **bottom of the whole settings tab**.
- Structural approach: **polish in place** — keep the current card/section structure, ordering and headings. No IA rework, no renames.

**OUT OF SCOPE this round** (explicitly deferred by the human, do NOT implement):
- Debounce of number/text/textarea writes + invalid-regex per-line feedback + upper bounds / `maxPx < minPx` cross-validation.
- Removing the full `display()` teardown on dependent-row toggles.
- Exposing the orphan `groupByFolder` / `edgeVisibility` settings.
These stay as tickets/follow-ups.

## TOP_LEVEL_AGENT decisions (call out if you disagree)

1. **Scope must be unambiguous.** Each reset control must state exactly what it resets (section name for per-section; "all Vicinity Graph settings" for the global one). This is the core UX requirement from the `obsidian-settings` skill — a reset whose blast radius is unclear is a bug.
2. **"Restore all defaults" is destructive → require confirmation** (Obsidian `Modal` with explicit confirm/cancel). Per-section resets are narrow and cheap to redo → **no confirmation**, but they must be visibly scoped.
3. **Reset must go through the existing settings write path** (SETTINGS_SPEC defaults + the same persistence/apply seam), never by hand-assigning literals. Defaults have exactly one source of truth: `SETTINGS_SPEC`.
4. Existing in-graph (React) force-layout reset stays; only align its wording/affordance if trivially consistent.
5. Behavior-capturing tests are required for: per-section reset restores only that section's keys, and global reset restores all.

## References
- Current state + inventory: `./.ai_out/settings-ux-improvements/settings/EXPLORATION_PUBLIC.md`
- Prior (merged) round: `./.ai_out/settings-ux-improvements/settings-ux-improvements/*__PUBLIC.md`
