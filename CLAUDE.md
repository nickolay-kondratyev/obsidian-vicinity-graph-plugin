# CLAUDE.md — Vicinity Graph

An Obsidian plugin (`id: vicinity-graph`) that renders the vicinity of the
active note as a rich, folder-grouped React Flow graph — a richer replacement
for the native local graph. TypeScript + esbuild + React 18. Source-available
under KSAL-2.3 (`LICENSE.md`), **not** OSI open-source.

## Orient here first

- **[`docs-internal/architecture-map.md`](./docs-internal/architecture-map.md)** — directory → responsibility map + layering rules. **Read before changing structure.**
- **[`docs-internal/plan/high-level-plan.md`](./docs-internal/plan/high-level-plan.md)** — design source of truth (traversal, sizing, truncation, pinning, persistence, canvas). Read before changing behavior.
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
npm run test:e2e         # Playwright against a REAL Obsidian (release gate, not npm test)
                         # VICINITY_E2E_VAULT drives an arbitrary vault — see README safety caveat
```

Redirect verbose build/test output to `.tmp/` to conserve context.

## Conventions (repo-specific)

- **Tests are BDD** (`WHEN … THEN …`), one behavior per test, colocated `*.test.ts`. Pure engine/persistence logic is fixture-tested via `Fake*` providers — keep correctness in the tested core, adapters thin. Prefer starting from a failing test.
- **Strict TS**: `noUncheckedIndexedAccess`, `noImplicitReturns` on. Prefer branded types (`asVaultPath`, `asDocId`, `asFolderPath`) over raw strings.
- **Settings writes**: ONE pipeline (`src/view/settingsWritePipeline.ts`, one instance in `main.ts`, shared by the settings tab and the in-graph panel). A control emits a `SettingsInteraction` naming ONE field; the pipeline serialises it on `src/shared/SerialPromiseChain.ts`, merges it over globals read FRESH inside that slot, persists, then fans out via `ViewsRefreshPort`. Never merge from a rendered snapshot, never add a second chain or a second fan-out.
- **Settings rows**: ONE declared model (`src/view/settingsRows.ts`, `SETTINGS_GROUPS`). The settings tab and the in-graph panel are two PRESENTERS over it, each an exhaustive `switch` on `row.control.kind` — so declare the row, then let both compile errors tell you where to render it. Never hand-type a label, a heading, an order or an accessible name in a presenter; `disabledWhen` is data, not a branch (dependent rows render always, disabled).
- **Persistence**: `data.json` is the only store — global settings + the docid-keyed pinned set (so renames are non-events). **Nothing is per-document**; every setting is global. Every persisted shape carries a `version` field.
- **Not published yet ⇒ clean breaks on stored data.** No migrations, no dual-key read shims, no back-compat branches: rename/remove persisted keys outright and let old data fall back to spec defaults. There are no users to protect, so the cost is a re-set setting, not lost work. Say so in the PR/release note; never break stored data *silently*. **Revisit this line the moment the plugin ships** — after that, migrations are back on the table.
- **Styling** pulls from Obsidian theme CSS variables (light/dark just work); prefer CSS over JS. `styles.css` is generated from `src/view/*.css` at build.
- `main.js` and `styles.css` are **build artifacts** — never hand-edit.
- `minAppVersion` `1.12.4` is a floor, never a ceiling (canvas core indexing). `obsidian-id-lib` is bundled; only `obsidian` is external.

## Guardrails

- Preserve `ap_XXX_E` anchor identifiers; don't remove anchor points or behavior-capturing tests without explicit alignment.
- Spot issues outside your task → file a `docs-internal/tickets/` ticket, don't silently patch.
- Temp files → `$PWD/.tmp/`. Test screenshots → `.out/` (never source-controlled).
- `obsidian` typings are pinned to the floor (`1.12.3`, nearest published npm version ≤ `minAppVersion` 1.12.4), never `latest` — a newer tag's `@deprecated` may describe an API still live on the floor, so verify against the pinned e2e build (1.12.7) before deleting a call.
