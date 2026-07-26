# Private working notes — e2e-vault-override exploration

## Raw grep of harness usage across specs
See PUBLIC.md table — derived from:
```
grep -n "ObsidianHarness\.launch\|extraFixtures\|new ObsidianHarness\|openFile(" e2e/*.e2e.ts
```
Every spec calls `ObsidianHarness.launch(...)` with either `{}` or `{ extraFixtures: ... }` — there
is NO existing constructor parameter for a vault path at all. Adding `VICINITY_E2E_VAULT` as a
process-env var (mirroring `OBSIDIAN_PATH`/`OBSIDIAN_E2E_EXTRA_ARGS`) rather than a `launch()` option
is consistent with the existing pattern (env vars read as an "escape hatch", not spec-level API).

## Full harness source was read in full (paste omitted here; see e2e/obsidianHarness.ts directly).
Key excerpts already quoted into PUBLIC.md with paraphrase; exact private excerpt of the load-bearing
function:

```ts
private static prepareVaultCopy(extraFixtures: Record<string, string> = {}): void {
    if (!fs.existsSync(DEV_VAULT_DIR)) {
        throw new Error(`Dev vault missing: dir=[${DEV_VAULT_DIR}]. Run: npm run setup:dev-vault`);
    }
    const builtPluginFile = path.join(DEV_VAULT_DIR, ".obsidian", "plugins", PLUGIN_ID, "main.js");
    if (!fs.existsSync(builtPluginFile)) {
        throw new Error(`Plugin build missing in dev vault: file=[${builtPluginFile}]. Run: npm run setup:dev-vault`);
    }
    fs.rmSync(VAULT_COPY_DIR, { recursive: true, force: true });
    fs.cpSync(DEV_VAULT_DIR, VAULT_COPY_DIR, { recursive: true });
    fs.rmSync(path.join(VAULT_COPY_DIR, ".obsidian", "plugins", PLUGIN_ID, "data.json"), { force: true });
    for (const [relativePath, content] of Object.entries({ ...CROWD_FIXTURES, ...extraFixtures })) {
        const target = path.join(VAULT_COPY_DIR, relativePath);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, content);
    }
}
```

This is THE function that must branch on the override. `VAULT_COPY_DIR` is always `.tmp/e2e/vault` —
NEVER the source. The only thing that changes between "default" and "override" should be: which
directory Obsidian is told to open (`obsidian.json`'s `vaults[id].path`), and whether this
copy/rm/fixture-write dance happens at all.

Design sketch (NOT part of the deliverable, just my own reasoning while exploring — planner should
re-derive independently):
- `resolveVaultDir(): { vaultDir: string; isOverride: boolean }` reading `process.env["VICINITY_E2E_VAULT"]`.
  - unset ⇒ `{ vaultDir: DEV_VAULT_DIR, isOverride: false }` (today's behavior, byte-identical).
  - set ⇒ validate `fs.existsSync(dir)` (loud error if not, mirroring resolveObsidianPath's message
    style) and arguably `fs.statSync(dir).isDirectory()`; "is not a vault" check is fuzzier — Obsidian
    itself will happily create `.obsidian/` on first open, so maybe the check is just "exists and is
    a directory", with a warning (not hard fail) if `.obsidian/` is absent, OR require it to already
    look enough like a vault. This ambiguity is explicitly a planning-time decision, flagged in
    PUBLIC.md risk #2.
- When `isOverride`, `launch()` must SKIP `prepareVaultCopy`'s rm/cp/fixture-write entirely and
  instead call a distinct `prepareOverrideVault(vaultDir)` that:
  - never calls `fs.rmSync` on `vaultDir` or anything derived from walking into it,
  - installs the plugin via a symlink under `<vaultDir>/.obsidian/plugins/vicinity-graph/` pointing
    at the repo's own build output (main.js/manifest.json/styles.css) — only creates the folder/link
    if missing; does not overwrite an existing real install there.
  - does NOT write `CROWD_FIXTURES`/`extraFixtures` into the real vault (extraFixtures are for the
    dev-vault-copy scenario only — overriding a real vault to write fixture notes into it would
    itself be a serious mutation of a "possibly real, user-owned" vault). This means specs using
    `extraFixtures` are incompatible with override mode; that incompatibility itself might need an
    explicit runtime guard/error ("extraFixtures not supported with VICINITY_E2E_VAULT set").
- `obsidian.json`'s `vaults[E2E_VAULT_ID].path` should point directly at `vaultDir` (no copy) when
  overriding.
- `prepareSandboxConfigDir()` itself is already safe (writes only inside `.tmp/e2e/obsidian-config`),
  no change needed there beyond what `vaultDir` gets passed in for the obsidian.json path value.

## vitest config / test coverage archaeology
`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
    test: {
        // Only OUR tests. The submodule's suite needs its own setup (obsidian
        // runtime mock alias, own devDeps) and runs via `npm run test:sublib`.
        include: ["src/**/*.test.{ts,tsx}"],
    },
});
```
There is NO `test:sublib` script in `package.json` today, and no `.gitmodules` — this comment is
either stale (from a template/history where a submodule existed) or forward-looking. Either way, it
establishes that this repo is comfortable having a SECOND test-running mechanism scoped differently
from `npm test` — that's a reasonable precedent to point to if the planner decides to widen coverage
rather than reuse `src/**/*.test.ts`.

`e2e/tsconfig.json`:
```json
{
    "extends": "../tsconfig.json",
    "compilerOptions": { "types": ["node"] },
    "include": ["./**/*.ts"]
}
```
This is only used for `npx tsc -p e2e/tsconfig.json` (type-check gate in `scripts/run-e2e.sh`), not
for running tests — confirms e2e/ has zero automated *test* execution outside real Playwright/Obsidian
runs.

`src/engine/importGuard.test.ts` is the only precedent in the repo for a "guard test" (not testing
behavior, but a structural invariant, read via node fs APIs, no mocks) — good model for a hypothetical
`obsidianHarness` structural guard IF the include glob is widened or the logic is relocated.

## README exact area
`README.md:220-257` full e2e subsection. The final sentence (`README.md:255-257`):
> "The suite is idempotent (fresh vault copy + fresh sandbox config per run under `.tmp/e2e/`) and
> never touches your real Obsidian config or the dev-vault fixtures."
This sentence's safety claim needs updating for override mode: technically once `VICINITY_E2E_VAULT`
is set, the suite explicitly DOES touch "your real Obsidian" vault (that's the whole point) but must
still not touch "your real Obsidian CONFIG" (the actual `~/.config/obsidian` / installed-Obsidian
user-data-dir stays fully sandboxed regardless — that part of the guarantee is untouched since
`SANDBOX_CONFIG_DIR` is always `.tmp/e2e/obsidian-config`).

## edge-routing__05 plan — full item 3 context
Assumption 2 in that plan (§2): "`.dev-vault` is the only vault e2e can drive (`ObsidianHarness`
hardcodes it)." — directly matches what I found reading the harness source myself; the planning doc's
own exploration already concluded the same thing independently, corroborating my read.

Follow-up ticket item 3 (§8): "`ObsidianHarness` hardcodes `.dev-vault`` — no env override, so the
ticket's real repro vault (`.out/public`) can only be checked by hand. Add `VICINITY_E2E_VAULT`."
This IS the ticket that seeded the current task; `.out/public` (gitignored, private) is presumably the
human's actual note vault containing "Epictetus"/"clear-goals.md", used only for manual screenshot
checks during edge-routing__05/06 because there was no automated way to drive it.

## Other loose ends noticed, not necessarily in scope but worth flagging to planner
- `scripts/run-e2e.sh` runs `npm run setup:dev-vault` UNCONDITIONALLY — even a run intended purely
  against `VICINITY_E2E_VAULT` would rebuild/seed `.dev-vault` needlessly (not harmful, just wasteful,
  and requires a working `npm run build` even when unrelated). Planner should decide whether to skip
  this when the override is set.
- `enableCommunityPlugins()`'s `app.plugins.setEnable(true)` is a MUTATION of whatever vault is open;
  against a real vault this enables ALL the user's other community plugins too (not just this one) —
  worth an explicit `#QUESTION_FOR_HUMAN` at planning time: is it acceptable, should it snapshot/restore,
  or should override mode assume plugins are already enabled and only call `enablePlugin`?
- `extraFixtures` (spec-level notes) become meaningless/dangerous in override mode — either must be
  explicitly disallowed (thrown at `launch()` time if both are set) or documented as writing into the
  real vault (bad default).
- No spec today is written to be vault-agnostic; the override, once added, has no spec exercising it
  end-to-end unless one is added — worth flagging that "byte-identical default + explicit guard" might
  be all that ships in this ticket, with actual override-mode e2e coverage deferred (mirrors how
  edge-routing__05 filed this as a stub follow-up rather than committing to using it immediately).
