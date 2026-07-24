# IMPLEMENTATION_PART2__PRIVATE — rehydration memory (steps 6–10)

Branch `node-outline`. My commits: `96d4093` (6), `d38c543` (7), `f5bc9a0` (8),
`512905a` (9), `ca77f7f` (10). Tree clean at `ca77f7f`.

## Environment facts (re-learned the hard way — do not re-derive)

- `npm test` baseline on this branch before my work: **790 passed / 3 failed**.
  After: **815 / 3**. The 3 are the `collidePaddingPx` baseline drift from
  `22bd5cb`; ticketed, must NOT be re-pinned.
- **`npm run test:e2e` WORKS in this container.** No `OBSIDIAN_PATH` needed —
  `scripts/run-e2e.sh` calls `scripts/setup-obsidian-bin.sh`, which downloads and
  extracts Obsidian 1.12.7 into `.tmp/obsidian/`. No display → it auto-sets
  `--ozone-platform=headless --disable-gpu`. Full suite ≈ 1.5 min; one spec ≈ 30 s
  plus ~20 s boot. Use `npm run test:e2e -- <spec>.e2e.ts`.
- A single e2e spec's failure aborts the rest of that *file* (serial mode) —
  "N did not run" is expected, not extra breakage.
- No formatter script in `package.json`. Indentation is hand-maintained tabs.
- `tsconfig` targets **ES2021** — no `Array.prototype.at`, no `findLast`.
- `styles.css` and `main.js` ARE git-tracked but regenerate on build; they show as
  modified after `npm run build` only if content changed.

## Key design facts I depended on

- `NodeSizer`: centrals (MAIN **and pinned**) bypass metric composition and get
  `CENTRAL_SIZE_SCORE` → `maxPx` (160). Non-central sizes are min-max normalised
  across the whole node set → NOT deterministic for e2e. **Always assert on MAIN.**
- `GraphViewController.handleActiveFileChanged` ignores non-node-bearing paths, so
  opening `pic.jpg` leaves the current graph mounted with its MAIN unchanged.
  That is the trick E3 uses to make "the note became active" non-vacuous.
- CSS concatenation order in `esbuild.config.mjs` `AUTHORED_CSS_FILES`:
  `graph-view.css`, `node-outline.css`, `settings-tab.css`. Anything in
  `graph-view.css` that must beat a `node-outline.css` rule needs **higher
  specificity**, not just position. This bit me: the 104px reveal lost a
  specificity tie to the base `display: none` and the outline never rendered.
  Fixed with `.vicinity-graph-node .vicinity-graph-outline`.
- `NoteNode` renders no breadcrumb element at all — `vicinityGraph.e2e.ts`'s gamma
  breadcrumb test has been red on `main` for a while and is ticketed.

## Mutation checks I actually ran (all restored afterwards)

| Mutation | Went red |
|---|---|
| `opensInNewTab` → `return modifiers.ctrlKey` | meta test |
| `outlineEntryOpenOptions` drops `heading` | both outline-click tests |
| controller forwards `{ newTab }` only | verbatim-heading test |
| `outlineEntryLabel` drops the STRONG pass | bold test |
| wikilink replacer returns the whole capture | alias test |
| empty-label fallback removed | `[]()` test |
| tree stack `>=` → `>` | two nesting tests |

Backups went to `.tmp/*.bak` and were copied back; `git diff --stat` confirmed
clean before each commit.

## Files I created

`src/view/nodeOpenIntent.ts(+test)`, `src/view/NoteOpenContext.ts`,
`src/view/outlineEntryLabel.ts(+test)`, `src/view/outlineTree.ts(+test)`,
`src/view/nodePreviewChoice.ts(+test)`, `src/view/NodeOutline.tsx`,
`src/view/node-outline.css`, `e2e/nodeOutline.e2e.ts`,
`docs-internal/tickets/ticket-node-outline-live-refresh.md`,
`.ai_out/node-outline/node-outline/IMPLEMENTATION_PART2__{PUBLIC,PRIVATE}.md`.

## Files I modified

`src/view/viewPorts.ts`, `src/view/ObsidianNoteNavigator.ts`,
`src/view/VicinityGraphFlow.tsx` (provider nesting → whole JSX block reindented
one tab), `src/view/NoteNode.tsx`, `src/view/graph-view.css`,
`src/view/GraphViewController.test.ts`, `esbuild.config.mjs`,
`scripts/setup-dev-vault.sh`, `e2e/settingsUxVisual.e2e.ts`, `README.md`,
`docs-internal/plan/high-level-plan.md`, `docs-internal/architecture-map.md`.

## Open / deliberately not done

- **Manual GUI check** (Obsidian scrolls to + flashes the heading, editing AND
  reading view) — needs a human. Noted in the step-9 commit and the dev-vault
  banner. If a reviewer asks "did you verify the jump works", the honest answer is
  "our side of the `openLinkText` contract is pinned by e2e E2; Obsidian's scroll
  behaviour is unverified here."
- `change_log` entry and `docs-internal/CHANGELOG.md` — TOP_LEVEL_AGENT owns them.
  Part 1's iteration doc flagged the README settings line as owed; it is now
  written, but the CHANGELOG line still is not.
- Two pre-existing e2e failures remain red (radial routing gate, gamma
  breadcrumb). Both ticketed, both reproduced on `22bd5cb`.

## If asked to iterate on the outline UI

Everything visual is in exactly two files — `src/view/NodeOutline.tsx` and
`src/view/node-outline.css` — plus the one density-ladder line in
`graph-view.css`. Nesting spacing is a single selector
(`.vicinity-graph-outline__list .vicinity-graph-outline__list`). `NoteNode` needs
no change for collapse toggles, active-heading highlight, counts, or middle-click:
`NodeOutline` reaches `useNoteOpen()` itself and takes no callbacks. That is the
whole point of the boundary (CLARIFICATION Q9) — keep it.
