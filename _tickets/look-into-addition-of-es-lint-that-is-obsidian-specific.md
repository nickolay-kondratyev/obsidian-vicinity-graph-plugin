---
closed_iso: 2026-08-11T20:55:08Z
id: nid_qjuqgqfwentq2l59o5ya17vra_e
title: Look into addition of es lint that is obsidian specific
status: closed
deps: []
links: []
created_iso: '2026-08-11T20:48:36Z'
status_updated_iso: 2026-08-11T20:55:08Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
---
Look into addition of es lint that is obsidian specific (the closest thing that we can get to obsidian score-card when we publish)

We will likely need to start running the es lint as warnings. 

Also note we will want to avoid fixing `e2e` for now since that is made into a submodule and is separate from the score card check.

IF we are able to add es lint that is obsidian specific lets put the findings into this ticket. For human to look for next steps. Make the findings CONCISE.

---

## Resolution (2026-08-11)

Obsidian-specific ESLint **works and reproduces locally**. The wiring already
existed (`eslint.config.mjs` + `eslint-plugin-obsidianmd@0.4.1`, from
`eslint-typed-lint-reproduce-no-unsafe-member-access-locally.md`); this ticket
ran it and captured the findings below. Nothing was fixed — this is a report.

### How to run (score-card-equivalent surface = `src/`)

```bash
npx eslint src            # obsidianmd + typescript-eslint type-checked rules
npx eslint src -f json    # machine-readable, for grouping by rule
```

**Gotcha:** the existing `npm run lint` script is `eslint src e2e` and **exits 2**
("No files matching the pattern e2e") when the `e2e` submodule isn't checked out
— which is the normal state for score-card work. Use `npx eslint src` for now,
or make the script tolerate an absent `e2e` (next steps).

### Findings — Obsidian-specific rules on PRODUCTION code (`src/`, non-test)

25 `obsidianmd/*` findings in shipped code. By rule:

| Count | Rule | Where | Note |
|------:|------|-------|------|
| 13 | `no-console` (via `rule-custom-message`) | `src/main.ts` (debug cmd + orphan-sweep logs) | Guidelines discourage console logging; keep intentional ones, drop the rest. |
| 3 | `commands/no-plugin-id-in-command-id` | `src/main.ts:170,175,180` | Command ids embed `vicinity-graph`; Obsidian already prefixes the plugin id. |
| 3 | `commands/no-plugin-name-in-command-name` | `src/main.ts:171,176,181` | Command names repeat "vicinity graph"; UI already groups by plugin. |
| 3 | `prefer-window-timers` | `ChunkedWork.ts:34`, `PluginDataStore.ts:57`, `VicinityGraphFlow.tsx:355` | Use `window.setTimeout` (auto-fixable). |
| 1 | `hardcoded-config-path` | `PluginDataStore.ts:42` | Hardcodes `.obsidian`; use `app.vault.configDir`. |
| 1 | `no-global-this` | `libavoidLoader.ts:158` | WASM loader touches `globalThis`; verify vs. plugin sandbox. |
| 1 | `settings-tab/prefer-setting-definitions` | `VicinityGraphSettingTab.ts:77` | Advisory; our settings are a declared model — likely wontfix. |

Test files add ~a handful more `obsidianmd/*` (e.g. `no-global-this`,
`prefer-create-el`, `hardcoded-config-path` in `*.test.*`) — **out of scope**,
tests aren't shipped.

### Non-Obsidian noise (`typescript-eslint`, prod code)

~29 more prod findings from the type-checked ruleset that rides along with the
recommended config (`no-redundant-type-constituents` 10, `no-duplicate-type-constituents`
6, `no-unnecessary-type-assertion` 4, `unbound-method` 4, `no-unused-vars` 4,
`no-misused-promises` 1). Several are auto-fixable. Not score-card-specific but
surfaced by the same pass. Totals at time of writing: **prod 38 errors / 16
warnings; test-file 29** (`npx eslint src`).

### Suggested next steps (human to prioritise)

1. **Fix the cheap, real ones** on `src/` (highest score-card value):
   the 6 command-id/name findings and 3 `prefer-window-timers` (all in
   `src/main.ts` + two persistence files; timers auto-fix), plus
   `hardcoded-config-path` → `app.vault.configDir`.
2. **Decide on `no-console`** — triage `src/main.ts` logs (drop debug, keep any
   deliberate error reporting).
3. **Run-as-warnings rollout:** downgrade `obsidianmd/*` to `warn` on `src/`
   only, then fold `npx eslint src` into `npm run check`/`build` so it can't
   regress but doesn't block. Keep `e2e/` out (submodule, not score-carded);
   fix `npm run lint` to not hard-fail when `e2e` is absent.

