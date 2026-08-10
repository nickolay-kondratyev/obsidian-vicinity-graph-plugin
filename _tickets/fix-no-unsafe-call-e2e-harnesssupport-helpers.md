---
closed_iso: 2026-08-10T22:36:31Z
id: nid_khnm364awuizz6cmr2pxxjkpk_e
title: 'fix no-unsafe-call: e2e harness/support helpers'
status: closed
deps: []
links: [nid_f7vkm00ahrak377r5dqpiyy9v_e, nid_db5s4uypdiesrk6oi8nms46wv_e, nid_wv95rkafrcxn9by7t5ng95dvn_e,
  nid_j1zgoruaddxyhykf2maxsnzqn_e]
created_iso: '2026-08-10T22:23:31Z'
status_updated_iso: 2026-08-10T22:36:31Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [pre-release, eslint, no-unsafe-call]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-3
---
## Background

A pre-release lint pass flagged `@typescript-eslint/no-unsafe-call` violations across the codebase. That rule fires when a value typed `any` (or an unsafely-typed expression) is invoked as a function — typically from untyped third-party APIs, `JSON.parse` results, dynamic `require`/loader boundaries, or Playwright `page.evaluate` return values crossing into test code.

NOTE: there is currently NO ESLint config committed in this repo (see `docs-internal/tickets/ticket-eslint-adoption.md` — ESLint 9 flat config adoption is still pending). These findings came from an out-of-repo type-checked lint run. Before fixing, the agent MUST establish how to REPRODUCE the findings: either (a) coordinate with the ESLint-adoption ticket to land the flat config with `@typescript-eslint` type-checked rules and an `npm run lint` script, or (b) run typescript-eslint locally with the `recommended-type-checked` (or `strict-type-checked`) preset against the files below. Do not guess at fixes without a reproducible lint signal.

## How to fix (per file)

For each flagged call site, give the invoked value a real type instead of `any`:
- Add/assert precise types at the untyped boundary (declare a typed interface for the external module, type the `page.evaluate` return, type the parsed JSON) rather than sprinkling `as` casts blindly.
- Prefer a single well-named typed wrapper at each seam over per-call-site casts (DRY).
- Do NOT silence with `// eslint-disable` unless the boundary is genuinely un-typeable, and if so document WHY inline.
- Keep changes behavior-preserving; run `npm run check` and the relevant `npm test` / `npm run test:e2e` specs for touched surfaces.

## Files in THIS group (full relative paths)
e2e/buttonChrome.ts
e2e/nodeContentBox.ts
e2e/obsidianHarness.ts
e2e/settingsTabPage.ts
e2e/settingsWriteWindow.ts
e2e/vaultTarget.ts
e2e/playwright.config.ts

Scope: e2e shared harness/page-object/config helpers (non-spec). These are the seams where Obsidian `app` and `page.evaluate` results are typed once and reused, so fixing them well (typed wrappers) will remove many downstream unsafe-call sites in the spec groups A/B. Consider doing this group FIRST.

## Resolution (closed 2026-08-10)

### Reproduction established (option b)
Ran `typescript-eslint@8` with the `recommended-type-checked` preset (type-aware, `parserOptions.project` = `e2e/tsconfig.json` + root `tsconfig.json`) against the seven in-group files, out-of-tree in a scratch dir (no repo `package.json` / config change — ESLint adoption is still `docs-internal/tickets/ticket-eslint-adoption.md`'s job).

Baseline: **42 `@typescript-eslint/no-unsafe-call` violations**, all concentrated in two files:
- `e2e/obsidianHarness.ts` — 38
- `e2e/settingsTabPage.ts` — 4

The other five in-group files (`buttonChrome.ts`, `nodeContentBox.ts`, `settingsWriteWindow.ts`, `vaultTarget.ts`, `playwright.config.ts`) had **zero** — their `page.evaluate`/`Locator.evaluate` callbacks are already typed by Playwright/DOM, so they were left untouched.

### Fix — one typed seam (DRY), zero eslint-disable
Root cause: every offending call went through `(window as unknown as { app: any }).app`, so calls on the undocumented Obsidian internals (`app.vault.*`, `app.workspace.*`, `app.plugins.plugins[id].pluginDataStore.*`, `app.setting.*`) invoked `any`.

- Added **`e2e/obsidianInternals.ts`** — a **type-only** module declaring `E2eObsidianApp`, a NARROW view of the exact `window.app` members the suite drives (vault, workspace/leaf/split, commands, plugins + the two stores, setting manager). Store methods are typed off the engine's own `ViewSettings`/`DepthSettings`/`NodeExclusionSettings`/`NodeOverride`/`NodePreviewPreference` so a field rename becomes a `tsc` error, not a silent `undefined`. Being type-only, it never loads the `obsidian` runtime into the node-side process, and the type is safe to reference inside `page.evaluate` closures (types are erased, never serialized to the browser).
  - WHY no runtime `getApp()` helper: a `page.evaluate` callback is serialized to the browser and cannot reference module-scope functions — so the single narrowing cast `(window as unknown as { app: E2eObsidianApp }).app` is inlined as the first line of each evaluate. The DRY win is the shared TYPE.
- `e2e/obsidianHarness.ts` + `e2e/settingsTabPage.ts`: swapped every `{ app: any }` cast for `{ app: E2eObsidianApp }`, dropped the now-redundant `: any` callback annotations (`leaf`), and added `!` at the `plugins.plugins[pluginId]` index (guaranteed-loaded precondition the harness's own `Boolean(plugins[pluginId])` polls enforce; `noUncheckedIndexedAccess` adds the `| undefined`).
- Removed 3 `as` casts in `readGlobals`/`readNodeOverrides`/`readLocalPins` that the new store typing made unnecessary (they were flagged by `no-unnecessary-type-assertion` once the results stopped being `any`).

### Verification
- Lint re-run over all seven files: **0 `no-unsafe-call`, 0 other `@typescript-eslint` violations**.
- `npm run check` (tsc strict, src + e2e): pass.
- `npm test`: 129 files / 1845 tests pass (includes the `e2e/*.ts` source-scan guards — new type-only file has no `fs`, so `vaultTarget.test.ts` etc. stay green).
- `npm run test:e2e -- perFileStorePersistence.e2e.ts`: 2/2 pass against real Obsidian — exercises the typed store seam (`readNodeOverrides`/`readLocalPins`/`saveNodeSizeOverride`/`saveNodeContentOverride`/`saveLocalPin`/`deleteNote`/`reloadPlugin`) end-to-end. Changes are behavior-preserving by construction (all edits erase at transpile, so the JS serialized into the browser is byte-identical).
