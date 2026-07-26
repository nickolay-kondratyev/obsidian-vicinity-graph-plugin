# EXPLORATION — e2e harness, fixture, and run mechanics

> Produced by a read-only Explore agent (could not Write); transcribed by TOP_LEVEL_AGENT.
> Companion: [EXPLORATION_BREADCRUMB__PUBLIC.md](./EXPLORATION_BREADCRUMB__PUBLIC.md) — independently
> reached the same root cause.

## Root cause (independently confirmed)

`.vicinity-graph-node__breadcrumb` exists nowhere in `src/`. Grep across the repo hits only
`e2e/vicinityGraph.e2e.ts:85,86,144,160,161` and an unrelated comment at
`src/adapters/ObsidianLinkProvider.ts:313`. `src/view/NoteNode.tsx:92-93` renders the title
only. The locator matches 0 elements and times out at the 15s `expect.timeout`.

The sibling test at `:85` passes **vacuously** — `toHaveCount(0)` on a class that exists
nowhere cannot distinguish "correctly absent for root notes" from "feature absent".

DOM shape implied by `:162-164`: because Playwright `toHaveText` concatenates subtree text,
the breadcrumb span must be **inside** `.vicinity-graph-node__title`, before the title text.

## 1. The tests

```
85: test("root-folder note carries no breadcrumb", async () => {
86: 	await expect(noteNode(NOTE1_PATH).locator(".vicinity-graph-node__breadcrumb")).toHaveCount(0);
87: });
```
```
160: test("singleton-folder note shows a folder breadcrumb and its trimmed frontmatter title", async () => {
161: 	await expect(noteNode(GAMMA_PATH).locator(".vicinity-graph-node__breadcrumb")).toHaveText("solo/");
162: 	await expect(noteNode(GAMMA_PATH).locator(".vicinity-graph-node__title")).toHaveText(
163: 		`solo/${GAMMA_TRIMMED_TITLE}`,
164: 	);
165: });
```
Constants (`:33-34`): `GAMMA_PATH = "solo/gamma.md"`, `GAMMA_TRIMMED_TITLE = "Gamma (solo, trimmed title)"`.
Helper `noteNode()` (`:61-63`): `page.locator('.vicinity-graph-node[data-path="${path}"]')`.
Note `:144` also mentions breadcrumb — IMPLEMENTATION should read the full block.

## 2. Fixture `solo/gamma.md`

`scripts/setup-dev-vault.sh:109-117` (idempotent `write_if_missing`):
```
---
title: "  Gamma (solo, trimmed title)  "
---
Singleton folder note: solo/ has one note → breadcrumb title, no group box.
Links to [[note1]].

Second recognizable image, ...: ![[pic2.jpg]].
```
**The fixture comment itself states the intended design** ("→ breadcrumb title, no group box"),
corroborated by `scripts/setup-dev-vault.sh:84-90`. `solo/` has exactly one note. Gamma links
out to `note1`; the test opens `note1.md` as active (`:146-150`) and gamma enters note1's
vicinity as a 1-hop neighbour. `NOTE1_NODE_COUNT = 11`.

Frontmatter title is deliberately padded with spaces → the test also asserts **trimming**.

## 3. Run mechanics / vault state

- `npm run test:e2e` → `scripts/run-e2e.sh`: auto-provisions `OBSIDIAN_PATH` via
  `setup-obsidian-bin.sh` (pinned Obsidian 1.12.7); adds `--ozone-platform=headless --disable-gpu`
  when no `DISPLAY`/`WAYLAND_DISPLAY`; runs `npm run setup:dev-vault` (skipped when
  `VICINITY_E2E_VAULT` set); then `npx playwright test --config e2e/playwright.config.ts`.
- `e2e/playwright.config.ts`: `testMatch **/*.e2e.ts`, `workers: 1`, `fullyParallel: false`,
  `retries: 0`, test timeout 120s, **`expect.timeout: 15_000`** (`:15`).
- `prepareVaultCopy` (`e2e/obsidianHarness.ts:388-417`): **fresh vault every run** — wipes
  `.tmp/e2e/vault`, copies `.dev-vault`, deletes stale plugin `data.json`, layers e2e-only
  `crowd/c1..c4` (`:101-107`) plus per-spec `extraFixtures`. Throws if `.dev-vault` or its built
  `main.js` is missing. ⇒ **No stale setting can explain the failure.**
- `vicinityGraph.e2e.ts` mutates `nodeCap` only in its last test (`:233-241`, documented as
  not restoring).

## 4. Helpers

- `e2e/obsidianHarness.ts` — `ObsidianHarness`: `launch/relaunch/close`, `openFile`,
  `openGraphView`, `remountGraphView`, `setGlobalNodeCap`, `setMaxNodeSizePx`,
  `setNodePreviewPreference`, `readGlobalView`, `setTheme`. Connects over CDP
  (`chromium.connectOverCDP`), not `_electron.launch` (WHY documented at `:26-30`).
- `e2e/vaultTarget.ts` — `resolveVaultTarget`, `assertExternalLaunchAllowed`,
  `assertExternalVaultReady`, `vaultDirOf`; env `VICINITY_E2E_VAULT` / `VICINITY_E2E_NOTE`.
- Spec-local `noteNode(path)` (`:61-63`), `folderGroup(folder)` (`:65-67`). No settle helper —
  relies on Playwright polling. Badge/label copy is imported from `src/view/badgeText.ts` and
  `src/view/attachmentIcons.ts` rather than retyped; **no equivalent shared source exists for
  breadcrumb text**, confirming it is unbuilt.

## 5. Why 6 tests never run

`vicinityGraph.e2e.ts:18` — `test.describe.configure({ mode: "serial" })` with one shared
Obsidian instance (`beforeAll`/`afterAll` `:49-59`). In serial mode a failure skips all
remaining tests in that file: lines 167, 175 (×2, dark/light loop), 209, 218, 233 = **exactly 6**.
Other 9 spec files are unaffected.

Spec files: `controlsRestart`, `edgeRouting`, `edgeRoutingEval`, `externalVault`, `nodeOutline`,
`pinnedCentralScenario`, `settingsResetReview`, `settingsResetVerify`, `settingsUxVisual`,
`vicinityGraph`.

## 6. Running locally

- Single file: `npm run test:e2e -- vicinityGraph.e2e.ts`; scope further with
  `-g "singleton-folder"` (caveat: serial/shared state means a lone test may not reach the same
  graph state as a full-file run).
- Env: `OBSIDIAN_PATH`, `OBSIDIAN_E2E_EXTRA_ARGS`, `VICINITY_E2E_VAULT`, `VICINITY_E2E_NOTE`.
- **This environment is ready**: `.dev-vault/` exists with `solo/gamma.md` and a built plugin;
  Obsidian 1.12.7 already extracted at `.tmp/obsidian/obsidian-1.12.7/obsidian`. Suite was not
  run by the explorer.
