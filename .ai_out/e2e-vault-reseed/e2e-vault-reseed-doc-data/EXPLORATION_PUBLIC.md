# EXPLORATION_PUBLIC — e2e vault reseed must wipe `doc-data/`

> Produced by the Explore agent (read-only; transcribed here by TOP_LEVEL_AGENT).
> Line numbers were accurate at branch point `e98fa71` — re-verify before editing.

## 1. `prepareVaultCopy` — `e2e/obsidianHarness.ts:496-525`

```ts
private static prepareVaultCopy(target: DevVaultCopyTarget, extraFixtures: Record<string, string> = {}): void {
  // ...guards: copyDir must resolve to VAULT_COPY_DIR; sourceDir must exist; built main.js must exist
  fs.rmSync(VAULT_COPY_DIR, { recursive: true, force: true });
  fs.cpSync(target.sourceDir, VAULT_COPY_DIR, { recursive: true });
  // Fresh plugin settings: a stale data.json (e.g. from a previous aborted
  // run) would silently change caps/settings under the assertions.
  fs.rmSync(path.join(VAULT_COPY_DIR, ".obsidian", "plugins", PLUGIN_ID, "data.json"), { force: true });
  // ...then writes CROWD_FIXTURES + extraFixtures
}
```

- Copies `.dev-vault` → `VAULT_COPY_DIR` (`e2e/obsidianHarness.ts:81`, = `.tmp/e2e/vault`) with `fs.cpSync(recursive)`.
- `PLUGIN_ID` (`e2e/obsidianHarness.ts:69` = `"vicinity-graph"`) is a shared constant, but the plugin-dir path segments are re-joined at each call site — no `pluginDirIn(vaultDir)` helper exists.
- `fs` usage is sync-only: `existsSync`, `rmSync`, `cpSync`, `mkdirSync`, `writeFileSync`.
- `obsidianHarness.ts:647` and `e2e/vaultTarget.ts:120,129` **already document** `` `data.json`/`doc-data/` `` together as "the vault's plugin state" — the docs treat them as parallel; only the code omits `doc-data/`.

## 2. Authoritative name of the per-doc dir

- **No exported constant exists.** The literal `"doc-data"` lives inline in a **private** method, `src/main.ts:125-128`:
  ```ts
  /** `.obsidian/plugins/<id>/doc-data` — the per-doc `<docid>.json` folder. */
  private docDataDirPath(): string { ... return `${pluginDir}/doc-data`; }
  ```
- `src/persistence/DocDataStore.ts:27` takes `dirPath: string` — it has no opinion on the folder name. Tests hardcode `"doc-data"` locally (`PersistenceServices.test.ts:12`, `DocDataStore.test.ts:7`, `OrphanSweeper.test.ts:13`).
- `src/persistence/` has **no barrel** and imports no `obsidian` — a plain exported string constant there *would* be node-safe, but nothing exists to import today.
- Precedent: `obsidianHarness.ts:15` imports from `../src/engine` **type-only** ("erased at transpile — the pure engine barrel never loads in the node-side test process"). There is no runtime-import-from-src precedent in `e2e/`.

## 3. Existing e2e harness guard tests (`npm test` → vitest)

`e2e/vaultTarget.test.ts`, `describe("e2e harness destructive calls")` (lines 155-209) — a **static source scan** over every `e2e/*.ts`:

- Every mutating `fs.*` call must have its destination argument rooted at `VAULT_COPY_DIR`, `SANDBOX_CONFIG_DIR`, or `OUT_DIR` (`SAFE_WRITE_ROOTS`, line 151). Destructive calls must **literally name the module constant**, not a local alias (WHY comment at `obsidianHarness.ts:500-503`).
- `READ_ONLY_FS_MEMBERS` allowlist (line 132): `existsSync, statSync, lstatSync, realpathSync, readFileSync, readdirSync`; anything else is a mutator.
- Asserts no `fs/promises` anywhere in `e2e/` (invisible to the scan) and that `node:fs` is imported exactly as `import * as fs from "node:fs";`.
- **No fixture test exercises `prepareVaultCopy` behaviorally** — it is `private static`, unexported, so only its source text is scanned.
- Fixture convention in the same file: `fs.mkdtempSync(path.join(REPO_ROOT, ".tmp", "<prefix>-"))` (line 17), cleaned in `afterAll` with `rmSync(recursive, force)` (line 18). Test names are BDD `WHEN … THEN …`.

## 4. The assertion that flakes — `e2e/settingsUxVisual.e2e.ts:142-149`

```ts
test("panel: WHEN no central is pinned THEN the panel has no Pinned centrals disclosure", async () => {
  await setOpen(toolbar(), true);
  await expect(page.locator(TOP_LEVEL_PANEL_SUMMARY_SELECTOR)
    .filter({ hasText: PINNED_CENTRALS_SUMMARY_PATTERN })).toHaveCount(0);
});
```
The comment block above it (131-141) states this is deliberately the **only** absence assertion (an exhaustiveness pin against `GraphToolbar` regressions) and that its fixture **never pins** — it relies entirely on a seed-fresh vault copy. A leaked `doc-data/<docid>.json` carrying a pin breaks that assumption.

## 5. Conventions any fix must respect

- Delete/write only under `VAULT_COPY_DIR` / `SANDBOX_CONFIG_DIR` / `OUT_DIR`, naming the constant literally.
- `import * as fs from "node:fs"`, sync API only.
- BDD `WHEN … THEN …` naming; scratch dirs under `$PWD/.tmp/`.

## Suggested fix shape (from Explore; not applied)

Mirror the `data.json` deletion right after it:

```ts
fs.rmSync(path.join(VAULT_COPY_DIR, ".obsidian", "plugins", PLUGIN_ID, "doc-data"), { recursive: true, force: true });
```

with a WHY comment covering stale pins from manual `.dev-vault` QA. This passes the existing source-scan guard unchanged. Optional larger moves (explicitly **not** required by the ticket): a shared `pluginDirIn(vaultDir)` helper to kill the repeated path segments, and/or exporting a `DOC_DATA_DIR_NAME` constant consumed by both `src/main.ts:127` and the harness.
