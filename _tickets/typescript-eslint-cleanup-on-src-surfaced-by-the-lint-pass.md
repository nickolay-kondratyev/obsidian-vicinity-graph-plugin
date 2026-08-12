---
closed_iso: 2026-08-12T00:14:58Z
session_ids: [{"a": "claude", "type": "execution", "id": "e50393d9-e8b2-45a0-a324-795c4f183d88"}, {"a": "claude", "type": "review", "id": "208a36bf-4f3f-473d-a322-ac6d4f4fca37"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_icr9gp534nm6kgkbc8rgcpu68_e
title: "typescript-eslint cleanup on src/ (surfaced by the lint pass)"
status: closed
deps: []
links: [nid_qjuqgqfwentq2l59o5ya17vra_e, nid_tbqtxmq5gyjr9ehrpk87bcje6_e, nid_6q26wh2r8ivgbeedpf17t31ry_e, nid_uyj3is3eyv9o3ctkv2meqcin7_e, nid_h2hs9s7uvugweohv076dvddpm_e, nid_l17hhil9b22jas1lwvyfgxp5w_e, nid_zs2aog8b2i9e3wutsorjm88ft_e, nid_nioldkusdrwc7fqzr4bmq2bow_e]
created_iso: 2026-08-11T21:27:04Z
status_updated_iso: 2026-08-12T00:14:58Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [lint]
---

The obsidianmd recommended config layers in `typescript-eslint` type-checked rules; the same `npx eslint src` pass reports ~29 non-obsidian prod findings, several auto-fixable:
- `no-redundant-type-constituents` (10) + `no-duplicate-type-constituents` (6) — concentrated in src/view/settingsSectionFields.ts (~86-88): union types with redundant/duplicate constituents; simplify the type.
- `no-unnecessary-type-assertion` (4), `no-unused-vars` (4), `unbound-method` (4), `no-misused-promises` (1).

Not Obsidian-score-card-specific, but surfaced by the plugin and worth cleaning. Try `npx eslint src --fix` for the mechanical ones, review each `unbound-method`/`no-misused-promises` by hand (real footguns). Verify: `npx eslint src`. Do NOT touch e2e (submodule).

## Resolution (2026-08-11)

The named counts (redundant 10 / duplicate 6 / unnecessary-assertion 4 / unused-vars 4 / unbound-method 4 / misused-promises 1 = 29) match **exactly** the non-test (prod) occurrences once `*.test.ts(x)` findings are excluded, so scope was the prod surface. All 29 are now clear on `npx eslint src`; the only surviving `typescript-eslint` findings are in `*.component.test.tsx` (2 `no-unnecessary-type-assertion`) plus unrelated obsidianmd/no-unsafe/no-deprecated rules — none named by this ticket. Fixed by hand (not `--fix`) to keep the diff prod-only.

Changes:
- **`no-redundant`/`no-duplicate-type-constituents`** — `src/engine/SettingsSpec.ts` and `src/view/settingsSectionFields.ts`: the compile-time completeness guards used one `Exclude<…> | Exclude<…> | Exclude<…>` union per direction; in the healthy state every constituent is `never`, so the union was a pile of duplicated `never`s. Split each into three per-family assertion consts (inlining the `Exclude` so the error still NAMES the offending key — the documented WHY-NOT against a generic helper). `_assertEverySettingsFieldSpecced`/`_assertNoOrphanSpecField`/`_assertEverySettingsFieldSectioned` are gone; replaced by `_assertEvery{View,Depth,Exclusion}FieldSpecced`, `_assertNoOrphan{View,Depth,Exclusion}SpecField`, `_assertEvery{View,Depth,Exclusion}FieldSectioned`. All were assertion-only (no external refs).
- **`no-redundant-type-constituents`** — `src/persistence/VaultFileStore.ts:75`: `Promise<unknown | null>` → `Promise<unknown>` (`unknown` subsumes `null`; the doc comment about the `null` return still holds).
- **`no-unnecessary-type-assertion` (4 prod)** — `FakeObsidianPorts.ts` (`structuredClone(...) as Record<…>`), `VaultFileStore.ts:258` (`Object.keys(value as Record<…>)` — the `object` narrowing already satisfies `Object.keys`; the sibling index-access assertion on the next line stays, it is still needed), `LinkPreviewDrawer.tsx:165` (`style as CSSProperties`), `optimisticValue.ts:113` (`last as RequestedEdit<T>`). All removed.
- **`unbound-method` (4 prod)** — `ChunkedWork.sleepZero` annotated `this: void` (touches no instance state, passed unbound as the default `yieldBetweenBatches`); this cleared BOTH `ChunkedWork.ts:18` and `DocIdMapWarmer.ts:71`. `settlesAt` on `SettingsNumberAccessor` changed from a method signature to a property function type (`readonly settlesAt: (value: number) => number`) — every impl is a free/arrow function closing over its clamp, none reads `this`; this cleared `DepthStepper.tsx:45` and `SettingsRowView.tsx:121` (and, as a bonus, the same-shaped warnings in the accessor test files).
- **`no-unused-vars` (4)** — `VicinityGraphSettingTab.ts`: dropped unused imports `TextComponent`, `DepthSettings`, `ForceLayoutSettings`, `SettingsInteraction` (the last only survived in a `{@link}` comment, which still renders).
- **`no-misused-promises` (1)** — `VicinityGraphSettingTab.ts` dependent-control push: `setDisabled: (disabled) => text.setDisabled(disabled)` returned the component fluently into a `void` slot; wrapped in a block body to discard the return.

Verified: `npx eslint src` (prod findings gone) · `npm run check` · `npm test` (1871 pass) · `npm run test:e2e -- settingsDependentRows.e2e.ts` (2 pass — the real-Obsidian check on the touched `setDisabled` dependent-row path, which `npm test` cannot reach). No behavior change: every edit is type-level or dead-import removal. No e2e submodule changes.


## Notes

**2026-08-12T00:17:00Z**

__READY_AS_IS__: prod lint scope clean (all 29 named findings gone), check + 1871 tests pass; changes are type-level/dead-import only, no behavior change; remaining lint hits are in test files, explicitly out of ticket scope.
