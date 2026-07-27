# Exploration: pin `obsidian` devDependency

Repo: `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin`
Branch: `chore/pin-obsidian-typings`

## 1. package.json

Path: `package.json`

- `devDependencies.obsidian`: `"latest"` (line 27)
- `dependencies`: `@xyflow/react ^12.11.2`, `d3-force ^3.0.0`, `elkjs ^0.12.0`, `libavoid-js 0.4.5`, `obsidian-id-lib ^0.1.0`, `react ^18.3.1`, `react-dom ^18.3.1`
- Other devDependencies: `@playwright/test ^1.61.1`, `@types/d3-force ^3.0.10`, `@types/node ^26.1.1`, `@types/react ^18.3.12`, `@types/react-dom ^18.3.1`, `esbuild ^0.25.5`, `typescript ^5.8.3`, `vitest ^4.1.10`
- scripts:
  - `"check": "tsc -noEmit && npm run check:e2e"`
  - `"check:e2e": "tsc -noEmit -p e2e/tsconfig.json"`
  - `"build": "npm run check && node esbuild.config.mjs production"`
  - `"test": "vitest run"`
  - `"test:e2e": "bash scripts/run-e2e.sh"`
- `obsidian` is `external` in esbuild config: `esbuild.config.mjs` lines 93-97 — comment: "`obsidian` (and friends) are provided by the Obsidian runtime — never bundled." External list: `["obsidian", "electron", "@codemirror/*", "@lezer/*", ...builtinModules]`. `obsidian-id-lib` is explicitly NOT external (bundled into main.js).

## 2. Installed version / lockfile

- `node_modules/obsidian/package.json`: `"version": "1.13.1"` (description: "Type definitions for the latest Obsidian API").
- `package-lock.json` (lines 1782-1787):
  ```
  "node_modules/obsidian": {
      "version": "1.13.1",
      "resolved": "https://registry.npmjs.org/obsidian/-/obsidian-1.13.1.tgz",
      "integrity": "sha512-qtTEA2pmhJzhuhJqzbBFRYhpIOqvW+krDYjtFynv66KbxBbumHBlsJfWw3I4jtnK/6fZwbQhCrmmDdRwXmX56w==",
  ```
- `"obsidian"` appears in package-lock.json in exactly 2 other spots: line 27 (root package.json devDependencies entry, `"latest"`) and line 1805 — `obsidian-id-lib`'s `peerDependencies: { "obsidian": "*" }`.
- No other `package.json` in the repo declares `obsidian` (searched whole tree excluding `node_modules`; only root `package.json` and two unrelated `.tmp/obsidian/.../app.asar.unpacked/node_modules/{btime,get-fonts}/package.json` from the downloaded e2e Obsidian binary cache). `e2e/` has no its own `package.json`, only `e2e/tsconfig.json`.

## 3. minAppVersion / e2e pin

- `manifest.json`: `"minAppVersion": "1.12.4"`.
- `scripts/setup-obsidian-bin.sh` line: `OBSIDIAN_VERSION="1.12.7"` — this is the real Obsidian **app** binary pinned for e2e (downloaded from `obsidianmd/obsidian-releases` GitHub releases), separate from the npm `obsidian` typings package. Script header comments explain: pinned deliberately so a floating "latest" app release can't break e2e silently; also flags that bumping to 1.13+ changes slider-readout e2e behavior (see `e2e/settingsUxVisual.e2e.ts`).
- `CLAUDE.md` also states: `minAppVersion` `1.12.4` is a floor, never a ceiling (canvas core indexing).

## 4. Published npm `obsidian` versions (network reachable — ran `npm view obsidian versions --json`, saved to `.tmp/obsidian-versions.json`)

Full 1.x tail of published versions:
```
1.10.0, 1.10.2-1, 1.10.2, 1.10.3, 1.11.0, 1.11.4,
1.12.0, 1.12.2, 1.12.3,
1.13.0, 1.13.1
```

**Key fact: neither `1.12.4` nor `1.12.7` exist as published npm `obsidian` versions.** The npm typings package versioning does not track every Obsidian app release 1:1 — it jumps `1.12.3` → `1.13.0`. So:
- `manifest.json`'s `minAppVersion` (`1.12.4`, an app version) has no matching npm typings version; the closest npm version **at or below** it is `1.12.3`.
- `scripts/setup-obsidian-bin.sh`'s `OBSIDIAN_VERSION` (`1.12.7`, an app version for the e2e binary) likewise has no matching npm typings version; closest npm version at or below it is also `1.12.3`.

## 5. Overrides / transitive dependents

- No `overrides` or `resolutions` field in `package.json` or `package-lock.json` for `obsidian`.
- The only transitive dependent declaring a peerDependency on `obsidian` is `obsidian-id-lib` (`"obsidian": "*"`, package-lock.json line 1805) — an open peer range, imposes no version constraint.

## 6. Risk scan: `@since 1.13.x`-tagged APIs vs. usage in src/ and e2e/

Extracted every declaration in `node_modules/obsidian/obsidian.d.ts` (v1.13.1) whose preceding JSDoc carries `@since 1.13.0` or `@since 1.13.1`. New-in-1.13 surface consists mainly of:
- `ButtonComponent.setDestructive()` / `removeDestructive()` (obsidian.d.ts ~1360-1371)
- `ConfirmationButton` class + `ConfirmationModal` class and their members (`onClick`, `setInitialFocus`, `setSecondary`, `setCancel`, `addClass`, `addCheckbox`, `addButton`, `addCancelButton`) (~1922-1994)
- `DisplayValueComponent` class (`valueEl`, `setValue`, `setStatus`) (~2267-2292)
- `Plugin.settings?: unknown` (declarative settings API) (~4919)
- `PluginSettingTab`-related `getSettingDefinitions`/`getControlValue`/`setControlValue` (~5159-5173)
- `Setting.errorEl`, `setErrorMessage`, `addDisplayValue` (~5731-5751, `addDisplayValue` is `@since 1.13.1`)
- The whole declarative-settings type surface: `SettingColorControl`, `SettingControlBase`, `SettingDefinitionAction/AddItem/Base/Control/Empty/Group/List/Page/Render`, `SettingDropdownControl`, `SettingFileControl`, `SettingFolderControl`, `SettingNumberControl`, `SettingPage`, `SettingSliderControl`, `SettingTextAreaControl`, `SettingTextControl`, `SettingToggleControl`, `setDisplayFormat`, `refreshDomState`, etc. (~5860-6768)

Grepped `src/` and `e2e/` for every one of these symbol names (class names and method names): **zero matches**. None of the 1.13-only declarative-settings API or `ConfirmationModal`/`DisplayValueComponent` surface is referenced anywhere in the plugin's source or e2e tests. This means downgrading the `obsidian` npm typings package to `1.12.3` (or any pre-1.13 version) is not expected to break `tsc -noEmit` on these grounds — no direct evidence of reliance on 1.13-only types. (This scan doesn't cover indirect/structural typing differences elsewhere in the 1.12→1.13 diff beyond the explicitly `@since`-tagged additions.)

## 7. CLAUDE.md Guardrails (verbatim)

```
## Guardrails

- Preserve `ap_XXX_E` anchor identifiers; don't remove anchor points or behavior-capturing tests without explicit alignment.
- Spot issues outside your task → file a `docs-internal/tickets/` ticket, don't silently patch.
- Temp files → `$PWD/.tmp/`. Test screenshots → `.out/` (never source-controlled).
```

Also relevant, from the Conventions section just above Guardrails:
```
- `main.js` and `styles.css` are **build artifacts** — never hand-edit.
- `minAppVersion` `1.12.4` is a floor, never a ceiling (canvas core indexing). `obsidian-id-lib` is bundled; only `obsidian` is external.
```

## 8. Ticket file / change_log tool

- No file matching ticket id `nid_6kms4zn8o8c8r7g983oqlvvky_e` exists anywhere under `docs-internal/tickets/` (or elsewhere in the repo, excluding node_modules). Searched by exact id substring — no hits.
- `docs-internal/tickets/` contains 25 existing ticket files, named descriptively (e.g. `ticket-eslint-adoption.md`, `ticket-node-drag-reposition.md`), not by the `nid_...` id scheme.
- A `_change_log/` directory exists at repo root with dated entries (`YYYY-MM-DD_HH-MM-SSZ.md`, e.g. `_change_log/2026-07-20_19-49-53Z.md`) — confirmed the tool/convention exists. Per instructions, no change_log entry was written by this exploration.

## Notes on tooling used

- Network access to the npm registry worked (`npm view obsidian versions --json` succeeded); output saved to `.tmp/obsidian-versions.json` in the repo (scratch file, not committed).
