---
session_ids: [{"a": "claude", "type": "execution", "id": "cb55d8bf-80e0-4fd5-bda7-54abd0447b85"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_tbqtxmq5gyjr9ehrpk87bcje6_e
title: "obsidianmd: drop plugin id/name from command ids/names in src/main.ts"
status: in_progress
deps: []
links: [nid_qjuqgqfwentq2l59o5ya17vra_e, nid_6q26wh2r8ivgbeedpf17t31ry_e, nid_uyj3is3eyv9o3ctkv2meqcin7_e, nid_h2hs9s7uvugweohv076dvddpm_e, nid_l17hhil9b22jas1lwvyfgxp5w_e, nid_zs2aog8b2i9e3wutsorjm88ft_e, nid_icr9gp534nm6kgkbc8rgcpu68_e, nid_nioldkusdrwc7fqzr4bmq2bow_e]
created_iso: 2026-08-11T21:26:40Z
status_updated_iso: 2026-08-11T22:43:36Z
type: chore
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [lint, release]
---

`eslint-plugin-obsidianmd` flags 6 findings in `src/main.ts` (verify: `npx eslint src/main.ts`):

- `commands/no-plugin-id-in-command-id` at src/main.ts:170,175,180 — command `id`s embed `vicinity-graph` / `open-vicinity-graph...`. Obsidian already namespaces command ids with the plugin id, so the prefix is redundant. Use short ids like `open-right-sidebar`, `open-below`, `debug-log`.
- `commands/no-plugin-name-in-command-name` at src/main.ts:171,176,181 — command `name`s repeat "vicinity graph"; the command palette already groups by plugin. Drop the plugin name from the visible label.

CAUTION: command ids are part of a stored hotkey contract. Plugin is not published yet (see CLAUDE.md "clean breaks on stored data"), so renaming ids is fine now — do it BEFORE release. Note the rename in the PR/release note.

Do NOT touch e2e (submodule, not score-carded). Verify with `npx eslint src/main.ts`.

