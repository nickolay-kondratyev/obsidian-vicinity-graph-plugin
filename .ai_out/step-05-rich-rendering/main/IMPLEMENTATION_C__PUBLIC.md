# IMPLEMENTATION_C__PUBLIC — step-05 Phase C (Playwright e2e harness)

Status: **DONE — e2e suite RAN HERE against a real Obsidian 1.12.7 (headless): 18/18 passed.**
No `#QUESTION_FOR_HUMAN` items. No production code was modified.

## Gate results (exact)
- `npm run test:e2e` (real Obsidian, headless ozone): **18 passed / 0 failed**, re-run several times (idempotent). Exit 0.
- Missing `OBSIDIAN_PATH` → suite **fails fast** (exit 1) with an actionable message (verified).
- `npm test`: 451 passed / 43 files (+ sublib 69/6) — unchanged, exit 0.
- `npm run check`: exit 0 (root check stays src-only; e2e has its own `tsc -p e2e/tsconfig.json`, wired into `test:e2e`, exit 0).
- `npm run build`: exit 0.

## How to run locally
```bash
# one-time: get an Obsidian binary
./Obsidian-x.y.z.AppImage --appimage-extract          # Linux
export OBSIDIAN_PATH=$PWD/squashfs-root/obsidian
# macOS: export OBSIDIAN_PATH='/Applications/Obsidian.app/Contents/MacOS/Obsidian'

npm run test:e2e                                       # with a display
OBSIDIAN_E2E_EXTRA_ARGS="--ozone-platform=headless --disable-gpu" npm run test:e2e   # display-less CI
```
`test:e2e` = `setup:dev-vault` (idempotent fixtures + build) → e2e typecheck → Playwright.
Docs added to README.md ("e2e suite" section + scripts table row).

## What shipped
- **`e2e/obsidianHarness.ts`** — launches a real Obsidian on a throwaway COPY of `.dev-vault` (`.tmp/e2e/vault`), fully sandboxed (`--user-data-dir=.tmp/e2e/obsidian-config` with pre-written `obsidian.json` registering the vault `open:true`, `updateDisabled:true`; `--no-sandbox` on Linux). Enables community plugins at runtime (`app.plugins.setEnable(true)` + `enablePlugin`), waits on real state (`layoutReady`, plugin loaded, view mounted) — zero bare sleeps in assertions. Adds e2e-only `crowd/c1..c4.md` fixtures (c1/c2 large → deterministic truncation winners by the engine's size-score priority).
- **`e2e/neighborhoodGraph.e2e.ts`** — 18 serial DOM-state tests on ONE Obsidian instance, using the Phase B selector contract; badge copy is IMPORTED from `src/view/badgeText.ts` / `attachmentIcons.ts` (never re-typed).
- **`e2e/playwright.config.ts`**, **`e2e/tsconfig.json`**; `@playwright/test` devDep; `npm run test:e2e` (NOT part of `npm test` — unit gate stays hermetic).

## Coverage vs spec exit criteria (all asserted on real rendered DOM)
| Area | Assertion |
|---|---|
| View mounts | flow/empty state attached after the open command |
| Node counts | alpha graph = 3 notes; note1 graph = 11 notes; cap-2 graph = 3 notes |
| Tiers | exactly one `data-tier="main"`; zero `pinned-central`; rest `regular` |
| Titles | frontmatter title (alpha), trimmed frontmatter title (gamma), breadcrumb `solo/` on singleton, NO breadcrumb on root note |
| Folder groups | `projects` + `crowd` containers with labels; no badge when nothing hidden |
| Truncation | runtime nodeCap=2 → crowd group badge `+2`; corner overlay `+6 hidden` with per-folder `title` breakdown incl. `(vault root)`; overlay ABSENT untruncated |
| Edges | 3 edge paths each with `marker-end` arrowhead; `×2` badge (with `data-count`) ONLY on the duplicate-link edge |
| Thumbnails | `img[src^="app://"]` on note1; no `+N` badge for a single image |
| Icon strip | 3 chips (png/pdf/csv) with counts and exact `aria-label` from `attachmentGroupLabel` |
| Theme | body-class dark↔light toggle: arrowhead computed stroke == computed `--text-faint` in BOTH themes and never RF's hard-coded `#b1b1b7` |
| Interactions | click → note opens in current tab; ctrl/cmd-click → markdown leaf count +1 (new tab) |

## Key decisions (WHY / WHY-NOT)
1. **Plain Playwright over `wdio-obsidian-service`/`obsidian-launcher`** (KISS): one launch scenario; no second test framework. Sandbox mechanics were verified against obsidian-launcher's source and reimplemented in ~40 lines.
2. **`chromium.connectOverCDP`, NOT `_electron.launch`**: Obsidian's packaged Electron ignores `--inspect=0` (Electron fuses), so Playwright's electron launcher hangs until timeout — reproduced here. Browser-level CDP (spawn with `--remote-debugging-port=0`, parse the stderr endpoint) works; all automation is renderer-level.
3. **Runtime plugin enablement** instead of seeding Chromium's localStorage leveldb (what obsidian-launcher does): avoids a leveldb-writer dependency.
4. **Vault copy per run**: idempotent, mutations (nodeCap, data.json) never leak into the human's `.dev-vault`, e2e fixtures never pollute manual QA.
5. **nodeCap via `plugin.pluginDataStore.saveGlobalView`** + active-file bounce (alpha→note1) to trigger the rebuild — no data.json fixture, no settings UI dependency (step 06).
6. **Harness layout normalization**: other right-sidebar tabs are detached and the sidebar widened (`rightSplit.setSize(500)`), and pointer tests remount the view first — React Flow `fitView` runs on mount only, and stale viewports put nodes outside the clickable pane (both issues observed as real Playwright "intercepts pointer events" failures, not guesses).

## Consciously NOT asserted (no silent caps)
- Hover → Obsidian page-preview popover (needs the Page preview core plugin's popover timing; covered by manual QA §5).
- Native attachment `Menu` contents / menu-entry opening (OS-level menu DOM; manual QA §2).
- Group-drag moving members, chip-drag inertness (manual QA §2/§3).
- Container-query density thresholds (visibility at 72/104px) — DOM presence is asserted; visual density is manual QA §1.
- Empty state + reuse-layout position stability (step-04 regressions; manual QA §8).
- "+N" extra-thumbnail badge POSITIVE case (needs a 2-image fixture note; negative case asserted; unit-covered in `badgeText.test.ts`).

## Iteration 1 — review-feedback pass (verdict was READY; 2 MINOR + 3 NIT)

| Finding | Disposition | Detail |
|---|---|---|
| MINOR-1 `close()` orphan risk | **FIXED** | `browser.close()` wrapped in try/finally so `obsidianProcess.kill()` always runs even if the CDP disconnect rejects (`e2e/obsidianHarness.ts`). |
| MINOR-2 serial test-order coupling | **REJECTED** | Conscious, documented design (one Obsidian instance, `mode: "serial"`, fresh vault per run) that the reviewer explicitly accepted for KISS. File-header comment documents it; NIT-3 fix adds a further append-warning. Restructuring for independence would multiply launches for zero found-bug value. |
| NIT-1 `OBSIDIAN_E2E_EXTRA_ARGS` no quoting | **FIXED** | Doc-comment added: "Space-separated flags only — quoting is NOT supported". |
| NIT-2 duplicated `VIEW_TYPE_NEIGHBORHOOD_GRAPH` | **TICKETED** | Prod code is off-limits in Phase C, so the dedup (obsidian-free `src/view/constants.ts`) is recorded as `docs-internal/tickets/ticket-e2e-view-type-constant-dedup.md`. |
| NIT-3 cap-mutating test leaves non-default state | **FIXED** | "KEEP LAST (or reset the cap)" comment added directly above the truncation test. |

### Iteration 1 gate results (run for real)
- `npm run test:e2e` (real Obsidian 1.12.7, headless ozone): **18 passed / 0 failed**, exit 0.
- `npm test`: 451 passed / 43 files (+ sublib 69 / 6), exit 0.
- `npm run check`: exit 0.

## Environment notes for CI
Verified in this (display-less, container) environment: AppImage `--appimage-extract` (no FUSE), then headless via `OBSIDIAN_E2E_EXTRA_ARGS="--ozone-platform=headless --disable-gpu"` — no xvfb required. AppImage must be extracted on a non-noexec filesystem.
