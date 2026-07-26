# Step 05: Rich Rendering

**Covers:** Phase 5 of [[../high-level-plan]]
**Depends on:** [[step-04-view-shell]]

## Objective

Nodes that carry information — the plugin's reason to exist. Replace plain nodes with rich components, add folder grouping, directed edges, and native theming.

## Scope

### Custom node component

- Title, **first image as thumbnail**: lazy-loaded, fixed height, "+N" badge when more images exist.
- **Title source**: frontmatter `title` or `name` property when present; otherwise filename without extension. *(Clarified 2026-07-18.)*
- ~~**Ungrouped nodes** show folder identity as a breadcrumb title: `<folder-name>/<node-title>` (folder part muted, clearly a folder).~~ *(Clarified 2026-07-18 — replaced the folder-colored accent. **SUPERSEDED 2026-07-23** by `998fdac` "snug capped node width + remove folder prefix": the breadcrumb was removed end-to-end so node width hugs the title alone. See `high-level-plan.md` §Sizing — that is the authoritative model.)*
- **Icon strip per attachment extension with counts**; clicking an icon opens a dropdown listing those files.
- Everything past the first image loads lazily; rely on React Flow viewport culling.
- Distinct styling tiers: **MAIN**, **pinned centrals** (distinct from MAIN), regular nodes. Node size from the engine's sizing score.
- **Truncation badges**: per-folder "+N" on rendered folder groups; folders whose members were ALL truncated aggregate into one graph-corner overlay badge "+N hidden" (per-folder breakdown in tooltip). *(Clarified 2026-07-18.)*

### Folder groups

- React Flow subflows; groups render **only at 2+ members**; singletons render ungrouped (~~with the breadcrumb title~~ — breadcrumb superseded 2026-07-23, see node component).
- **No folder colors in step 05** *(human decision 2026-07-18)*: neutral Obsidian theme styling — subtle border, `--background-secondary`-style fill, folder-name label on the group. Color UX deferred to a deliberate design pass (follow-up ticket); original color-hash idea recorded there.
- elkjs compound layout drives group geometry (options baseline chosen in step 04).

### Edges

- **Arrowheads show direction.** A→B and B→A render as two arrows with offset opposite curvature.
- Multiple links between the same ordered pair collapse into one edge with a count badge.

### Theme integration + interactions

- All styling from **Obsidian theme CSS variables** — light/dark just works; verify against both stock themes.
- Click opens the note (current tab); **ctrl/cmd-click** opens in a **new tab** (`getLeaf(true)`) *(clarified 2026-07-18)*; hover fires Obsidian's `hover-link` for native page previews.

## Out of scope

- Toolbar, steppers, pin/unpin buttons, settings UI (step 06). (Pinned styling renders here; the affordance to pin arrives next step.)
- Performance tuning beyond lazy loading (step 07).

## Testing

- Pure logic vitest-covered: edge collapsing/pairing, group-membership derivation (2+ rule), attachment→icon-strip mapping, title derivation (~~breadcrumb derivation~~ — **SUPERSEDED 2026-07-23** by `998fdac`, which deleted `breadcrumbFolderOf` together with its tests). *(Folder-color-hash test dropped with the palette deferral — 2026-07-18.)*
- **Playwright e2e (in scope, clarified 2026-07-18)**: harness launches Obsidian (Electron) on the dev-vault and asserts DOM/state (node counts, badge text, CSS classes, edge markers) — no screenshot/LLM judgment; re-runnable at release.
- Visual/behavioral: dev-vault manual-QA checklist per feature as smoke test; light + dark theme pass; human smoke-run ticket per step-04 pattern.
- Per master UI memory (`${MY_DEEP_MEM}/my-frontend-design.md`): load it during step-level planning — this is the UI-heavy step.

## Open items — RESOLVED 2026-07-18 (see `.ai_out/step-05-rich-rendering/main/CLARIFICATION__PUBLIC.md`)

1. Thumbnail resolution: port method → `vault.getResourcePath`; no extra cache; re-resolved per rebuild.
2. Dropdown: native Obsidian `Menu`; entries open files via Obsidian default handling.
3. Palette: DEFERRED entirely (no colors in step 05; follow-up ticket for deliberate color UX design).
4. Fully-truncated folders: aggregate graph-corner overlay badge "+N hidden" with per-folder tooltip breakdown.

## Exit criteria

- A node visibly answers "what is this note" without opening it (title, thumbnail, attachments, folder identity, size emphasis).
- Groups, directed/collapsed edges, and truncation badges render correctly on dense fixtures.
- Theme switch (light↔dark) requires zero plugin changes.
