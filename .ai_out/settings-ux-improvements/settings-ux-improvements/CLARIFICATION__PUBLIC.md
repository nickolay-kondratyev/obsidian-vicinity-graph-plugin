# CLARIFICATION__PUBLIC.md — settings-ux-improvements

Human-aligned decisions (2026-07-24):

1. **"See what is excluded" (graph controls)** = show the exclusion **PATTERNS** (the configured regexes) + existing count when the exclusion toggle is ON. NOT the actual excluded note list. UI-only — no engine change; patterns already reach the view via `ctx.nodeExclusion.patterns`. When OFF, just show that it's off. Pattern EDITING stays settings-tab-only (unchanged prior decision).
2. **Settings tab grouping** = **boxed/framed sections** (CSS-only visual cards around each existing section: Depth defaults, Node sizing, Force layout, Node exclusion, Performance). No collapsibles in settings tab. Theme-variable-driven styling.
3. **Depth in graph controls** = wrapped in its own collapsible like everything else, but **open by default**. All other sections (pinned, exclusion, force layout, sizing) start collapsed.
4. **In-graph force layout collapsible** = full Settings-tab parity: all 6 sliders (4 main + 2 advanced spacing) **plus Restore defaults button**. Ranges from `FORCE_LAYOUT_RANGES`; labels/descriptions should be shared (extract a shared field-meta table) — do NOT duplicate copy text between settings tab and graph panel.

Non-negotiable constraints reaffirmed (from EXPLORATION_PUBLIC.md):
- Reuse existing `global-force-layout` / `global-node-exclusion` interactions — no new plumbing kinds needed.
- Reuse `vicinity-graph-disclosure` collapsible pattern; consider extracting a shared `<Disclosure>` component now that count grows to 4-5 copies (DRY).
- Engine purity untouched (no engine changes required at all for this scope).
- All new CSS theme-variable-driven; settings-tab CSS must actually reach settings DOM (styles.css is loaded plugin-wide by Obsidian — verify).
