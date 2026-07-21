# Batteries-included Obsidian e2e (Docker/CI) — portable setup

How this repo drives a **real Obsidian (Electron)** under Playwright inside Docker/CI
with **zero manual setup**: it auto-downloads a pinned Obsidian if none is available,
into a **cache path that is reused across runs**. Copy the four pieces below into any
other package to get the same.

## The idea in one line

`test:e2e` → a wrapper script guarantees an Obsidian binary exists (download-once +
cache, or honour a caller-set `OBSIDIAN_PATH`), guarantees headless flags on a
display-less host, then hands off to Playwright. A harness spawns Obsidian with an
isolated `--user-data-dir` and attaches over CDP.

## Pieces to copy

### 1. `scripts/setup-obsidian-bin.sh` — provision + cache the binary

Responsibilities:

- Pin the version: `OBSIDIAN_VERSION="1.12.7"` (a floating "latest" lets a new
  Obsidian release break e2e with no code change — bump deliberately).
- Pick the asset by arch: `obsidian-<v>.tar.gz` (x86_64) / `obsidian-<v>-arm64.tar.gz`.
  **Use the `.tar.gz`, not the AppImage** — it extracts to a plain dir with a runnable
  `obsidian` binary, needing no FUSE / `--appimage-extract` (both absent in containers).
- **Cache & reuse:** compute the binary path inside a cache dir; if it is already
  executable, print it and exit (no re-download). Otherwise `curl --fail --location`
  the release tarball, `tar -xzf` into the cache, delete the archive, print the path.
- **stdout = the binary path only.** All logging goes to **stderr**, so the caller can
  `OBSIDIAN_PATH="$(bash scripts/setup-obsidian-bin.sh)"`.
- Non-Linux exits with an actionable message (macOS/Windows ship `.dmg`/`.exe`, not a
  drop-in binary) — set `OBSIDIAN_PATH` yourself there.

Download URL shape:
`https://github.com/obsidianmd/obsidian-releases/releases/download/v<version>/<asset>`

WHY-NOT a checksum: Obsidian publishes a hash only for the `.asar` payload, not the
platform tarball; `curl --fail` + `tar` validity is the 80/20 guard.

#### Cache path — reused across runs (and across packages)

This repo caches under the repo's own `.tmp/obsidian/` (gitignored), so **repeat runs
in the same checkout reuse the download**. For reuse **across packages / checkouts**,
make the cache dir an env-overridable shared location so one download serves everyone:

```bash
# default to a shared XDG cache; override with OBSIDIAN_CACHE_DIR
CACHE_DIR="${OBSIDIAN_CACHE_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/obsidian-e2e}"
```

In Docker, mount that path as a named volume (or bind-mount the host cache) so it
survives container rebuilds:

```
-v obsidian-e2e-cache:/home/<user>/.cache/obsidian-e2e
```

Result: first run downloads (~one tarball), every later run — same repo or a sibling
package sharing the volume — finds the executable and skips straight to the tests.

### 2. `scripts/run-e2e.sh` — the `test:e2e` entry point

```bash
set -euo pipefail
cd "<repo root>"

# 1. Ensure a binary. Honour a caller-set OBSIDIAN_PATH untouched.
if [[ -z "${OBSIDIAN_PATH:-}" ]]; then
  OBSIDIAN_PATH="$(bash scripts/setup-obsidian-bin.sh)"; export OBSIDIAN_PATH
fi

# 2. Headless: no display server → Electron needs Chromium's offscreen Ozone
#    backend or it dies on boot. Explicit OBSIDIAN_E2E_EXTRA_ARGS always wins.
if [[ -z "${OBSIDIAN_E2E_EXTRA_ARGS:-}" && -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" ]]; then
  export OBSIDIAN_E2E_EXTRA_ARGS="--ozone-platform=headless --disable-gpu"
fi

# 3. Seed the vault, type-check specs, run Playwright (extra args pass through).
npm run setup:dev-vault
npx tsc -p e2e/tsconfig.json
exec npx playwright test --config e2e/playwright.config.ts "$@"
```

Wire it up: `"test:e2e": "bash scripts/run-e2e.sh"` and
`"setup:obsidian": "bash scripts/setup-obsidian-bin.sh"` in `package.json`.

### 3. `e2e/obsidianHarness.ts` — spawn Obsidian + attach over CDP

Key mechanics (all verified against Obsidian 1.12.7):

- **Connect via CDP, not `_electron.launch`.** Spawn with `--remote-debugging-port=0`,
  read the `DevTools listening on ws://…` line from **stderr**, then
  `chromium.connectOverCDP(endpoint)`. Playwright's `_electron.launch` also needs the
  main-process node inspector, which Obsidian's fused build ignores → it hangs. All
  automation here is renderer-level (`window.app` + locators), so browser-level CDP is
  enough.
- **Sandbox with `--user-data-dir=<throwaway dir>`.** Pre-write an `obsidian.json`
  there registering the vault (`open: true`, `updateDisabled: true`) so the app boots
  straight into it with no vault picker and no auto-update traffic.
- **`--no-sandbox` on Linux** — Electron's SUID chrome-sandbox is unavailable in most
  CI containers.
- **Pass `OBSIDIAN_E2E_EXTRA_ARGS`** (space-split) into the spawn args — this is how the
  headless Ozone flags from `run-e2e.sh` reach Electron.
- **Fresh vault copy per run:** `cpSync(.dev-vault → .tmp/e2e/vault)`, delete the
  plugin's `data.json`, layer in e2e-only fixtures. Keeps tests idempotent and never
  mutates the human's vault.
- **Headless window size:** pre-write `<userdata>/<vaultId>.json` with
  `{width,height,zoom}` — headless Obsidian otherwise boots a ~300×200 window and wide
  panes overflow off-screen, so pointer clicks miss. (DOM-assertion tests are immune;
  only real-click tests need this.)
- **Enable plugins at runtime:** after `layoutReady`, `Escape` the first-boot modals,
  then `app.plugins.setEnable(true)` + `app.plugins.enablePlugin(id)`.

### 4. `e2e/playwright.config.ts` — serial, single instance

- `testMatch: "**/*.e2e.ts"`, long timeouts (Electron boot + vault index is slow:
  `timeout` ~120s, `expect.timeout` ~15s).
- `workers: 1`, `fullyParallel: false` — one Obsidian window is a singleton; parallel
  workers would fight over it and the vault copy.
- `outputDir` under `.tmp/` (gitignored).

## Prerequisites in the package

- A `.dev-vault/` (or equivalent) with the **built plugin** copied into
  `.obsidian/plugins/<id>/` — this repo's `setup:dev-vault` builds + copies + seeds a
  minimal `.obsidian` config. The harness fails fast if the vault or built `main.js`
  is missing.
- `@playwright/test` as a dev dependency. `obsidian` is types-only (never imported at
  runtime in node-side test code — duplicate constants like the view-type string
  instead of importing the module).

## Runbook

```bash
npm run test:e2e                       # Linux/Docker: just works (auto-download)
npm run test:e2e -- someSpec.e2e.ts    # extra args pass through to Playwright
OBSIDIAN_PATH=/path/to/obsidian npm run test:e2e   # macOS/Windows / custom binary
```

Overridable env vars: `OBSIDIAN_PATH` (skip auto-download), `OBSIDIAN_E2E_EXTRA_ARGS`
(Chromium/Electron flags), and — with the shared-cache change above —
`OBSIDIAN_CACHE_DIR` (where the binary is downloaded/reused).
