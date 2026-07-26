# IMPLEMENTATION REVIEW — `VICINITY_E2E_VAULT` (ticket nid_se3h2v45c10x9j42utbm8v2sn_e)

Diff reviewed: `edc9941..HEAD` on branch `e2e-vault-override`.

---

# ROUND 1 RE-REVIEW (`3b42b81`, `57fd27b`) — VERDICT: **READY TO MERGE**

All six round-0 findings (B1, S1–S5) are **fully addressed**. No regressions, no new
BLOCKING or SHOULD-FIX issues. One bounded NIT below, optional.

### Gates re-run

`npm test` green — 73 files / **985** tests (was 979; +6). `npm run check` green.
`npx tsc -p e2e/tsconfig.json` green. Working tree clean.

### B1 — `allowExternalVault` opt-in: AIRTIGHT ✅

`e2e/vaultTarget.ts:95-110` + `e2e/obsidianHarness.ts:145-154`.

- `launch()` is the **only** place `process.env[VAULT_OVERRIDE_ENV_VAR]` is read and the
  only public constructor (the class constructor is `private`), so there is no second
  entry point. `spawnAndConnect()` is `private static` with exactly two callers:
  `launch()` (after the gate) and `relaunch()` (an instance method — only reachable from
  an already-gated harness, and it carries `vaultMode` rather than re-reading the env).
- The gate fires **before** `prepareSandboxConfigDir()` and before `childProcess.spawn`,
  i.e. before anything is written or launched. Verified by reading the call order at
  `obsidianHarness.ts:146-154`; the implementer also verified it live
  (`settingsResetVerify.e2e.ts` refuses before Obsidian starts).
- `assertExternalLaunchAllowed` now owns both external-mode refusals (opt-in +
  `extraFixtures`) — better SRP than the inline throw it replaces, and unit-tested
  (4 BDD tests, `vaultTarget.test.ts:80-100`).
- `externalVault.e2e.ts:41` is the sole opt-in caller; `allowExternalVault?: true`
  (literal `true`, not `boolean`) makes `allowExternalVault: false` non-expressible.
- Declining the `run-e2e.sh` spec-filter default is fine — I had marked it optional, and
  the throw covers the case at the only point that matters.

### S3 — inverted allowlist scan: GENUINELY BITES ✅ (mutation-tested by the reviewer)

`e2e/vaultTarget.test.ts:126-235`. I did not take this on trust — I dropped a **new**
file into `e2e/` that the implementer never anticipated:

```ts
// e2e/zzScanProbe.ts   (temporary, removed afterwards)
import * as fs from "node:fs";
export function bad(dir: string): void { fs.unlinkSync(dir + "/note.md"); }
```

→ `npm test` **failed**: `expected [ 'dir + "/note.md"' ] to deeply equal []`. So the
scan covers every `e2e/*.ts`, an fs member nobody listed, and a non-constant destination.
Destination-arg positions are sound (`cpSync`/`copyFileSync`/`link`/`symlink` → arg 2,
`renameSync` → both, default arg 1), and `topLevelArguments`'s depth counter handles
nested `path.join(...)`/object args and multi-line calls. Unresolvable destinations fail
**closed** (anything not rooted at a safe constant is an offender), which is the right
default. Adding `OUT_DIR` to the safe roots is legitimate — every spec already
screenshots to `.out/`.

### S1 / S2 — corrected comments are factually true ✅

`vaultTarget.ts:112-121` and `obsidianHarness.ts:522-540` now match the decompiled
Obsidian 1.12.7 exactly: `setEnable` writes only `localStorage["enable-plugin-<appId>"]`
(user-data dir); the false "`enablePlugin` rewrites the vault's `community-plugins.json`"
claim is gone from all three places incl. the README. The replacement WHY-NOT (loading
our code would write `data.json`/`doc-data/` into a vault where the human never enabled
it) is true, and "no per-plugin lever: `enablePlugin` requires the master switch anyway"
checks out — `loadPlugin` early-returns unless `isEnabled()`. S2's "ACCEPTED
CONSEQUENCE: every community plugin enabled in that vault loads and runs" now states
what the code does instead of contradicting it.

### S4 / S5 — README ✅

The recipe symlinks `main.js`/`manifest.json`/`styles.css` individually after
`npm run build`, never the repo root, with the WHY inline; `assertExternalVaultReady`'s
error message carries the same command, and its `main.js` existence check still works
through a symlink (dangling link ⇒ correct "not installed" error). `.gitignore` gains
`doc-data/` as belt-and-braces. The caveat is honest and now complete: `workspace.json`
(incl. **0-byte truncation** on signal shutdown), `core-plugins.json`, the plugin's
`data.json`, and every other community plugin loading and running. The pre-existing
idempotency sentence is correctly re-scoped to "In its default mode". Declining the
graceful-shutdown change is right — it would touch the shared path under the green
default suite; the caveat documents the consequence.

### 💡 NIT (optional, non-blocking) — residual scan bypasses worth one line

`e2e/vaultTarget.test.ts:198` keys off the literal `fs.` prefix. Two forms slip through
silently (I probed both; suite stayed green):

```ts
import { unlinkSync } from "node:fs"; unlinkSync(dir + "/a.md");   // named import
import * as fsp from "node:fs";       fsp.promises.writeFile(…);   // fs.promises.*
```

Neither matches the style of any of the nine existing `e2e/` files (all use an
`fs.`-prefixed namespace/default import) and the test's doc comment scopes itself to
node-side `fs`, so this is a small residual, not false confidence. One-line hardening if
desired: assert every scanned file's `node:fs` import matches
`/^import (?:\* as )?fs from "node:fs";$/m` and that no file contains `fs.promises`.
Same class of limit applies to the name-based `SAFE_WRITE_ROOTS` (a future file could
define its own `OUT_DIR`) — inherent to a source scan and acceptable.

### Round-0 findings — status

| # | Status |
|---|---|
| B1 opt-in gate | **Closed** — verified airtight, no bypass path |
| S1 false WHY-NOT | **Closed** — all three sites corrected |
| S2 accepted consequence | **Closed** — comment + README |
| S3 guard scope | **Closed** — mutation-tested by the reviewer |
| S4 symlink recipe | **Closed** — per-artifact symlinks + `doc-data/` ignored |
| S5 caveat honesty | **Closed** — truncation + `core-plugins.json` + plugin loading |

The gamma-breadcrumb e2e failure remains pre-existing and ticketed
(`docs-internal/tickets/ticket-e2e-gamma-breadcrumb-fails-headless.md`, last touched in
`507a27a`, before this branch).

---

# ROUND 0 (original review, for the record)

Diff reviewed: `edc9941..4b3e3c4` (`8b1c026`, `debb1d7`, `9c34020`).

## Summary

A pure `e2e/vaultTarget.ts` resolves a discriminated-union `VaultTarget`; the harness
branches once in `launch()`, keeps every destructive `fs` call in the dev-vault-copy
branch (plus a belt-and-braces `copyDir === VAULT_COPY_DIR` assert), refuses
`extraFixtures` in external mode, and requires the plugin to be pre-installed +
pre-enabled. 13 new BDD unit tests (incl. a source scan) run under a widened vitest
`include`. `run-e2e.sh` skips dev-vault seeding when the var is set. README gets a
documented section with a caveat block.

The shape of the design is right and the default path is intact. One safety hole and
some factually wrong WHY-NOT documentation keep it from being ready.

### Gates re-run by the reviewer

| Gate | Result |
|---|---|
| `npm test` | green — 73 files / 979 tests |
| `npm run check` | green |
| `npx tsc -p e2e/tsconfig.json` | green |
| gamma-breadcrumb pre-existing claim | sanity-checked: `docs-internal/tickets/ticket-e2e-gamma-breadcrumb-fails-headless.md` exists, last touched in `507a27a` (before this branch), unrelated to this diff. Accepted. |

### The `setEnable(true)` deviation — VERIFIED CORRECT

Decompiled the bundled Obsidian 1.12.7
(`.tmp/obsidian/obsidian-1.12.7/resources/obsidian.asar`):

```js
e.prototype.setEnable=function(e){ ... localStorage.setItem("enable-plugin-"+this.app.appId, e?"true":"false"),
   e ? for (a of Array.from(this.enabledPlugins)) this.enablePlugin(a) : ... }
```

`setEnable(true)` writes **only** Chromium `localStorage`, which lives in the throwaway
`--user-data-dir` sandbox, and then loads whatever the vault's own
`community-plugins.json` already lists. It does **not** write into the opened vault.
The implementer's claim holds. See S1/S2 for what is nonetheless wrong around it.

## 🚨 BLOCKING

### B1 — Every non-vault-agnostic spec still runs against the external vault and rewrites the user's plugin state
`e2e/obsidianHarness.ts:136-151` (launch has no per-spec opt-in) + `e2e/playwright.config.ts` (`testMatch: "**/*.e2e.ts"`).

`VICINITY_E2E_VAULT` is read globally, so with the var exported in a shell a plain
`npm run test:e2e` (no spec filter — nothing enforces one) launches **all ten** specs
against the user's real vault. Specs without `extraFixtures` sail past the only
external-mode guard and then mutate through the app:

- `e2e/settingsResetVerify.e2e.ts` writes globals and drives **Restore defaults** →
  overwrites the user's real `.obsidian/plugins/vicinity-graph/data.json`.
- `e2e/settingsUxVisual.e2e.ts`, `nodeOutline.e2e.ts` toggle exclusion patterns /
  preview preference → same file, plus per-doc `doc-data/*.json` pins/depths.
- `obsidianHarness.openGraphView()` detaches the user's right-sidebar leaves and resizes
  the split → persisted into their `.obsidian/workspace.json`.

Acceptance criterion 3 says the source vault is never "`rm -rf`ed **or otherwise
mutated**". Deleting is structurally prevented; *mutating the user's saved settings* is
not, and it happens silently. The exploration already called this out (`EXPLORATION_PUBLIC.md`
§7.8: "most existing specs … are NOT candidates for pointing at an arbitrary vault"),
but nothing in the implementation enforces it.

**Fix (small):** make external mode opt-in per spec, symmetrically with the
`extraFixtures` refusal:

```ts
static async launch(options: { extraFixtures?: …; allowExternalVault?: true } = {}) {
  const target = resolveVaultTarget(…);
  if (target.mode === "external-in-place" && options.allowExternalVault !== true) {
    throw new Error(
      `This spec is not vault-agnostic and would write plugin settings into your vault. ` +
      `Only specs that opt in (allowExternalVault) may run with ${VAULT_OVERRIDE_ENV_VAR}. ` +
      `Run: npm run test:e2e -- externalVault.e2e.ts. vaultDir=[${target.vaultDir}]`);
  }
```

with `externalVault.e2e.ts` the sole opt-in caller, plus a unit test
("WHEN the override is set AND the caller did not opt in THEN launch throws").
Optionally belt-and-braces in `scripts/run-e2e.sh`: default the spec filter to
`externalVault.e2e.ts` when the var is set and no args were passed.

## ⚠️ SHOULD-FIX

### S1 — The stated WHY-NOT for skipping `enablePlugin()` is factually false
`e2e/vaultTarget.ts:76-79`, `e2e/obsidianHarness.ts:521-524`, `README.md` ("adding it
would rewrite your vault's `community-plugins.json`"), `IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md:27`.

From the same 1.12.7 bundle: `enablePlugin(id, save=false)` only resolves the manifest
and `loadPlugin`s it — no `enabledPlugins.add`, no `requestSaveConfig`. The call that
rewrites the file is `enablePluginAndSave`:

```js
e.prototype.enablePluginAndSave=function(e){ … this.enablePlugin(e,!0) … this.enabledPlugins.add(e), this.requestSaveConfig() }
e.prototype.saveConfig=function(){ … this.app.vault.writeConfigJson("community-plugins", Array.from(this.enabledPlugins)) }
```

So the shipped behaviour is fine, but the reason recorded for it — in three places,
including user-facing README — is wrong, and a future maintainer will "fix" the
constraint on a false premise. CLAUDE.md: "EXPLICIT without lies or misconceptions".
**Fix:** keep requiring pre-enablement, restate the honest reason: (a) `setEnable(true)`
only loads what the vault already lists, so pre-enablement is what makes us load at all,
and (b) we refuse to load plugin code (which writes its own `data.json`) into a vault
where the human has not enabled it.

### S2 — The "all your other plugins get loaded" consequence is documented as a rejected option, not as what we do
`e2e/vaultTarget.ts:76-78` gives "`setEnable(true)` would switch on every other community
plugin they have" as a WHY-NOT — while `obsidianHarness.ts:530-532` does exactly that.
The comment now contradicts the code, and the consequence is real and absent from the
README: every community plugin enabled in the target vault loads and runs (Templater,
periodic notes, sync, …), each free to write to that vault.
**Fix:** reword the comment as an accepted consequence, and add one sentence to the
README caveat block ("every community plugin enabled in that vault is loaded and runs").

### S3 — The destructive-call source scan is under-scoped and enumerates mutators by name
`e2e/vaultTarget.test.ts:110-124`.

It matches only `fs.rmSync|mkdirSync|writeFileSync` and `fs.cpSync`. Reintroducing
`fs.unlinkSync(path.join(target.vaultDir, …))`, `rmdirSync`, `renameSync`,
`appendFileSync`, `copyFileSync`, `truncateSync`, or anything from `node:fs/promises`
passes the guard **green** while mutating a real vault — i.e. the guard would not fail
for the very regression it exists to catch. It also scans one file only, and (by
construction) cannot see in-app writes done through `page.evaluate` — which is exactly
hole B1.
**Fix:** invert the scan — match every `fs\.(\w+)\(`, allowlist the read-only members
(`existsSync`, `statSync`, `readFileSync`), and require every other call's first (or, for
`cpSync`, second) argument to root at `VAULT_COPY_DIR`/`SANDBOX_CONFIG_DIR`; additionally
assert the harness does not import `node:fs/promises`. Extend the scan over `e2e/*.ts`
rather than the single file, and state in the test's doc comment that it covers
node-side fs only.

### S4 — README's symlink recipe writes vault-owned plugin state into the repo working tree
`README.md` — `ln -s "$PWD" /path/to/vault/.obsidian/plugins/vicinity-graph`.

With the repo root as the plugin dir, Obsidian writes the vault's plugin state through
the symlink into the checkout: `data.json` (gitignored, fine) **and**
`doc-data/<docid>.json` per-doc pins/depths (`src/persistence/DocDataStore.ts`), which is
**not** gitignored — untracked files land in the working tree and can be committed.
**Fix:** add `doc-data/` to `.gitignore`, or recommend a plugin dir containing symlinks to
just `main.js` / `manifest.json` / `styles.css`.

### S5 — Observed `workspace.json` truncation is recorded only in `.ai_out/`
`IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md:69-71` reports Obsidian truncating the target
vault's `.obsidian/workspace.json` to 0 bytes when the harness SIGKILLs it
(`obsidianHarness.ts:220-233`). That is user-visible layout loss in a real vault and the
strongest concrete reason for the "use a scratch vault" warning — it belongs in the
README caveat. Optionally, close external-mode runs gracefully (CDP window close / longer
SIGTERM grace) before escalating to SIGKILL.

## 💡 Suggestions (NIT)

- `e2e/obsidianHarness.ts:384-408`: `prepareVaultCopy` takes `target` but writes through
  the module-level `VAULT_COPY_DIR`, so `target.copyDir` is decorative and `.tmp/e2e/vault`
  is spelled in two places (`vaultTarget.ts:54`). Deliberate (the scan needs the constant)
  and the assert makes divergence loud — acceptable, worth one WHY-NOT line.
- `e2e/vaultTarget.ts:57`: a quoted `~/vault` resolves to `<repo>/~/vault`; the
  "does not exist" message shows the mangled path. Expanding `~` (or naming it in the
  message) would save a confused minute.
- `e2e/vaultTarget.test.ts:16-18`: scratch dirs are created at module import time; a
  `beforeAll` would keep import side-effect-free.
- Symlink / trailing-slash / relative override paths: reviewed, no risk — `path.resolve`
  normalises and no code path deletes an external path.
- Override pointed at `.dev-vault` or `.tmp/e2e/vault`: reviewed, non-destructive (external
  mode never wipes); `.tmp/e2e/obsidian-config` is rejected by the `.obsidian/` check.

## Default-path regression risk (D7)

Low. `launch()` branches before any behaviour change; `enableCommunityPlugins`,
`prepareSandboxConfigDir`, `seedWindowState`, `relaunch` and the unset branch of
`run-e2e.sh` are unchanged; `prepareVaultCopy` gained only two pre-checks that are
tautologies in default mode. Widening the vitest `include` adds `e2e/**/*.test.ts` only;
Playwright's `testMatch` is `**/*.e2e.ts`, so no overlap. No behaviour-capturing test or
`ap_XXX_E` anchor was removed.

## Documentation Updates Needed

- README: correct the `enablePlugin`/`community-plugins.json` claim (S1); add the
  "all other community plugins load and run" line (S2); add the `workspace.json`
  truncation-on-kill note (S5). The pre-existing "never touches your real Obsidian
  config" sentence stays accurate — it scopes the default mode, and the new subsection
  sits below it — but a "(default mode)" qualifier would remove all doubt.
- `.gitignore`: `doc-data/` (S4).
- No CLAUDE.md change required.

## Verdict

**NOT READY** — 1 blocking, 5 should-fix. B1 (any spec may rewrite the user's real
plugin settings) must be fixed before merge; S1/S2 are documentation-honesty fixes on a
claim I verified false against the shipped Obsidian binary; S3 hardens the guard that
criterion 3 rests on. Everything else is small. Design, default-path safety and the
`setEnable(true)` deviation are sound.
