# EXPLORATION — VICINITY_E2E_VAULT override for the e2e Obsidian harness

## 1. `e2e/obsidianHarness.ts` — full behavioural map

Path constants (lines ~50-56):
- `REPO_ROOT` = repo root.
- `DEV_VAULT_DIR = REPO_ROOT/.dev-vault` — hardcoded, no env override today.
- `E2E_TMP_DIR = REPO_ROOT/.tmp/e2e`; `VAULT_COPY_DIR = E2E_TMP_DIR/vault`; `SANDBOX_CONFIG_DIR = E2E_TMP_DIR/obsidian-config`.
- `E2E_VAULT_ID = "0e2e0e2e0e2e0e2e"` — fixed 16-hex-char vault id written into the sandbox `obsidian.json`.

Launch flow:
- `ObsidianHarness.launch(options)` (line ~132) → `prepareVaultCopy(extraFixtures)` then `prepareSandboxConfigDir()` then `spawnAndConnect()`.
- `relaunch()` (line ~148) closes the current instance, re-seeds ONLY window state (`seedWindowState()`), then `spawnAndConnect()` again — deliberately does NOT re-run `prepareVaultCopy`, so plugin-persisted state (`data.json`) survives a restart (this is the settings-round-trip mechanism `controlsRestart.e2e.ts` depends on).
- `spawnAndConnect()` (line ~160) resolves `OBSIDIAN_PATH` via `resolveObsidianPath()`, spawns Electron with `--user-data-dir=SANDBOX_CONFIG_DIR --remote-debugging-port=0 [--no-sandbox on linux] [...OBSIDIAN_E2E_EXTRA_ARGS]`, waits for the DevTools ws endpoint on stderr, `chromium.connectOverCDP`, waits for the vault window (`app://obsidian.md`), waits for `workspace.layoutReady`, then `enableCommunityPlugins(page)`.

### Writes the harness performs today (all inside `.tmp/e2e/`, i.e. never inside `.dev-vault/` itself):

1. `prepareVaultCopy()` (private static, ~line 305):
   - Guard: throws if `DEV_VAULT_DIR` doesn't exist ("Run: npm run setup:dev-vault") and if `.dev-vault/.obsidian/plugins/vicinity-graph/main.js` is missing ("Run: npm run setup:dev-vault").
   - `fs.rmSync(VAULT_COPY_DIR, { recursive: true, force: true })` — **the rm -rf**, targets only `.tmp/e2e/vault`, never `DEV_VAULT_DIR`.
   - `fs.cpSync(DEV_VAULT_DIR, VAULT_COPY_DIR, { recursive: true })` — full copy of `.dev-vault` (source) into the throwaway copy dir. This is a READ of the source vault, not a write.
   - `fs.rmSync(path.join(VAULT_COPY_DIR, ".obsidian/plugins/vicinity-graph/data.json"), { force: true })` — deletes stale plugin settings, in the COPY only.
   - Writes `CROWD_FIXTURES` (4 files under `crowd/`) + any `extraFixtures` passed by the calling spec into `VAULT_COPY_DIR` (never into `DEV_VAULT_DIR`).
2. `prepareSandboxConfigDir()` (~line 337): `rmSync`/`mkdirSync` `SANDBOX_CONFIG_DIR` (`.tmp/e2e/obsidian-config`), writes `obsidian.json` there (registers `VAULT_COPY_DIR` under `E2E_VAULT_ID`, `open: true`, `updateDisabled: true`), calls `seedWindowState()`.
3. `seedWindowState()` (~line 352): writes `<SANDBOX_CONFIG_DIR>/<E2E_VAULT_ID>.json` (window width/height/zoom) — sandbox-config only.
4. `enableCommunityPlugins()` (~line 400+): at RUNTIME, in-page, calls `app.plugins.setEnable(true)` and `app.plugins.enablePlugin(PLUGIN_ID)`. Obsidian persists `setEnable(true)` to `<vault>/.obsidian/community-plugins.json` inside the **currently open vault**, i.e. today that's `VAULT_COPY_DIR`, never `DEV_VAULT_DIR`.
5. During a live run, the plugin itself writes `data.json` (global view settings) and Obsidian writes `.obsidian/workspace*.json` etc. — all inside whichever vault is open (today always `VAULT_COPY_DIR`).

**Conclusion: today, 100% of harness/Obsidian writes land in `.tmp/e2e/**` (a throwaway copy) or `.tmp/e2e/obsidian-config` (sandbox user-data-dir). `.dev-vault/` itself is only ever READ (`fs.existsSync`, `fs.cpSync` as source).** The only path that ever calls `rm -rf`-equivalent on something derived from the source vault is `VAULT_COPY_DIR`, which is a `cpSync` clone — never the source directory itself.

### Plugin install today
The plugin is NOT installed by the harness — it's baked into `.dev-vault/.obsidian/plugins/vicinity-graph/` by `scripts/setup-dev-vault.sh`'s `npm run build` step (this writes real files under the checked-out `.dev-vault/`, a local, gitignored, disposable directory — see §3). The harness's `prepareVaultCopy` merely requires that file to exist in `DEV_VAULT_DIR` before cloning it into `VAULT_COPY_DIR`. For an override vault, this build-artifact-in-place install step is exactly the "write" that must not touch the user's real vault — a symlinked plugin dir (`<target>/.obsidian/plugins/vicinity-graph` → repo build output) is the natural non-mutating alternative, but even a symlink is a write to `<target>/.obsidian/plugins/`, so it needs a deliberate, reversible, clearly-scoped implementation (create the plugin folder + symlinked main.js/styles.css/manifest.json only if absent; never touch anything else under `<target>/.obsidian/`).

### `community-plugins.json` / `.obsidian/` implications for a foreign vault
- Obsidian's `app.plugins.setEnable(true)` persists into `<open-vault>/.obsidian/community-plugins.json`. Against a real, arbitrary vault this WOULD mutate the user's own community-plugins list (enabling all their other community plugins is called for by the harness's `setEnable(true)`, not just this plugin) — a real behavior change on the user's actual config, and worth flagging as a `#QUESTION_FOR_HUMAN` for the implementation phase: does the override mode need to skip `setEnable(true)` if plugins are already globally enabled, or otherwise avoid clobbering the user's own list?
- `.obsidian/workspace.json`, `.obsidian/workspace-mobile.json`, per-vault window-state, and plugin `data.json` are all written by Obsidian itself into whatever vault is open — for a real/override vault these become mutations of the user's real vault, not a throwaway copy. This is the core of the "deliberate" plugin-install / write requirement in the goal.
- The sandbox `obsidian.json`'s `vaults[E2E_VAULT_ID].path` is what tells Obsidian which directory IS the vault; pointing it straight at the override path (skipping `cpSync`) is how the override reaches Obsidian, but every write above then lands in the real directory unless further guarded.

## 2. How each `e2e/*.e2e.ts` spec uses the harness

All 9 specs call `ObsidianHarness.launch(...)` in a top-level `test.beforeAll`/`beforeEach`-style hook and `harness.close()` in an `afterAll`. None construct the harness with a vault path — the only constructor option is `{ extraFixtures?: Record<string,string> }`.

| Spec | launch() args | Notes on dev-vault-fixture dependence |
|---|---|---|
| `controlsRestart.e2e.ts` | `{ extraFixtures: RESTART_FIXTURES }` | opens `HUB`; depends on restart/relaunch semantics, self-contained extra fixtures |
| `edgeRouting.e2e.ts` | `{ extraFixtures: ROUTING_FIXTURES }` | opens `HUB_PATH`, `BOUNCE_PATH`, `FACING_HUB_PATH` — self-contained fixtures |
| `edgeRoutingEval.e2e.ts` | `{}` (no extras) | opens `BOUNCE_PATH`, dynamic `centralPath` — uses **built-in dev-vault fixtures** (`hub-medium`, `zzdense-hub`, `facing/hub-facing`, etc., all seeded by `scripts/setup-dev-vault.sh`) — this spec is the most dev-vault-fixture-dependent (perf/eval numbers assume the specific dense/medium/facing fixture shapes) |
| `nodeOutline.e2e.ts` | `{}` | opens `OUTLINE_NOTE_PATH`, `NON_NODE_BEARING_PATH`, `OUTLINE_COVER_PATH` — depends on `outline-note.md`/`outline-cover.md` dev-vault fixtures |
| `pinnedCentralScenario.e2e.ts` | `{ extraFixtures: SCENARIO_FIXTURES }` | opens `HUB`, `OTHER_MAIN`, `X` |
| `settingsResetReview.e2e.ts` | `{}` | no `openFile` calls shown; likely default note1/dev-vault state |
| `settingsResetVerify.e2e.ts` | `{}` | same |
| `settingsUxVisual.e2e.ts` | `{}` | opens `ALPHA_PATH` — depends on `projects/alpha.md` dev-vault fixture |
| `vicinityGraph.e2e.ts` | `{}` | opens `ALPHA_PATH`, `NOTE1_PATH` — depends on `note1.md`, `projects/alpha.md` |

**Implication for the override:** any `VICINITY_E2E_VAULT`-driven spec must supply its own fixtures/notes (the goal's "point a spec at an arbitrary vault" scenario) — specs that rely on baked-in dev-vault fixture paths (note1, alpha, hub-medium, outline-note, etc.) are NOT candidates for running against an arbitrary override vault; only a spec written to be vault-content-agnostic (or a new dedicated spec) would use it.

## 3. Playwright config / package.json scripts / existing env vars / dev-vault creation

- `e2e/playwright.config.ts`: `testDir: "."`, `testMatch: "**/*.e2e.ts"`, `workers: 1`, `fullyParallel: false` (single Obsidian instance/vault-copy, serial). `TEST_TIMEOUT_MS = 120_000`, `EXPECT_TIMEOUT_MS = 15_000`. No env var handling here.
- `package.json` scripts: `test` = `vitest run`; `test:e2e` = `bash scripts/run-e2e.sh`; `setup:dev-vault` = `bash scripts/setup-dev-vault.sh`; `setup:obsidian` = `bash scripts/setup-obsidian-bin.sh`; `check`/`build`/`dev`/`test:watch`. No `test:sublib` script currently exists (only a stale comment in `vitest.config.ts` referencing it, presumably a leftover from a submodule that isn't present in this checkout — `.gitmodules` doesn't exist).
- Existing e2e env vars: `OBSIDIAN_PATH` (required, validated in `ObsidianHarness.resolveObsidianPath()`, `e2e/obsidianHarness.ts:106-122`) and `OBSIDIAN_E2E_EXTRA_ARGS` (`e2e/obsidianHarness.ts:166`, space-separated flags appended to the Electron spawn, no quoting support). `scripts/run-e2e.sh` auto-provisions `OBSIDIAN_PATH` via `scripts/setup-obsidian-bin.sh` when unset, and defaults `OBSIDIAN_E2E_EXTRA_ARGS` to headless Ozone flags when no display is detected (both "explicit env wins" patterns — the same pattern `VICINITY_E2E_VAULT` should follow: unset ⇒ current default path, unchanged).
- `.dev-vault/` creation: `scripts/setup-dev-vault.sh` (idempotent, `write_if_missing`/`copy_if_missing` helpers) creates fixture notes/canvas/attachments, a minimal `.obsidian/{app.json,appearance.json,community-plugins.json}` (auto-enabling the plugin id), then runs `npm run build` to copy the built plugin artifacts into `.dev-vault/.obsidian/plugins/vicinity-graph/`. `scripts/run-e2e.sh` always calls `npm run setup:dev-vault` unconditionally before `tsc -p e2e/tsconfig.json` and `playwright test` — this call would need to become conditional (skip when `VICINITY_E2E_VAULT` is set, since there is no reason to build/seed `.dev-vault` for a run that never touches it) or at minimum must not fail/require anything about the override path.
- `.gitignore` lines 12/15: `.dev-vault/` and `.tmp/` are both gitignored — confirms both the source dev-vault and all harness-owned throwaway state are local-only.

## 4. Test coverage conventions — where would a "never rm -rf the source vault" guard live?

- `vitest.config.ts` `include: ["src/**/*.test.{ts,tsx}"]` — **e2e/ and scripts/ are NOT included**; `npm test` never runs anything under `e2e/`. There is currently no vitest project/config that covers `e2e/` helpers at all — `e2e/obsidianHarness.ts` has zero direct unit-test coverage today; it's only exercised indirectly by running the real e2e suite (`npm run test:e2e`, not part of `npm test`).
- The only precedent for a "guard" test enforcing a structural invariant via a plain vitest test (no wasm/no real subprocess) is `src/engine/importGuard.test.ts` — a pure, filesystem-reading test with no runtime dependencies, colocated next to the code it guards, run under `npm test`.
- Given the include glob is `src/**/*.test.{ts,tsx}` only, a guard test for the harness has three realistic homes:
  1. Extend the pure "path resolution" logic (e.g. a `resolveVaultDirs(env)`-style pure function computing `{ sourceDir, copyDir, mutateInPlace }` from `process.env`) into a `src/`-rooted module so it can get an ordinary colocated `*.test.ts` under the existing vitest glob — the cleanest fit with today's conventions, but is architecturally odd since `src/` is plugin runtime code, not e2e tooling (layering note: CLAUDE.md's `view → adapters → engine` layering is about the plugin bundle, not `e2e/`; a new `src/e2e-support/` or similar would be a new, undocumented top-level concern).
  2. Widen `vitest.config.ts`'s `include` (or add a second Vitest project) to also pick up `e2e/**/*.test.ts`, mirroring the abandoned/aspirational `test:sublib` split already hinted at in the file's own comment — lets the guard test live directly beside `obsidianHarness.ts` without inventing a new `src/` module, but changes what `npm test` covers (needs a decision on whether this is desired, and whether e2e/tsconfig's `types: ["node"]` config is compatible with vitest's own environment).
  3. A dedicated `node --test`/plain script assertion invoked from `scripts/run-e2e.sh` or a new `npm run` script — matches nothing existing, not recommended given the vitest precedent above.
- **This is a load-bearing open question for the planning phase** — the acceptance criterion "a test or explicit guard proves the source vault is never rm -rf'ed" has no obvious existing home; option 2 (extend `vitest.config.ts` include to cover `e2e/*.test.ts`, add `e2e/obsidianHarness.test.ts`) is the least invasive given `npm test`'s current one-glob simplicity, but is a scope change to what `npm test` runs and should be flagged to the human/planner explicitly.

## 5. README.md — where to document `VICINITY_E2E_VAULT`

- Section header: `### e2e suite (npm run test:e2e)` at `README.md:220`.
- The existing env-var documentation pattern is at `README.md:233-253`: a bulleted list ("**Binary:** ... `OBSIDIAN_PATH`" / "**Display:** ... `OBSIDIAN_E2E_EXTRA_ARGS`") followed by "Both are overridable — set `OBSIDIAN_PATH` and/or `OBSIDIAN_E2E_EXTRA_ARGS` yourself and the script leaves them untouched", then a macOS example block (`README.md:249-253`), then the closing sentence at `README.md:255-257`: "The suite is idempotent (fresh vault copy + fresh sandbox config per run under `.tmp/e2e/`) and never touches your real Obsidian config or the dev-vault fixtures." — **this exact sentence needs to be updated/qualified once an override path exists**, since the whole point of the new var is to point at something OTHER than the dev-vault fixtures, and the safety guarantee ("never touches...") must be restated precisely for the override case (never touches the SOURCE vault; installs the plugin deliberately; still never `rm -rf`s the target).
- Natural insertion point: a new bullet (parallel to "Binary" / "Display") documenting `VICINITY_E2E_VAULT`, right after the "Display" bullet (`README.md:240-243`) and before the "Both are overridable" sentence — or its own short paragraph after the closing idempotency sentence, given it changes that sentence's guarantee.

## 6. `.ai_out/edge-routing__05/main/DETAILED_PLANNING__PUBLIC.md` — what it proposed

This is the origin of the current ticket. §8 "Follow-up tickets to file at the end", item 3 (verbatim):

> **`ObsidianHarness` hardcodes `.dev-vault`** — no env override, so the ticket's real repro vault (`.out/public`) can only be checked by hand. Add `VICINITY_E2E_VAULT`.

Context: the plan's §2 "Assumptions" (assumption 2) explicitly states `.dev-vault` is the only vault e2e can drive (`ObsidianHarness` hardcodes it), and the whole edge-routing__05 investigation used ad-hoc `.tmp/` probe scripts plus manual checks against a private real vault (`.out/public`, containing an "Epictetus"/"clear-goals.md" note) BECAUSE there was no way to drive Playwright/Obsidian against that real vault automatically. The plan doesn't design the override itself (it's an out-of-scope follow-up), but it establishes: (a) the motivating use case is checking real-vault repros that can't be reproduced as committed fixtures, (b) no design constraints beyond "add an env var," (c) it's explicitly filed as a follow-up ticket, not solved in that ticket.

## 7. Risks / constraints summary for the override design

1. **Safety of the rm -rf path**: `prepareVaultCopy`'s `fs.rmSync(VAULT_COPY_DIR, ...)` + `fs.cpSync(DEV_VAULT_DIR, VAULT_COPY_DIR, ...)` sequence must remain reachable ONLY when the resolved vault dir is the default `.dev-vault` (env unset). When `VICINITY_E2E_VAULT` is set, the harness must open that path directly (no copy, no `data.json` deletion of a copy that doesn't exist, no fixture-writing into it) — i.e. a structurally different code path, not a parameterized one, to make "impossible to rm -rf the override" true by construction rather than by convention.
2. **Existence/shape validation**: must fail loudly (actionable error, mirroring `resolveObsidianPath`'s style) when the override path doesn't exist, or isn't a vault (no `.obsidian/` — though note a truly "arbitrary" vault might not have `.obsidian/` yet either; needs a decision on what "is not a vault" means operationally) or isn't a directory.
3. **Plugin installation is itself a write**: today the plugin is baked into `.dev-vault` at `setup:dev-vault` time and merely copied by the harness. For an override vault there is no equivalent build step, so the harness must install (or the user must have installed) the plugin into `<override>/.obsidian/plugins/vicinity-graph/` without it being a full-copy operation on the source tree. A symlink from `<override>/.obsidian/plugins/vicinity-graph` to the repo's build output directory is the natural low-mutation option, but creating that symlink is still a write inside the user's vault directory and must be careful (only create the plugin subfolder + symlink if not already present; never delete/replace anything unexpected there; consider whether to clean it up on close or leave it, and document the choice).
4. **`community-plugins.json` mutation**: `enableCommunityPlugins()`'s `app.plugins.setEnable(true)` persists to the real vault's `.obsidian/community-plugins.json` when pointed at an override — this could change the user's OWN existing plugin-enablement state. Needs an explicit decision (e.g., snapshot + restore on close, or only call `enablePlugin` without `setEnable(true)` if already enabled, or accept and document the behavior).
5. **Sandbox config dir reuse**: `SANDBOX_CONFIG_DIR` (`.tmp/e2e/obsidian-config`) and `E2E_VAULT_ID` are currently hardcoded/shared across all runs; pointing `obsidian.json`'s vault path at the override should still be safe since that dir is always `.tmp/`-scoped, not inside the target vault — this part is already override-safe as long as only the `path` value changes.
6. **Default-path byte-identical requirement**: the unset-env-var code path (today's entire behavior) must not change AT ALL — implies the override must be implemented as an early branch/guard, not a refactor of the shared code that risks behavior drift for the default case.
7. **No unit-test home for the safety guarantee today**: `npm test`'s vitest include (`src/**/*.test.{ts,tsx}`) does not cover `e2e/`; a new guard test proving "rm -rf only reachable for `.dev-vault`" needs either a widened vitest include, a `src/`-hosted pure-logic extraction, or acceptance of "explicit guard" (e.g., a runtime assertion in the harness itself, like a `path.resolve(...) !== path.resolve(overridePath)` check before any `rmSync`) rather than an automated test — this must be decided during planning, it is not a solved problem in the existing conventions.
8. **Spec compatibility**: most existing specs assume specific dev-vault fixture content (note1, alpha, hub-medium, outline-note, facing/hub-facing, etc.) baked in by `scripts/setup-dev-vault.sh` — they are not candidates for pointing at an arbitrary vault. The override is meaningful only for a new/adapted spec that doesn't depend on those fixtures, or for ad hoc manual runs (`npm run test:e2e -- someSpec.e2e.ts` against a real vault to reproduce a bug, per the edge-routing__05 motivating case).
9. **`scripts/run-e2e.sh` unconditionally runs `npm run setup:dev-vault`** before every Playwright invocation — when `VICINITY_E2E_VAULT` is set this build/seed step is pointless (and requires a functioning build even for an unrelated override vault); likely needs to become conditional or the exploration should flag that it's currently unconditional so implementation can decide.

## Key file:line references

- `e2e/obsidianHarness.ts:52` `DEV_VAULT_DIR`
- `e2e/obsidianHarness.ts:53-55` `E2E_TMP_DIR` / `VAULT_COPY_DIR` / `SANDBOX_CONFIG_DIR`
- `e2e/obsidianHarness.ts:106-122` `resolveObsidianPath()` (error-message style precedent)
- `e2e/obsidianHarness.ts:132-137` `launch()`
- `e2e/obsidianHarness.ts:148-157` `relaunch()`
- `e2e/obsidianHarness.ts:160-...` `spawnAndConnect()`, `OBSIDIAN_E2E_EXTRA_ARGS` usage at line ~166
- `e2e/obsidianHarness.ts:305-...` `prepareVaultCopy()` — the rm -rf + cpSync + fixture-write logic
- `e2e/obsidianHarness.ts:337-...` `prepareSandboxConfigDir()`
- `e2e/obsidianHarness.ts:352-...` `seedWindowState()`
- `e2e/obsidianHarness.ts:400+` `enableCommunityPlugins()`
- `e2e/playwright.config.ts` — full file, no env handling
- `package.json` — scripts block
- `scripts/run-e2e.sh` — unconditional `npm run setup:dev-vault`, `OBSIDIAN_PATH`/`OBSIDIAN_E2E_EXTRA_ARGS` defaulting pattern
- `scripts/setup-dev-vault.sh` — idempotent fixture/plugin-build seeding of `.dev-vault`
- `vitest.config.ts` — `include: ["src/**/*.test.{ts,tsx}"]`, stale `test:sublib` comment
- `src/engine/importGuard.test.ts` — precedent for a structural guard test
- `README.md:220-257` — e2e section, exact insertion point for new env var docs
- `.ai_out/edge-routing__05/main/DETAILED_PLANNING__PUBLIC.md:426-427` — origin of this ticket (§8 item 3)
- `.gitignore:12,15` — `.dev-vault/`, `.tmp/`
