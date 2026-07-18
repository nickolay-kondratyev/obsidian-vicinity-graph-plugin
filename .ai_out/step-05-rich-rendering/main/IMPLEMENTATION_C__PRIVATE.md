# IMPLEMENTATION_C__PRIVATE — Playwright e2e harness (step-05 Phase C)

## STATE: COMPLETE — **RUN-HERE, 18/18 PASSED** against real Obsidian 1.12.7, headless, in this sandbox.

## What shipped (files)
- `e2e/obsidianHarness.ts` — launch/sandbox/readiness/interaction helpers
- `e2e/neighborhoodGraph.e2e.ts` — 18 serial tests, ONE Obsidian instance
- `e2e/playwright.config.ts`, `e2e/tsconfig.json`
- `package.json`: `@playwright/test` devDep; `test:e2e` = `setup:dev-vault && tsc -p e2e/tsconfig.json && playwright test --config e2e/playwright.config.ts`
- README: scripts row + "e2e suite" section

## Approach (research-verified, KISS)
- **NOT `_electron.launch`**: Obsidian's packaged Electron ignores `--inspect=0` (fuses) → Playwright's electron launcher hangs at timeout (verified here, attempt 1). Instead: spawn Obsidian with `--remote-debugging-port=0`, parse "DevTools listening on ws://…" from stderr, `chromium.connectOverCDP`. Renderer-level automation only (locators + `window.app`) — sufficient.
- Sandbox per obsidian-launcher source (cloned+read): `--user-data-dir=<.tmp/e2e/obsidian-config>`, pre-written `obsidian.json` `{updateDisabled, vaults:{id:{path,ts,open:true}}}`; `--no-sandbox` on linux.
- Plugins enabled at runtime: Escape (dismiss trust modal) → `app.plugins.setEnable(true)` + `enablePlugin(id)` → waitForFunction plugin loaded. No leveldb localStorage seeding needed.
- Vault: fresh copy `.dev-vault` → `.tmp/e2e/vault` each run + `crowd/c1..c4.md` fixtures (c1/c2 ~9KB → NodePriorityChain sizeScore keeps exactly them at cap 2). Stale plugin `data.json` removed from the copy.
- nodeCap at runtime via `plugin.pluginDataStore.saveGlobalView(...)`, rebuild by bouncing active file alpha→note1 (same-path change is a no-op by design).
- Headless in containers: `OBSIDIAN_E2E_EXTRA_ARGS="--ozone-platform=headless --disable-gpu"` (works; no xvfb needed).

## Gotchas discovered (cost real debugging)
1. View mounts with `.neighborhood-graph-empty` at boot (active file = New tab) — wait for empty OR flow.
2. Stock right-sidebar tabs (backlink/outline) intercept pointer events on nodes near pane borders → harness detaches all other rightSplit leaves after opening the view; `rightSplit.setSize(500)` widens the pane.
3. RF `fitView` runs on MOUNT only; after active-file switches nodes can sit outside the pane → `remountGraphView()` (detach + reopen via command) before pointer tests.
4. `/dev/shm` scratchpad is noexec — AppImage `--appimage-extract` must run from the repo fs (`.tmp/`).
5. Env facts: no DISPLAY/xvfb/passwordless-sudo, but network OK; Obsidian 1.12.7 AppImage from obsidianmd/obsidian-releases latest; extracted at `.tmp/squashfs-root/obsidian` (gitignored).

## Verified expectations (all held exactly on the real run)
- alpha focus: 3 nodes / 3 edge paths / ×2 badge on alpha→note1 / projects group, no badge / no overlay.
- note1 focus: 11 nodes; thumbnail img `app://` on note1; gamma breadcrumb `solo/` + trimmed fm title; projects+crowd groups.
- cap 2: 3 nodes visible; crowd badge "+2"; overlay "+6 hidden"; title breakdown "(vault root) — 3 hidden\nprojects — 2 hidden\nsolo — 1 hidden".
- Arrowhead stroke == computed `--text-faint` in BOTH themes, never rgb(177,177,183).
- Click → current tab; ctrl/cmd-click → +1 markdown leaf + active file switches.

## Gate results (final)
- `npm test`: 451 passed/43 files + sublib 69/6 — exit 0.
- `npm run check`: exit 0. `npm run build`: exit 0 (main.js 1,846,828 B; styles.css 27,627 B).
- `tsc -p e2e/tsconfig.json`: exit 0.
- `npm run test:e2e` (full command, OBSIDIAN_PATH + headless args): **18 passed** — exit 0. Re-ran multiple times (idempotent).
- Missing OBSIDIAN_PATH: fails fast, rc=1, actionable message (verified).

## Consciously skipped (recorded in PUBLIC)
- Hover page-preview, native attachment Menu contents, group-drag, container-query density, empty-state, "+N" thumbnail badge positive case, reuse-layout position stability.

## No prod-code changes. No #QUESTION_FOR_HUMAN.

## Iteration 1 (review feedback; verdict was READY)
Dispositions: MINOR-1 FIXED (close() try/finally → kill always runs), MINOR-2 REJECTED
(serial coupling is accepted-by-reviewer KISS design), NIT-1 FIXED (extra-args doc-comment:
space-separated, no quoting), NIT-2 TICKETED (`docs-internal/tickets/ticket-e2e-view-type-constant-dedup.md`
— prod code off-limits in Phase C), NIT-3 FIXED ("KEEP LAST or reset cap" comment on truncation test).
Gates re-run for real: e2e 18/18 exit 0 (OBSIDIAN_PATH=.tmp/squashfs-root/obsidian + headless
ozone args, ~1.7s warm), npm test 451/43 + 69/6 exit 0, npm run check exit 0
(logs: .tmp/iter1-e2e.log, .tmp/iter1-unit.log, .tmp/iter1-check.log).
