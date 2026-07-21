# EXPLORATION: README / Release / Tickets

## 1. Current README.md gaps
Current README is a **pure dev-setup doc** (79 lines): fresh-clone (`git submodule update --init && npm install`), scripts table, dev-vault, e2e instructions, minAppVersion rationale.
**Missing (all required by step-07):** what the plugin is / two native-graph weaknesses; user-facing install (BRAT/manual/community — absent); settings model (global vs per-doc pinning); V1 scope/limits; V2 roadmap; screenshots.

## 2. Product framing (from docs-internal/plan/high-level-plan.md)

**Two weaknesses fixed (verbatim, line 3):** "It exists to fix the two core weaknesses of the native graph: **every node looks the same**, and **there is no grouping**."
Goals: nodes carry information (title, thumbnail, attachment icons, folder identity, relevance emphasis); grouping by folder as visible structure.

**V1 Scope (verbatim, lines 14-19):**
- LOCAL graph only. No global graph.
- No unresolved (ghost) links.
- Sizing configuration is global only; per-view sizing overrides come later.
- No manual node dragging persistence; layout is computed.
Additional V1 limits: default node cap 100 (~100 readable ceiling); canvas text-node wikilinks skipped.

**Deferred to V2+ (verbatim, lines 129-135):**
- Per-view sizing overrides (data format already shaped for it).
- Position-seeded incremental layout.
- Canvas text-node wikilink parsing.
- Unresolved link ghost nodes (toggle, off by default).
- User-assignable folder colors.
- Manual node position persistence, if ever.

**Shipped behavior by step:** 01 scaffold (TS+esbuild, React 18 ItemView, vitest, obsidian-id-lib submodule, manifest); 02 core engine (pure, zero Obsidian imports); 03 adapters+persistence (ObsidianLinkProvider, canvas fallback, data.json/per-doc persistence, delayed+chunked orphan sweep); 04 view shell (ItemView right sidebar, elkjs, structural-diff skip-layout, follow-active-file, debounced rebuilds); 05 rich rendering (NoteNode thumbnail/attachment icons/breadcrumb titles, neutral folder-group boxes 2+ rule, directed edges w/ count badges, theme styling, Playwright e2e); 06 controls (in-view toolbar: depth steppers per central, sizing section, node-pin hover+right-click; global settings tab; all writes via `planSettingsWrite`).

## 3. Settings model — real semantics

Files: `NeighborhoodGraphSettingTab.ts`, `settingsWritePlan.ts`, `ControlsModel.ts`, `nodePinAction.ts`, `src/persistence/persistedShapes.ts`, `PluginDataStore.ts`.

**Two classes:**
- **Traversal (depth) — per-root.** Each central (MAIN or pinned) resolves own doc override, falls back to global default. Global sliders → `"global-depth"` → `saveGlobalDepths`.
- **View (sizing, grouping, node cap) — global-only in V1.** Cascade resolver (MAIN → pinned → global) exists + tested but nothing to arbitrate yet (per-view is V2).

**Pinning mechanics:**
- Pinning a node = it becomes an **extra central node** (traversed + rendered with MAIN). Pinned set is **global state** (`data.json` → `pins: PinnedDocEntry[]` with docid + pinTimestamp), survives restarts.
- Two surfaces (hover button + right-click), unified via pure `planNodePinAction(tier)`: MAIN→none, neighbor→pin, pinned→unpin.
- **A pinned central's depth adjustment while at MAIN Y persists inside Y's own doc file** — a `centralDepths` map keyed by pinned central's docid, in Y's `doc-data/<Y-docid>.json`. The pinned node's own saved depth is untouched. Verified by `CentralDepthRoundTrip.test.ts`. (Subtle — "users will ask".)
- **Pin-on-toggle:** any explicit interaction with a depth control writes a per-doc entry even if equal to global default (globals may change later). Per-field, not per-document. Presence=pinned, absence=inherit. Reset-to-global = delete field.

**Persistence:** all JSON, every shape has `version` (`PERSISTED_SHAPE_VERSION = 1`). `data.json` = global settings + pins. Per-doc = one file per doc at `.obsidian/plugins/<id>/doc-data/<docid>.json` (sync-friendly).

**Known gap (ticketed):** `ticket-pinned-central-status-lags-after-restart.md` — after restart a persisted pinned central renders as `regular` (no dashed accent, missing from toolbar list) until the 15s orphan sweep warms `PathDocIdMap`. Pin NOT lost, only visual identity lags. → README caveat candidate.

## 4. Release artifacts — issues to flag

`manifest.json`: id `obsidian-neighborhood-graph`, name "Neighborhood Graph", version 0.1.0, minAppVersion 1.12.4, description, author "Nickolay Kondratyev", isDesktopOnly false. All 7 required fields present. No authorUrl/fundingUrl (optional).
- **FLAG:** id contains "obsidian-" prefix — community guidelines discourage; changing later breaks existing users' data path. Decide pre-release.
- **FLAG:** isDesktopOnly:false not verified on mobile (no Node-only APIs spotted, but untested).
- `versions.json`: `{"0.1.0":"1.12.4"}` — correct format.
- `package.json`: version 0.1.0 matches. **FLAG license:** `LICENSE.md` = "Kondratyev Source Available License v2.3" (KSAL-2.3) — custom source-available, NOT OSI open-source. Doesn't block Obsidian submission but needs human sign-off + README honesty. No repository/homepage/bugs fields (minor).
- `main.js`/`styles.css` are gitignored build outputs. GitHub Release must attach manifest.json+main.js+styles.css as raw assets tagged with exact version. No `gh release create` automation exists yet → manual checklist step.

## 5. Dev setup — fresh-clone flow
- `.gitmodules`: single submodule `submodules/obsidian-id-lib` (consumed as `file:` raw TS, bundled by esbuild).
- Flow: `git submodule update --init` → `npm install`.
- `scripts/setup-dev-vault.sh`: idempotent; creates `.dev-vault/` fixtures, writes minimal `.obsidian/*.json` (auto-enables plugin), runs `npm run build`.
- `scripts/setup-obsidian-bin.sh`: Linux-only auto-downloader for pinned Obsidian (`1.12.7`), tarball, cached in `.tmp/obsidian/`. Non-Linux: export `OBSIDIAN_PATH`.
- `npm run test:e2e` → `scripts/run-e2e.sh` (wires both + headless detection).
Current README dev section is accurate; needs to sit alongside new public content.

## 6. Tickets — triage

**`_tickets/` (top-level, un-triaged):**
- `hover-pin-button-blankets-tiny-nodes-and-eats-the-open-click.md` (OPEN, bug, P3): hover pin-button (opacity:0 but receives pointer events) covers node body on nodes <~48px, so clicking a small node hits invisible pin button (stopPropagation) instead of opening note. Fix: `pointer-events:none` while hidden + hide below size threshold (container-query). **Strong fix-now candidate** (small CSS, touches primary click-to-open UX).

**`docs-internal/tickets/` (12):**
- `ticket-eslint-adoption.md` — OPEN (deferred step-01). ESLint 9 flat + eslint-plugin-obsidianmd, both repo + submodule.
- `ticket-e2e-view-type-constant-dedup.md` — OPEN. `VIEW_TYPE_NEIGHBORHOOD_GRAPH` duplicated src/ vs e2e; move to obsidian-free module. (Note: `src/view/constants.ts` now exists.)
- `ticket-folder-color-ux-design-pass.md` — OPEN. Deliberate no-ship in step-05. → V2 folder colors.
- `ticket-node-drag-reposition.md` — CLOSED, out-of-V1. → V2 position persistence.
- `ticket-controls-optimistic-input-latency.md` — OPEN (deferred step-06). Depth steppers/sizing controlled off post-rebuild snapshot → rapid clicks feel laggy. Fix: optimistic local state. Low freq, no data loss.
- `ticket-dev-vault-recognizable-thumbnail.md` — OPEN. Synthetic pic.png unjudgeable; swap recognizable public-domain image.
- `ticket-edge-arrowhead-and-badge-visual-polish.md` — RESOLVED, pending human real-Obsidian confirm.
- `ticket-e2e-node-click-flaky-headless.md` — OPEN, test-infra flake (not product defect). Headless clicks on dense-graph nodes unreliable. Fix: pan/center before click or gate behind non-headless.
- `ticket-pinned-central-status-lags-after-restart.md` — OPEN (see §3).
- `ticket-step-03/04/05-human-smoke-run.md` — DONE (results recorded inline).
- `ticket-step-06-controls-human-smoke-run.md` — **OPEN, awaiting human run**. Release-readiness gating (visual/native-feel; restart-survival already automated in e2e).

**Grep:** no TODO/FIXME in src/. V2/deferred mentions are plan-referencing comments only. Convention = ticket files, not inline TODOs.

## 7. CHANGELOG
At `docs-internal/CHANGELOG.md` (NOT root). Format: reverse-chron `## YYYY-MM-DD — step-name: tagline` + prose + "Verified: ..." line + ticket links. 6 entries (steps 01-06 + edge-polish). Flow writes ONE entry per unit of work. **Decide:** whether public release wants a root `CHANGELOG.md` too.

## Summary for writers
README needs: (1) product pitch (two-weaknesses + goals), (2) real user install section (absent), (3) Settings model section (global depth/sizing/cap vs per-doc depth vs pinning-as-central vs centralDepths-on-MAIN's-doc nuance), (4) V1 Scope/Limits (verbatim), (5) V2 roadmap (verbatim), (6) keep/adapt dev section.
Release checklist flags: KSAL-2.3 non-OSS license (human sign-off), obsidian- id prefix (decide now), no release-cutting automation, open step-06 human smoke-run.
Fix-now candidate: `_tickets/hover-pin-button-...` (small, high-value).
