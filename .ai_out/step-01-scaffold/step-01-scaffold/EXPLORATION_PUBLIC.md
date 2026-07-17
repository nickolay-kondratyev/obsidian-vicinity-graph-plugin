# EXPLORATION — Step 01 Scaffold

Exploration reference for scaffolding this Obsidian plugin repo (TS + esbuild + React 18 + vitest). Gathered 2026-07-16. All paths absolute.

## 1. Repo state

- Root: `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-neighborhood-graph`, branch `main`, clean tree.
- Contents: `README.md` (2-line stub), `LICENSE.md` (**Kondratyev Source Available License v2.3 / KSAL-2.3**, copyright 2026 Nickolay Kondratyev — source-available, NOT OSI open source), `.gitmodules`, `docs-internal/plan/`, `submodules/obsidian-id-lib/`, `ask.dnc.md` (untracked-ish scratch ask doc), `.idea/`, `.tmp/`, `.ai_out/`.
- **No root `.gitignore` exists yet.** No `package.json`, no `src/`, no `manifest.json` — nothing scaffolded.
- `.gitmodules`: single submodule `submodules/obsidian-id-lib` → `git@github.com:nickolay-kondratyev/obsidian-id-lib.git`. Submodule is initialized (commit `6d5e98b`, heads/main).
- Repo name: `obsidian-neighborhood-graph`; README description: "Improved visualization of neighboring notes (envisioned to be used in place of local graph)."

## 2. High-level plan — Phase 0 requirements

Source: `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-neighborhood-graph/docs-internal/plan/high-level-plan.md`

- Stack decisions (line 30-34): React Flow rendering, elkjs layout, **TypeScript + esbuild standard plugin toolchain, React 18 mounted in an ItemView, vitest** for pure layers; docid library as git submodule at `submodules/obsidian-id-lib` (its README = source of truth for id creation/usage).
- Line 34: "`minAppVersion` set to the Obsidian version that introduced canvas `metadata.frontmatter`, which the id scheme depends on." → **See section 5: research shows this premise is shaky — no core Obsidian version introduced it.**
- Phase 0 (line 111): "Plugin template (TS, esbuild), React 18 in an ItemView, vitest, submodule wired, manifest with minAppVersion. Deliverable: empty plugin loads in a dev vault, tests run."
- Related canvas context (lines 76, 84-86): docid for canvas docs lives at "Obsidian's native canvas `metadata.frontmatter`, which survives canvas edits". Plan already hedges: "plugin-ecosystem evidence suggests stock Obsidian historically did not index canvases, so this may be core now or plugin-provided. Verify in devtools" — the adaptive `resolvedLinks` detection design works either way.

## 3. Step-01 requirements

Source: `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-neighborhood-graph/docs-internal/plan/steps/step-01-scaffold.md` (steps index: `steps/README.md`, strictly sequential 01→07).

Scope:
- TS + esbuild toolchain, standard template layout: `main.ts` entry, `manifest.json`, `styles.css`.
- React 18 + ReactDOM; placeholder `ItemView` mounting a trivial "hello graph" component proving mount/unmount lifecycle.
- vitest configured; one trivial passing test committed.
- Submodule wiring: `package.json` dep `"obsidian-id-lib": "file:submodules/obsidian-id-lib"` + `npm install`; lib is raw TS bundled by our esbuild (no submodule build step); `obsidian` stays types-only external (never bundled); smoke check: `import { DocIdServices } from 'obsidian-id-lib'` type-checks in our build.
- `manifest.json` with plugin id, name, `minAppVersion`.
- Dev vault under git-ignored path (e.g. `.dev-vault/`) + build/copy script (or symlink) placing `main.js`/`manifest.json`/`styles.css` where Obsidian loads them.
- Repo hygiene: `.gitignore` (node_modules, build output, `.tmp/`, `.out/`, dev vault), strict `tsconfig.json`, npm scripts `dev`/`build`/`test`/`check` (tsc -noEmit).

Out of scope: graph logic, real view content, settings. ESLint (if skipped → ticket it; submodule README already carries a similar ESLint follow-up).

Open items for step planning:
1. `minAppVersion` value — research and record in manifest with a WHY comment (see section 5).
2. Plugin id/name — default `obsidian-neighborhood-graph` / "Neighborhood Graph" unless human prefers otherwise.
3. Whether to run the submodule's own vitest suite in our CI loop or trust as-is.

Exit criteria: `npm run build` → plugin loads in dev vault with no console errors, placeholder view renders React; `npm test` and `npm run check` pass; fresh clone: `git submodule update --init && npm install` reaches the same state (documented in README stub).

## 4. Submodule: obsidian-id-lib

Location: `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-neighborhood-graph/submodules/obsidian-id-lib`

- **package.json**: name `obsidian-id-lib` v0.1.0, private, `"type": "module"`, `main`/`types` both `src/index.ts` (raw TS, no build/dist). License 0-BSD. `peerDependencies: { obsidian: "*" }`; devDeps: `obsidian@latest`, `typescript@^5.8.3`, `vitest@^4.1.10`. Scripts: `test` (vitest run), `test:watch`, `check` (tsc -noEmit).
- **Consuming the library** (README section, the authoritative recipe):
  1. submodule already added at `submodules/obsidian-id-lib`;
  2. consumer `package.json`: `"obsidian-id-lib": "file:submodules/obsidian-id-lib"`;
  3. `npm install` (fresh clones: `git submodule update --init` first).
  "Raw TypeScript, bundled by the consumer's esbuild — no build step here. `obsidian` is a types-only peer dependency — it is never bundled (consumers mark it external)."
- **`DocIdServices` export**: `src/index.ts` line 28 → `export { DocIdServices } from './DocIdServices';` (class in `src/DocIdServices.ts`, static factory `DocIdServices.createDefault(app.vault)`). index.ts uses `export type` for type-only exports because consumers compile with `isolatedModules`.
- Other exports: `DocIdService` (type) / `DocIdServiceDefault`, `DocIdStore`/`ExistingIdState`/`DocIdValues`, `DocIdGenerator`(+Default), `FrontmatterDocIdStore`, `CanvasDocIdStore`, `FileContentAccess`/`VaultFileContentAccess`, `PathLock`/`CrossPluginPathLock`/`ID_LOCK_REGISTRY_KEY`.
- **Directory structure**: flat `src/` — 8 impl files + 6 `*.test.ts` colocated + `src/testSupport/` (obsidianMock.ts, FakeFileContentAccess, ContentSwappingFileContentAccess, fileFactory).
- **Own vitest suite: YES.** Run inside the submodule: `npm install && npm test` (vitest, `obsidian` aliased to `src/testSupport/obsidianMock.ts` via its `vitest.config.ts` because the obsidian npm package is type-declarations-only, no runtime JS). `npm run check` = strict tsc -noEmit. NOTE: running its tests requires its own `npm install` (it has its own package-lock.json) — its devDeps are not installed by the consumer's `file:` install.
- **Canvas id location** (`src/CanvasDocIdStore.ts`): reads/writes `canvas.metadata.frontmatter.id`, creating intermediate `metadata`/`frontmatter` objects if absent. The lib itself writes this key; it only needs Obsidian to *preserve* it.
- **Follow-up it carries** (README "Dev" section): "Follow-up: add ESLint to this repo (the code arrived lint-clean from the visit-history plugin's obsidianmd ESLint setup)."
- Submodule tsconfig (useful as strictness reference): strict, noImplicitReturns, noFallthroughCasesInSwitch, noUncheckedIndexedAccess, isolatedModules, ES2021, moduleResolution node.
- APs in the submodule README: id format contract `ap_iZAE3fAcs5zXIWrTiIdx3_E`; window-key lock contract `ap_e7fWGWziwxrLmnegjIYKX_E`.

## 5. minAppVersion research (canvas `metadata.frontmatter`)

**Finding: no Obsidian core release introduced canvas `metadata.frontmatter`. It is a plugin-ecosystem convention, not a documented core feature.** Evidence:

- Official changelogs checked for canvas metadata/properties/frontmatter: 1.9.0 (https://obsidian.md/changelog/2025-05-21-desktop-v1.9.0/), 1.10.0 (https://obsidian.md/changelog/2025-10-01-desktop-v1.10.0/), 1.12.0 (https://obsidian.md/changelog/2026-02-10-desktop-v1.12.0/), 1.12.4 public (https://obsidian.md/changelog/2026-02-27-desktop-v1.12.4/), 1.13.0 (https://obsidian.md/changelog/2026-05-28-desktop-v1.13.0/), and the changelog index (https://obsidian.md/changelog/, latest = 1.13.2, 2026-07-14). **None mention canvas frontmatter/properties/metadata.**
- Obsidian help: Properties page (https://obsidian.md/help/properties) and Canvas page — no canvas properties support documented. Roadmap (https://obsidian.md/roadmap/) — nothing about canvas properties/metadata.
- Canvas format spec `canvas.d.ts` (https://github.com/obsidianmd/obsidian-api/blob/master/canvas.d.ts): `CanvasData` = `{ nodes, edges, [key: string]: any }` with comment "**Support arbitrary keys for forward compatibility**" — no `metadata` key defined, but arbitrary top-level keys are an explicit part of the format contract since the canvas era (~v1.1, Dec 2022). This forward-compat clause is what makes `metadata.frontmatter` survive.
- The `metadata.frontmatter` path is the convention used by the Advanced Canvas plugin (reads `canvas.metadata?.frontmatter?...` in its source, e.g. metadata-canvas-extension.ts) and by our id-lib (writes `metadata.frontmatter.id`, creating the objects itself). Advanced Canvas issue #344 explicitly states Obsidian "has hardcoded frontmatter support to exclusively target Markdown files from the beginning" — i.e. not core.

**Closest citable core milestone (and the more relevant capability for this plugin):**
- **Canvas link indexing became core in Obsidian 1.12**: "Backlinks in Canvas files are now detected. They are now shown in the backlinks view, and counted as links in the Graph view." — 1.12.0 Desktop early access (2026-02-10, https://obsidian.md/changelog/2026-02-10-desktop-v1.12.0/); public in **1.12.4** (2026-02-27, https://obsidian.md/changelog/2026-02-27-desktop-v1.12.4/). This resolves the high-level plan's open devtools question: canvas backlinks ARE core as of 1.12 — on 1.12.4+ installs, `resolvedLinks` canvas detection should hit the native path and our fallback canvas parser is for older installs only.

**Recommendation for the manifest** (needs human sign-off since the plan's stated basis doesn't exist as a version): set `minAppVersion: "1.12.4"` — first public release where canvas links are core-indexed, the real capability this plugin leans on; canvas arbitrary-key preservation (what the id scheme actually needs) is far older than that floor. WHY comment in code should cite the 1.12 changelog line, not "introduced metadata.frontmatter". Alternative candidates if the human prefers a lower floor: any 1.1+ (canvas + forward-compat keys exist) — but then the fallback canvas parser carries more weight.

## 6. Obsidian plugin template conventions (obsidianmd/obsidian-sample-plugin, master @ 2026-07)

- **package.json**: `"type": "module"`, `main: "main.js"`; scripts: `dev` = `node esbuild.config.mjs` (watch), `build` = `tsc -noEmit -skipLibCheck && node esbuild.config.mjs production`, `version` = version-bump.mjs; devDeps of note: `esbuild@0.25.5`, `obsidian@latest` (types-only npm package), `typescript@^5.8.3`, `@types/node@^22`, ESLint 9 flat config + `eslint-plugin-obsidianmd@^0.4.0`.
- **esbuild.config.mjs**: `entryPoints: ['src/main.ts']` (template now uses `src/`), `bundle: true`, `format: 'cjs'`, `target: 'es2021'`, `outfile: 'main.js'`, `treeShaking: true`, `sourcemap: prod ? false : 'inline'`, `minify: prod`, banner comment; **`external`: `obsidian`, `electron`, all `@codemirror/*` (autocomplete, collab, commands, language, lint, search, state, view), `@lezer/*` (common, highlight, lr), plus Node `builtinModules`**. Dev = `context.watch()`, prod = one `rebuild()` then exit.
- **tsconfig.json**: `strict: true`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess`, `module: ESNext`, `target: ES2021`, `moduleResolution: node`, `isolatedModules`, `skipLibCheck`, `forceConsistentCasingInFileNames`, `allowSyntheticDefaultImports`, inlineSourceMap/inlineSources, `lib: ["ES2021", "DOM"]`, `include: ["src/**/*.ts"]`. (Identical strictness to the submodule's tsconfig — convenient consistency. For React add `"jsx": "react-jsx"` and include `.tsx`.)
- **manifest.json fields**: `id`, `name`, `version` (semver x.y.z), `minAppVersion`, `description`, `author`, `authorUrl` (opt), `fundingUrl` (opt), `isDesktopOnly` (required boolean). `versions.json` maps plugin version → minAppVersion.
- **.gitignore**: node_modules, main.js, *.map, data.json, .vscode/.idea/.DS_Store. (Ours additionally needs `.tmp/`, `.out/`, `.dev-vault/` per step-01; note `.idea/` currently exists in repo — decide tracked vs ignored.)

## 7. React 18 + ItemView mounting pattern

Confirmed idiomatic per official Obsidian dev docs "Use React in your plugin" (https://docs.obsidian.md/Plugins/Getting+started/Use+React+in+your+plugin):

- Deps: `npm install react react-dom` + dev `@types/react @types/react-dom`; tsconfig `"jsx": "react-jsx"`. **Step mandates React 18 — pin `react@^18`/`react-dom@^18` and matching `@types/*@^18`** (npm latest is React 19 in 2026; React Flow `@xyflow/react` supports 18, and the plan targets 18).
- In the `ItemView` subclass: `async onOpen() { this.root = createRoot(this.contentEl); this.root.render(<StrictMode><ReactView /></StrictMode>); }` and `async onClose() { this.root?.unmount(); }` (`import { createRoot, Root } from 'react-dom/client'`).
- Docs also recommend an `AppContext = createContext<App>` provider + `useApp()` hook instead of prop drilling — not needed for the hello-graph placeholder but the natural pattern later.
- Note: docs mount on `this.contentEl`; some plugins use `this.containerEl.children[1]` — `contentEl` is the documented form.

## 8. Open questions / risks

1. **#QUESTION_FOR_HUMAN — minAppVersion basis.** The high-level plan pins minAppVersion to "the Obsidian version that introduced canvas `metadata.frontmatter`", but no core version introduced it (plugin-ecosystem convention; the id-lib writes the key itself and relies on canvas's documented arbitrary-key forward compatibility). Proposed: `minAppVersion: "1.12.4"` (first public release with core canvas link indexing — the capability the graph actually benefits from), with a WHY comment citing the 1.12 changelog. Approve, or pick a lower floor?
2. Positive side-finding: canvas backlinks/graph indexing is **core since 1.12** — explains the plan's "verify in devtools" observation; on modern installs the fallback canvas parser is dormant.
3. Submodule tests (step open item 3): the lib has a full vitest suite but running it needs a separate `npm install` inside `submodules/obsidian-id-lib` (own devDeps + obsidian mock alias). Cheap option: an npm script like `test:sublib` = `npm --prefix submodules/obsidian-id-lib install && npm --prefix submodules/obsidian-id-lib test`, run on demand rather than in the default `test`.
4. React version drift: `obsidian@latest` types + React 18 pin are fine today; document the deliberate React 18 pin (WHY: plan decision, React Flow compat) to prevent accidental upgrade to 19.
5. ESLint skipped in step-01 per plan → needs a follow-up ticket (mirrors the submodule's existing ESLint follow-up; sample template now ships ESLint 9 + eslint-plugin-obsidianmd, so adoption later is straightforward).
6. License: repo is KSAL-2.3 (source-available); submodule is 0-BSD — no scaffold impact, but community-plugin-store submission rules about licensing are out of scope here and may matter later.
7. No root `.gitignore` yet and `.idea/` + `ask.dnc.md` sit untracked-ish at root — scaffold's `.gitignore` should take a position on them.
