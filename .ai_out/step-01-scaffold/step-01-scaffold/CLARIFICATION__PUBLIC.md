# CLARIFICATION — step-01-scaffold (RESOLVED)

## Decisions (human-approved 2026-07-16)

1. **`minAppVersion`: `"1.12.4"`** — HUMAN approved option 1.
   - Context: the step doc's premise ("Obsidian version that introduced canvas `metadata.frontmatter`") is FALSE — no core release introduced it; it is a plugin-ecosystem convention (see EXPLORATION_PUBLIC.md, minAppVersion research).
   - Basis: 1.12.4 is the first public core release with canvas backlink/graph link indexing (EA 1.12.0 → 2026-02-10, public 1.12.4 → 2026-02-27).
   - HUMAN requirement: **newer Obsidian versions must also work** — `minAppVersion` is a floor, never a ceiling; no upper bound, no version-specific hacks.
   - Manifest must carry a succinct WHY comment (in adjacent docs/code, since JSON has no comments) citing the 1.12 changelog.
2. **Plugin id/name**: `obsidian-neighborhood-graph` / "Neighborhood Graph" (step-doc defaults, no objection from human).
3. **Submodule vitest suite**: wire into our test loop IF it is a cheap single-npm-script addition; otherwise ticket it.

## Environment note (for all sub-agents)

- **Do NOT use `_git.save`** — it requires an interactive TTY (/dev/tty y/n prompt) and hangs in this environment. Use plain `git add -A && git commit -m "..."`.
