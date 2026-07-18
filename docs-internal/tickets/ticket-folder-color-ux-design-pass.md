# Ticket: Folder color UX — deliberate design pass

**Status:** OPEN
**Origin:** step-05-rich-rendering CLARIFICATION (2026-07-18) — human decision to NOT ship folder colors in step 05.

## Context

The original step-05 spec had folder-group colors via a deterministic hash of folder path into a palette. The human rejected shipping colors "just for the heck of it": rainbow coloring is an important UX addition that deserves deliberate design, not a random hash thrown in. Step 05 shipped **neutral** group styling (subtle border, `--background-secondary` fill, folder-name label) and folder identity via breadcrumb titles on ungrouped nodes.

## Scope of the design pass

- Decide IF colors add value at all (the neutral UX must already work well — validate first).
- If yes: how colors map to folders (hash vs. user-assigned — user-assignable was already slated V2), which palette (Obsidian theme color vars for light/dark friendliness?), and where color appears (group border? label chip? node accent?) without turning the graph into a rainbow.
- Accessibility: colorblind-safe, dark/light themes, contrast.

## References

- `.ai_out/step-05-rich-rendering/main/CLARIFICATION__PUBLIC.md` (Palette section — binding decision + original idea recorded)
- `docs-internal/plan/steps/step-05-rich-rendering.md` (Folder groups section)
