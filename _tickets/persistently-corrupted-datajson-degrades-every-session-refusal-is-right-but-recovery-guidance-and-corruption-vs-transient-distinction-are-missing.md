---
id: nid_08ripmsxon0r9ncn42lp623g1_e
title: "Persistently corrupted data.json degrades every session: refusal is right, but recovery guidance and corruption-vs-transient distinction are missing"
status: open
deps: []
links: []
created_iso: 2026-08-10T20:09:55Z
status_updated_iso: 2026-08-10T20:09:55Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [decide, persistence]
---

Follow-up from the review of ticket nid_ghaeps3siekw0oe17mr4xpmad_e (commits 06da6ce + eb6d428 on src/persistence/PluginDataStore.ts).

Obsidian's Vault.readJson returns `undefined` for BOTH a transient fs read failure AND a persistent JSON.parse failure of a corrupted data.json (torn write, sync conflict). PluginDataStore.init cannot tell them apart, so a PERMANENTLY corrupted file now hits the same path every session: 3 retries exhaust, defaults are shown, all data.json writes are refused (protectingUnreadDataJson), and the one-time notice says "restart Obsidian to load it again" — advice that can never work for corruption. The only way out is manually deleting `.obsidian/plugins/vicinity-graph/data.json`, which nothing tells the user.

The refusal itself is deliberate and correct (never overwrite a file that could not be read — the pre-06da6ce behavior silently overwrote a corrupt file with defaults, destroying whatever was recoverable), so this is NOT a request to weaken the write protection.

DECIDE (human): pick one —
(a) Distinguish corruption from transient failure with a direct `vault.adapter.read` probe of the plugin's data.json path after retries exhaust: raw read succeeds but JSON.parse fails => file is corrupt, not transient => quarantine it (rename to data.json.corrupt-<ts>, same set-aside pattern as VaultFileStore) and start fresh with writes ENABLED. Adds a second read path — some complexity.
(b) Keep the code as is and only fix the notice copy for honesty: mention that if the message repeats every restart, the settings file is damaged and deleting/renaming it resets settings. Zero risk, but leaves a permanently-degraded plugin behind one manual step.

Either way the notice copy in INIT_LOAD_FAILED_NOTICE (src/persistence/PluginDataStore.ts) needs the repeated-failure story.

## Acceptance Criteria

A vault whose data.json is permanently unparseable either self-recovers with the original file preserved (option a) or tells the user exactly how to recover (option b); a unit test covers the chosen behavior at the ScriptedPluginDataPort seam in src/persistence/PluginDataStore.test.ts.

