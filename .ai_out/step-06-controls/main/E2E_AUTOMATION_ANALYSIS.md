# Step-06 Controls — what can move from the human smoke run to re-runnable e2e

**Question (ask.dnc):** the ticket says real Obsidian can't be *human-driven* cheaply — but we already drive real Obsidian in Playwright (`e2e/obsidianHarness.ts`). So which of the 16 `QA_CHECKLIST.md` items can become re-runnable e2e tests, and what genuinely still needs human eyes?

**Answer:** ~12 of 16 items are functional state-transitions (interact → assert rendered DOM / stored data) and are automatable in the existing harness. The one thing the ticket calls "structurally uncoverable" — **settings round-trip through an Obsidian restart** — is *also* automatable: relaunch Obsidian against the **same** (not fresh) vault copy; all state lives in `.obsidian/plugins/<id>/data.json` inside that copy, so it reloads. Only 4 residual items are true visual/native-feel judgment, exactly mirroring the step-05 human/automation split.

## Precedent

Step-05 already established the split (`ticket-step-05-human-smoke-run.md`): 18 Playwright tests cover functional rendering; humans judged only visual polish + native-feel + a light/dark glance. Step-06 is *more* automatable than step-05 because its checklist is dominated by state-transitions (depth changes, pin/unpin, cap changes) rather than aesthetics.

## The one enabler to build: restart relaunch

`ObsidianHarness.launch()` calls `prepareVaultCopy()`, which **wipes** `VAULT_COPY_DIR` and deletes `data.json` every launch. To assert a restart round-trip we need a second entry point that **preserves** the existing copy:

- `ObsidianHarness.relaunch()` — `browser.close()` + `obsidianProcess.kill()`, then spawn again **skipping `prepareVaultCopy`** (keep the sandbox config dir too), re-attach CDP, re-enable plugins. Everything else is unchanged.
- Pattern per test: interact → `relaunch()` → re-open the graph → assert the value is identical. This turns the ticket's hard exit criterion into a green/red signal instead of a human step.

This single ~30-line addition unlocks the "restart persists" clause of items **1, 6, 11, 13** — the highest-value automation, because it is precisely what unit tests cannot reach.

## Coverage map (all 16 QA items)

Selectors already exist in the components (`data-tier`, `data-pinned`, `data-kind`, `aria-label`s on steppers/reset/pin, `.neighborhood-graph-toolbar` `<details>`, `.neighborhood-graph-disclosure`). Store reads use the same `app.plugins.plugins[id].pluginDataStore` hook the harness already uses in `setGlobalNodeCap`.

| # | QA item | Verdict | e2e approach |
|---|---------|---------|--------------|
| 1 | MAIN outbound stepper +/− re-expands; **restart persists** | ✅ auto (+relaunch) | click `[aria-label="Increase outgoing depth"]`; assert node count / `.__value` text; relaunch → assert value |
| 2 | Incoming independent of outbound | ✅ auto | bump incoming; assert outgoing `.__value` unchanged |
| 3 | Reset (↺) pinned MAIN depth → inherited; reset button disappears | ✅ auto | click reset; assert stepper `data-pinned="false"` and reset button `hidden` |
| 4 | Inherited-vs-pinned styling legible **at a glance** | 👁 human | *state* asserted in #3 (`data-pinned`); the visual glance is judgment |
| 5 | Steppers clamp 0..5, no free-text | ✅ auto | drive to 0 → − `disabled`; to 5 → + `disabled`; there is no text input to assert |
| 6 | Pin regular node via hover button → pinned-central; in disclosure; **restart persists** | ✅ auto (+relaunch) | click `.neighborhood-graph-pin-button`; assert `data-tier="pinned-central"` + disclosure summary `Pinned centrals (1)`; relaunch → still pinned. *Dashed-accent look = human* |
| 7 | Pin via **right-click menu**; MAIN offers neither | ✅ auto | `contextmenu` → click native `.menu-item`; assert MAIN node has no `.neighborhood-graph-pin-button` and contextmenu yields no menu item |
| 8 | Unpin via hover button AND context menu | ✅ auto | mirror of #6/#7 back to `data-tier="regular"` |
| 9 | Pin a doc that can't get a docid → Notice; nothing persisted | ✅ auto (needs fixture) | add an unpersistable fixture note; assert `.notice` appears + store pinned-set unchanged |
| 10 | **Headline scenario:** pin X@3 under MAIN Y; switch Z→Y identical; open X as MAIN → own depth untouched | ✅ auto | full flow through the UI; assert node counts + stepper values + store DocData reads. Highest-value functional test |
| 11 | Toolbar sizing (toggle/weight/min-max) resizes nodes globally; **restart persists** | ✅ auto (+relaunch) | change `.neighborhood-graph-sizing__weight`; assert node square px / size attr changes; relaunch persists |
| 12 | Settings-tab sizing mirrors toolbar; cross-refresh | ✅ auto | `app.setting.open()` + open plugin tab; change field; assert open view + toolbar reflect it |
| 13 | Node cap change truncates open view **without reopen**; **restart persists** | ✅ auto (+relaunch) | drive settings-tab cap input (or store); assert node count drops with no re-open; relaunch persists |
| 14 | Global depth defaults change; inherited docs use them; view refreshes | ✅ auto | change default; assert an inherited central's rendered depth changes |
| 15 | Toolbar collapse/expand; disclosures open/close | ✅ auto | click `<summary>`; assert `[open]` on the `<details>` |
| 16 | ~300px sidebar: no horizontal overflow; scrolls vertically | ◐ partial | set sidebar 300px; assert `scrollWidth <= clientWidth` (overflow) + `scrollHeight > clientHeight` scrollable — both re-runnable. "Does it *look* cramped" = human |

**Legend:** ✅ auto = fully automatable now · (+relaunch) = needs the restart enabler above · ◐ partial = a real re-runnable assertion plus a residual visual glance · 👁 human = judgment only.

## Residual human-only items (keep in the smoke ticket)

Exactly the step-05-style visual/native-feel residue — cannot and should not be automated:
- **#4** inherited-vs-pinned styling *reads* clearly at a glance (the `data-pinned` state is asserted).
- **#6** pinned-central dashed-accent *looks* right.
- **#7** context menu / pin *feels* native (the click path is asserted).
- **#16** toolbar isn't visually cramped at 300px (the overflow *metric* is asserted).

## Recommendation (Pareto)

Two slices, in value order:

1. **Restart enabler + restart round-trips (1, 6, 11, 13) + the headline scenario (10).** ~30-line `relaunch()` + ~5 tests. This is the ticket's stated hard exit criterion and the single thing unit tests can't reach — best ROI by far. Converts the ticket from "awaiting human" to "awaiting a green e2e run + a short visual glance."
2. **Remaining functional items (2, 3, 5, 7, 8, 12, 14, 15, 16-overflow).** Broadens the safety net; lower marginal value since the pure logic is already unit-tested — these guard the *glue*.

Item **9** (undocid'able-doc Notice) needs a dedicated fixture; fold into slice 2 or defer.

After both slices the human smoke run shrinks to a ~5-minute visual glance (#4/#6/#7/#16 look-and-feel + a light/dark pass), matching how step-05 closed out.

---

## Delivered — slice 1 (green in the dev env, re-run headless)

Two new Playwright specs, both passing against real Obsidian 1.12.7:

- **`e2e/pinnedCentralScenario.e2e.ts`** — the headline #10 Q-A scenario end-to-end: pin a central → raise its depth (hops appear) → switch MAIN away/back (restores) → open the pin as its own MAIN (its own depth is the untouched default).
- **`e2e/controlsRestart.e2e.ts`** — depth (#1), pin (#6), sizing (#11) and node cap (#13) all survive one real `relaunch()` — the step's hard exit criterion, now a test.

### Harness enablers added (`e2e/obsidianHarness.ts`)
- `relaunch()` + `spawnAndConnect()` refactor — restart against the SAME vault copy (no re-seed), reloading `data.json`.
- `launch({ extraFixtures })` — per-suite fixture graphs (isolated from the other spec's counts).
- `readGlobalView()` — reads persisted globals (cap/sizing) for restart assertions.

### Four things learned (each shaped the tests)
1. **Sparse, root-level fixtures** — dense graphs + subfolder group boxes intercept pointer events; a 2–5 node root graph makes the pin gesture deterministic.
2. **Per-doc settings need an id-stamped note** — steppers are DISABLED until the MAIN note has a docid (`getDocId` is read-only; nothing stamps on focus). Fixtures seed a frontmatter `id:` — a fresh note legitimately shows disabled steppers.
3. **Panel controls are driven via their real onClick/onChange** — the controls Panel is a React-Flow overlay with an internal-scroll body; its lower controls sit off-viewport headlessly. Node pin stays a REAL pointer click (native feel under test); the steppers/sizing fire their own handler (same write→rebuild chain). Pixel-clickability of a tall panel is QA §16 (human).
4. **Pinned-central identity lags ~15s after restart** — `PathDocIdMap` is memory-only; a pin resolves only after the delayed orphan sweep warms it. The restart test polls-with-remounts across that window; filed as [[ticket-pinned-central-status-lags-after-restart]].

### Running them
`npm run test:e2e` (needs `OBSIDIAN_PATH`; headless via `OBSIDIAN_E2E_EXTRA_ARGS="--ozone-platform=headless --disable-gpu"`).
