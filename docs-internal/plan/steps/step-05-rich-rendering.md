# Step 05: Rich Rendering

**Covers:** Phase 5 of [[../high-level-plan]]
**Depends on:** [[step-04-view-shell]]

## Objective

Nodes that carry information — the plugin's reason to exist. Replace plain nodes with rich components, add folder grouping, directed edges, and native theming.

## Scope

### Custom node component

- Title, **first image as thumbnail**: lazy-loaded, fixed height, "+N" badge when more images exist.
- **Icon strip per attachment extension with counts**; clicking an icon opens a dropdown listing those files.
- Everything past the first image loads lazily; rely on React Flow viewport culling.
- Distinct styling tiers: **MAIN**, **pinned centrals** (distinct from MAIN), regular nodes. Node size from the engine's sizing score.
- **Truncation badges**: hidden-node count, per folder group where possible.

### Folder groups

- React Flow subflows; groups render **only at 2+ members**; singletons get a folder-colored accent.
- Group colors: deterministic hash of folder path into a palette (user-assignable is V2).
- elkjs compound layout drives group geometry (options baseline chosen in step 04).

### Edges

- **Arrowheads show direction.** A→B and B→A render as two arrows with offset opposite curvature.
- Multiple links between the same ordered pair collapse into one edge with a count badge.

### Theme integration + interactions

- All styling from **Obsidian theme CSS variables** — light/dark just works; verify against both stock themes.
- Click opens the note; **ctrl/cmd-click** for the alternate target; hover fires Obsidian's `hover-link` for native page previews.

## Out of scope

- Toolbar, steppers, pin/unpin buttons, settings UI (step 06). (Pinned styling renders here; the affordance to pin arrives next step.)
- Performance tuning beyond lazy loading (step 07).

## Testing

- Pure logic vitest-covered: folder color hashing (deterministic), edge collapsing/pairing, group-membership derivation (2+ rule), attachment→icon-strip mapping.
- Visual/behavioral: dev-vault checklist per feature; light + dark theme pass. Consider `PLAYWRIGHT_REVIEW_WITH_SCREENSHOTS` sub-agent if an Obsidian-driving harness is feasible; otherwise structured manual QA with screenshots to `/.out`.
- Per master UI memory (`${MY_DEEP_MEM}/my-frontend-design.md`): load it during step-level planning — this is the UI-heavy step.

## Open items for step-level planning

1. Thumbnail resolution strategy: `vault.getResourcePath` for image attachments; cache behavior on rebuild.
2. Dropdown implementation: Obsidian `Menu` (native feel) vs. custom React popover — lean native.
3. Palette definition and hash function (stable across sessions; no magic numbers).
4. How truncation badges attach to groups whose visible members were all truncated away.

## Exit criteria

- A node visibly answers "what is this note" without opening it (title, thumbnail, attachments, folder identity, size emphasis).
- Groups, directed/collapsed edges, and truncation badges render correctly on dense fixtures.
- Theme switch (light↔dark) requires zero plugin changes.
