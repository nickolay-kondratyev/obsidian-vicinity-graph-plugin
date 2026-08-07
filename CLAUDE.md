# CLAUDE.md — Vicinity Graph

An Obsidian plugin (`id: vicinity-graph`) that renders the vicinity of the
active note as a rich, folder-grouped React Flow graph — a richer replacement
for the native local graph. TypeScript + esbuild + React 18. Source-available
under KSAL-2.3 (`LICENSE.md`), **not** OSI open-source.

## Orient here first

- **[`docs-internal/architecture-map.md`](./docs-internal/architecture-map.md)** — directory → responsibility map + layering rules. **Read before changing structure.**
- **[`docs-internal/plan/high-level-plan.md`](./docs-internal/plan/high-level-plan.md)** — design source of truth (traversal, sizing, truncation, pinning, persistence, canvas). Read before changing behavior.
- **[`docs-internal/vocab.md`](./docs-internal/vocab.md)** — shared glossary of load-bearing code terms (MAIN vs central vs pinned, channels, EdgeKind, override, docid, …). Use these exact terms in tickets/design docs.
- **[`README.md`](./README.md)** — user-facing settings model, pinning semantics, dev + e2e setup.
- `docs-internal/tickets/` — active follow-ups. `docs-internal/RELEASE_CHECKLIST.md`.

## Layering (enforced — do not violate)

`view → adapters → engine (pure)`; `persistence` implements engine-defined ports.

- **`src/engine/`** is pure: **no `obsidian` / `obsidian-id-lib` / `react` imports** (guarded by `src/engine/importGuard.test.ts`; same rule for `src/shared/`). Obsidian reaches it only via the `LinkProvider` seam. Import engine symbols from `src/engine/index.ts`, not deep paths.
- **`src/adapters/`** bridge Obsidian ↔ engine. **`src/persistence/`** = JSON storage. **`src/view/`** = React in an Obsidian `ItemView`; `GraphViewController.ts` is the only view class touching Obsidian + the async engine.
- Extend via new interface implementations (OCP), not by editing existing seams. Each port has a `Fake*` for tests.

## Commands

```bash
npm run dev              # esbuild watch; re-copies artifacts into .dev-vault/
npm run setup:dev-vault  # idempotent: build + create/copy plugin into .dev-vault/
npm test                 # vitest (src/**/*.test.{ts,tsx} + e2e/**/*.test.ts harness guards)
npm run check            # tsc -noEmit (strict) for src/, then check:e2e for e2e/
npm run build            # check + production bundle → main.js
npm run test:e2e         # Playwright against a REAL Obsidian (not part of npm test)
                         # Self-contained on Linux/CI: auto-downloads the pinned build,
                         # auto-headless. Run it as part of normal work — see below.
                         # VICINITY_E2E_VAULT drives an arbitrary vault — see README safety caveat
npm run test:all         # every gate, fail-fast: check → npm test → test:e2e
                         # (`-- --with-floor` also runs the floor e2e suite)
npm run test:e2e:floor   # same suite on the manifest minAppVersion floor build
                         # (OBSIDIAN_VERSION=<v> npm run test:e2e targets any other build)
```

Redirect verbose build/test output to `.tmp/` to conserve context.

**When to run `npm run test:e2e`.** It is a *development* gate, not only a release one — `scripts/run-e2e.sh` provisions its own Obsidian and display, so on Linux/CI there is nothing to set up. Run it (at minimum the specs covering the touched surface, e.g. `npm run test:e2e -- vicinityGraph.e2e.ts`) before calling ANY change to rendered graph/panel/settings behavior done, and always for: view-layer DOM or CSS changes, settings rows, and anything `npm test` can only reach through jsdom or a source scan — the settings TAB has no `npm test` coverage at all. Pure engine/persistence changes stay on `npm test`. On macOS/Windows it needs `OBSIDIAN_PATH`; if it genuinely cannot run, say so explicitly rather than reporting the change verified.

**The two-version e2e matrix is a RELEASE gate, not an every-change gate.** `npm run test:e2e`/`test:all` exercise only the pinned build on the hot path; the floor build is a second ~200MB download + full second run. `./release.sh` runs `check` → `npm test` → the SAME e2e suite on BOTH shipped builds (pinned + manifest floor), runs both arms even if the first fails, and prints a per-version pass/fail summary — run it before publishing a release upwards. A floor-only red is usually version-dependent Obsidian chrome (per the 1.13 slider-readout caveat), not a plugin regression; the summary names which build broke so that call is made with the version in hand. Guarded by `e2e/obsidianVersionKnob.test.ts`.

## Conventions (repo-specific)

- **Tests are BDD** (`WHEN … THEN …`), one behavior per test, colocated `*.test.ts`. Pure engine/persistence logic is fixture-tested via `Fake*` providers — keep correctness in the tested core, adapters thin. Prefer starting from a failing test.
- **Strict TS**: `noUncheckedIndexedAccess`, `noImplicitReturns` on. Prefer branded types (`asVaultPath`, `asDocId`, `asFolderPath`) over raw strings.
- **Settings writes**: ONE pipeline (`src/view/settingsWritePipeline.ts`, one instance in `main.ts`, shared by the settings tab and the in-graph panel). A control emits a `SettingsInteraction` naming ONE field; the pipeline serialises it on `src/shared/SerialPromiseChain.ts`, merges it over globals read FRESH inside that slot, persists, then fans out via `ViewsRefreshPort`. Never merge from a rendered snapshot, never add a second chain or a second fan-out. ONE failure policy, also there: a rejected persist is caught in the pipeline's ONE `guarded()`, reported ONCE through `UserNoticePort` (copy from `src/view/settingsWriteFailureNotice.ts`, naming the failed row's / reset scope's DECLARED label), and never re-thrown — call sites `void` their write promises, so a resolved write means "attempted and reported", not "stored". `runGuarded(subject, task)` lends that same `guarded()` — catch AND fan-out — to `data.json` writes the pipeline does not plan (the pinned set and the per-node size overrides, both from `ControlsActions`), so those never grow a policy of their own; the task returns a `GuardedWriteOutcome`, and only a body that wrote NOTHING **and** left the screen matching the store (a refused pin) skips the rebuild — a refused drag-resize reports `store-unchanged-screen-ahead` and still repaints, because the released box is already in React Flow's local node state. A REJECTED save never skips it: `PluginDataStore.persist()` moved memory before the disk write, so the screen — not the store — is the stale copy. No SECOND notice and no call-site try/catch for this policy: the three pre-existing catches (`useOptimisticValue`, the tab's `settlePendingWrites`, `SettingsResetSequence.tolerating`) guard their own INJECTED seams, log only, and say so.
- **Settings rows**: ONE declared model (`src/view/settingsRows.ts`, `SETTINGS_GROUPS`). The settings tab and the in-graph panel are two PRESENTERS over it, each a `switch` on `row.control.kind` closed by `unhandledRowControl` (the tab's arm returns `void`, so the `default` is what makes its exhaustiveness real) — so declare the row, then let both compile errors tell you where to render it. Never hand-type a label, a heading, an order or an accessible name in a presenter; `disabledWhen` is data, not a branch (dependent rows render always, disabled) and the type accepts it only on `DEPENDENCY_AWARE_CONTROL_KINDS` — the kinds whose presenters honour it.
- **Settings values**: ONE accessor per control kind (`src/view/settingsRowAccessors.ts`) owns the value half — `{read(state), bounds, settlesAt, interaction(value)}`, plus `accept` on typed rows. A presenter NEVER names an engine range table or a clamp (enforced by the `ACCESSOR_OWNED_SYMBOLS` scan over every row-rendering module); it is markup plus one accessor call. `interaction()` emits `settlesAt(value)`, so what is written and what a control shows optimistically are one number. Bounds and clamp come from the SAME spec leaf — a depth is stored verbatim, so its accessor's clamp is the only one it gets. `SettingsRowBounds` requires a `max` (every spec leaf is a full `BoundedNumberSpec` — the node cap's 1..1000 included), so a track control can never silently fall back to the range input's default 100.
- **Typed settings fields commit on COMMIT, never per keystroke** — a clamp that lands mid-word snaps the field under the caret. The tab debounces (`src/view/settingsDebounce.ts`); EVERY typed panel field is uncontrolled + blur-committed through the one `useNumberFieldCommit` hook in `src/view/SettingsRowView.tsx` (deciding via `src/view/numberRowCommit.ts`; a source scan over EVERY row-rendering module in `src/view/typedNumberFields.test.ts` fails a field wired any other way). Both refuse through the SAME seams — `SizingRowWrite` + `describeSizingRejection` — so a refusal's copy exists once, and both judge a cross-field rule against the STORE read fresh at commit time (the panel via `ControlsActionsPort.storedGlobalView()`), never against the rendered snapshot, which lags by a whole rebuild. Every commit the panel does NOT refuse reseeds its field from the store (`NumberRowCommit.reseedsFromStore`) — a write is no guarantee the row moves (the clamp can land back on the stored number), and an uncontrolled field is otherwise left holding text the plugin never stored. Cross-field rules (today only `maxPx >= minPx`) are ALSO enforced in `clampSizingSettings`, the one choke point the sizer, the load path and every write share; the UI refusal is the message, that clamp is the backstop.
- **Settings tests**: ONE tripwire. Suites walk `SETTINGS_SPEC` and assert STRUCTURE (every field parses, round-trips, resets to its declared default, honours its bounds), so a spec field that is never wired FAILS. Literal defaults and ranges live in exactly ONE file — `src/engine/settingsProductDefaults.test.ts`, id-keyed over every spec leaf — and editing it is the conscious act of changing shipped behavior. Never mirror a default into another suite. An e2e spec that TYPES into a settings field settles the write debounce through `e2e/settingsWriteWindow.ts` (`SettingsWriteWindow`) — never a sleep; copy that pattern. Tab-vs-panel parity is a source scan (`src/view/settingsRowParity.test.ts`) plus a RENDERED panel-side suite: `src/view/*.component.test.tsx` run under jsdom + `@testing-library/react` via a per-file `@vitest-environment jsdom` pragma (every other test stays node-env — the source-scan guards read the filesystem); the harness seam is `src/view/testFixtures/settingsPanelHarness.tsx`, and the settings TAB still cannot render under `npm test` (`obsidian` is types-only), so the scan covers it. A spec leaf with no declared row FAILS (`src/view/settingsRowSpecCoverage.test.ts`); that failure states the only sanctioned escape hatch (an allowlist entry with a written reason), so never weaken it instead.
- **Persistence**: `data.json` is the only store — global settings + two docid-keyed maps: the pinned set and per-node overrides (`nodeOverrides`; so renames are non-events). **Nothing is per-document**; every SETTING is global — an override is a global fact about a doc, like a pin. An override write names ONE field (`NodeOverrideChange`) and `PluginDataStore` merges it over the entry read FRESH there — a caller must never compose a whole entry from the rendered graph (same rule as settings). SETTING a field is a write intent (lazy `ensureDocId` + the pin eligibility/refusal seam in `PersistenceServices`); CLEARING one never mints an id (read-only `getDocId`: an id-less doc owns no override). Removing a doc's docid-keyed state is ONE call — `PluginDataStore.forgetDocs` spans every docid-keyed map, shared by the live `vault.on('delete')` handler and the orphan sweep, so a third map is wired in one place. Every persisted shape carries a `version` field.
- **Not published yet ⇒ clean breaks on stored data.** No migrations, no dual-key read shims, no back-compat branches: rename/remove persisted keys outright and let old data fall back to spec defaults. There are no users to protect, so the cost is a re-set setting, not lost work. Say so in the PR/release note; never break stored data *silently*. **Revisit this line the moment the plugin ships** — after that, migrations are back on the table.
- **Styling** pulls from Obsidian theme CSS variables (light/dark just work); prefer CSS over JS. `styles.css` is generated from `src/view/*.css` at build.
- `main.js` and `styles.css` are **build artifacts** — never hand-edit.
- `minAppVersion` `1.12.4` is a floor, never a ceiling (canvas core indexing). `obsidian-id-lib` is bundled; only `obsidian` is external.

## Guardrails

- Preserve `ap_XXX_E` anchor identifiers; don't remove anchor points or behavior-capturing tests without explicit alignment.
- Spot issues outside your task → file a `docs-internal/tickets/` ticket, don't silently patch.
- Temp files → `$PWD/.tmp/`. Test screenshots → `.out/` (never source-controlled).
- `obsidian` typings are pinned to the floor (`1.12.3`, nearest published npm version ≤ `minAppVersion` 1.12.4), never `latest` — a newer tag's `@deprecated` may describe an API still live on the floor, so verify against the pinned e2e build (1.12.7) before deleting a call.
