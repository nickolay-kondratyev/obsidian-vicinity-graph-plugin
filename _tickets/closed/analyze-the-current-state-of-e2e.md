---
closed_iso: 2026-08-04T18:00:13Z
id: nid_ttnk0jv42aiamw8o3x18j3dde_e
title: Analyze the current state of e2e
status: closed
deps: []
links: [nid_fygwk293msqdumkkorz6gmyrh_e]
created_iso: '2026-08-04T17:55:38Z'
status_updated_iso: 2026-08-04T18:00:13Z
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Analyze how we currently do e2e,
Analyze https://github.com/jesse-r-s-hines/wdio-obsidian-service 
Research if there are other ways to do e2e for obsidian.

Add findings into this ticket whether we should consider upgrading our e2e setup.

---

# Findings (2026-08-04)

## Verdict

**Do NOT migrate to `wdio-obsidian-service`.** Our Playwright/CDP harness already
covers every scenario we test, and a migration is a rewrite of ~2 700 lines of
specs + a 700-line harness for capabilities we currently do not use (multi-version
matrix, mobile, parallel instances, cross-vault switching). The one genuine gap it
would close — testing against more than a single pinned Obsidian build — is
closable in our own setup for roughly a 5-line change
(`nid_fygwk293msqdumkkorz6gmyrh_e`).

## 1. How we do e2e today

Entry: `npm run test:e2e` → `scripts/run-e2e.sh` → Playwright
(`e2e/playwright.config.ts`, `testMatch: **/*.e2e.ts`, `workers: 1`,
`fullyParallel: false`, 120 s test timeout, 15 s expect timeout).

- **Binary provisioning** — `scripts/setup-obsidian-bin.sh` downloads a PINNED
  Obsidian (`OBSIDIAN_VERSION="1.12.7"`, Linux tarball — deliberately not the
  AppImage, no FUSE in containers), caches it under `.tmp/obsidian/`, prints the
  path; `run-e2e.sh` exports it as `OBSIDIAN_PATH`. `OBSIDIAN_PATH` set by hand
  wins (required on macOS/Windows).
- **Headless** — when neither `$DISPLAY` nor `$WAYLAND_DISPLAY` is set,
  `run-e2e.sh` defaults `OBSIDIAN_E2E_EXTRA_ARGS="--ozone-platform=headless
  --disable-gpu"`. So Linux/CI is genuinely zero-setup.
- **Launch + attach** — `e2e/obsidianHarness.ts` spawns Obsidian with
  `--user-data-dir=<sandbox>` + `--remote-debugging-port=0` (+ `--no-sandbox` on
  Linux) and attaches with `chromium.connectOverCDP`, parsing the "DevTools
  listening on ws://…" line off stderr. Documented WHY-NOT: Playwright's
  `_electron.launch` needs the MAIN-process node inspector, which Obsidian's
  packaged build ignores (Electron fuses) — it hangs. All our automation is
  renderer-level, so browser-CDP is sufficient.
- **Sandboxing** — pre-written `obsidian.json` (vault registered `open: true`,
  `updateDisabled: true`) so no vault picker and no update traffic; pre-seeded
  `<vaultId>.json` window state (1280×800) because headless Obsidian otherwise
  boots a ~300×200 window and pointer tests physically cannot reach nodes.
  Community plugins are turned on at RUNTIME via `app.plugins.setEnable(true)`
  rather than seeding Chromium's localStorage leveldb (explicitly to avoid a
  leveldb writer dependency).
- **Vault** — throwaway `cpSync` copy of `.dev-vault` per run under
  `.tmp/e2e/vault`, with `data.json` and `workspace.json` deleted so manual-QA
  state never leaks in; plus e2e-only `crowd/` fixtures and per-spec
  `extraFixtures`. `e2e/vaultTarget.ts` + `vaultTarget.test.ts` guard the
  destructive paths with a source scan.
- **Opt-in real-vault mode** — `VICINITY_E2E_VAULT` opens an arbitrary vault in
  place; only `externalVault.e2e.ts` may run that way, every other spec refuses.
- **Restart / reload** — `relaunch()` (full process restart against the same
  vault copy, re-seeding window geometry) and `reloadPlugin()` (disable/enable, to
  prove a value came off `data.json`, not RAM).
- **Typed seams** — the harness is the ONE place that knows the store shape
  (`readGlobals`, `saveGlobalView`, `readNodeOverrides`, …), typed off
  `src/engine` interfaces via type-only imports, so a field rename is a `tsc`
  error. Page objects: `settingsTabPage.ts`, `settingsBaseline.ts`,
  `settingsWriteWindow.ts` (settles the settings write debounce — no sleeps),
  `buttonChrome.ts`. Node-side guards (`selectorGuard.test.ts`,
  `settingsBaseline.test.ts`, `vaultTarget.test.ts`) run under `npm test`.
- **Scale** — 14 `*.e2e.ts` specs (~2 700 lines) + ~1 400 lines of harness/page
  objects + ~580 lines of node-side guards; `check:e2e` type-checks it all.
- **Gaps** — (a) single pinned Obsidian version; nothing exercises the declared
  `minAppVersion` floor 1.12.4 nor a newer release; (b) no CI: the repo has no
  `.github/workflows/`, so e2e runs only when a human runs it; (c) no mobile
  coverage; (d) serial single-instance (fine — the specs share one app window).

## 2. `wdio-obsidian-service` (jesse-r-s-hines)

Three MIT, ESM packages: `wdio-obsidian-service` (WDIO service),
`obsidian-launcher` (download/launch/sandbox/install-plugins, usable
stand-alone + CLI), `wdio-obsidian-reporter`. Latest **3.1.1**, published
2026-06-07; 59 releases since 2025-02-23 — actively maintained but young and
niche (~51 GitHub stars). Peers: `webdriverio ^9`, optional
`appium`/`appium-uiautomator2-driver`.

What it gives you that we do not have:

- **App-vs-installer version matrix.** Obsidian ships an Electron "installer" and
  a self-updating JS "app" bundle; the service can pin each independently and
  understands `"earliest"` (= your manifest `minAppVersion`), `"latest"`,
  `"latest-beta"`. Capabilities array = a real version matrix in one run. This is
  the one capability we materially lack.
- **Beta channel** via Obsidian Insiders creds (`OBSIDIAN_EMAIL` /
  `OBSIDIAN_PASSWORD`, **2FA must be disabled** — a real operational cost).
- **Mobile** — `emulateMobile` (Obsidian's `app.emulateMobile` on desktop
  Electron) and real Android via Appium + an AVD. iOS unsupported.
- **Vault switching / fast reset** — `browser.reloadObsidian({vault})` and
  `obsidianPage.resetVault()` (file-level reset without a reboot). Our equivalent
  is a full `relaunch()`; a faster reset would be nice but is not a blocker.
- **Parallelism** — `maxInstances: 4` sandboxed Obsidian instances.
- **Plugin/theme install by id/repo** into the test vault (`plugins: ["."]`,
  `id:templater-obsidian`, …).
- **A maintained CI workflow template** in its sample plugin.

Costs of adopting it wholesale:

- Test runner swap: Playwright `expect`/locators/`page.evaluate` → WDIO
  `$`/`expect-webdriverio`/`browser.execute` + Mocha. Every spec and page object
  is rewritten; our jsdom/vitest suites stay, so we'd run three runners
  (vitest + mocha/WDIO), and `e2e/*.test.ts` node-side guards would need rehoming.
- We lose Playwright-specific things the suite leans on: its auto-waiting
  locator/`expect` retry semantics, trace/screenshot tooling, and
  `connectOverCDP`-based control we already understand.
- New dependency surface: webdriverio 9 + chromedriver plumbing + (for mobile)
  Appium/Android Studio, vs today's single `@playwright/test` dev dep.
- Our deliberate design choices (no leveldb dep, CDP-only, external-vault safety
  rails, source-scanned destructive paths) would all have to be re-expressed on
  someone else's seams — and `VICINITY_E2E_VAULT`-style in-place real-vault mode
  is NOT something the service offers.

## 3. Other options surveyed

- **Spectron** — deprecated since 2022, Electron's own docs now point at WDIO.
  Dead end.
- **Playwright `_electron.launch`** — the "official" Electron path; does not work
  against packaged Obsidian (Electron fuses block the main-process inspector).
  Already recorded as a WHY-NOT in `obsidianHarness.ts`. Our CDP attach is the
  workaround, and it is the same mechanism `obsidian-launcher` uses internally
  (`chrome-remote-interface`).
- **Raw WebdriverIO + `wdio-electron-service`** — possible but the Obsidian-
  specific setup (vault, plugin enablement) is exactly the pain that motivated
  `wdio-obsidian-service`; no reason to hand-roll it.
- **Obsidian's own tooling** — there is none. The community forum threads
  (2022 → 2025) conclude there is no official framework; out of ~2 600 public
  plugin repos only a handful have e2e at all. Our setup is already well above
  the ecosystem median.
- **`obsidian-launcher` stand-alone (MIT, usable without WDIO)** — the
  interesting middle path: it downloads/caches app+installer versions, resolves
  `earliest`/`latest`/`latest-beta`, sandboxes the config dir, installs local and
  community plugins into a vault, and its CLI accepts pass-through args
  (`-- --remote-debugging-port=9222`), i.e. it composes with our existing
  Playwright CDP attach. It would replace `scripts/setup-obsidian-bin.sh` and part
  of `prepareSandboxConfigDir` **without touching a single spec**.

## 4. Recommendation

1. **Keep Playwright + our harness.** It is self-contained, headless-clean,
   documented, guarded by source scans, and carries safety rails
   (`VICINITY_E2E_VAULT`) no third-party service provides. Migrating buys
   capabilities we do not use at the price of rewriting the whole suite. 80/20
   says no.
2. **Close the real gap cheaply**: make the pinned version an env knob and run the
   `minAppVersion` floor occasionally →
   ticket `nid_fygwk293msqdumkkorz6gmyrh_e`.
3. **Reconsider `obsidian-launcher` (stand-alone, not the WDIO service) only if**
   we later want a true multi-version matrix including `latest-beta` and
   app-vs-installer splits. It is a drop-in for our bash provisioning and keeps
   the specs untouched — a contained, reversible change. Not worth doing before a
   need exists.
4. **Reconsider `wdio-obsidian-service` wholesale only if** we ever need Obsidian
   **mobile** coverage (its emulate/Android support is the thing we genuinely
   cannot reproduce cheaply). Vicinity Graph is a pointer-driven desktop graph
   view, so that day may never come.
5. **Unrelated but adjacent gap: no CI.** e2e (and `npm test`) run only by hand.
   Not filed here to keep this ticket focused — worth its own ticket if we want a
   GitHub workflow before publishing.

Sources: <https://github.com/jesse-r-s-hines/wdio-obsidian-service>,
<https://webdriver.io/docs/wdio-obsidian-service/>,
<https://www.npmjs.com/package/obsidian-launcher>,
<https://forum.obsidian.md/t/standard-approach-for-writing-automated-end-to-end-tests-for-plugins/31535>,
<https://forum.obsidian.md/t/e2e-testing-of-plugins-with-webdriverio/107493>.
