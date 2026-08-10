---
closed_iso: 2026-08-10T22:40:40Z
id: nid_08ripmsxon0r9ncn42lp623g1_e
title: 'Persistently corrupted data.json degrades every session: refusal is right,
  but recovery guidance and corruption-vs-transient distinction are missing'
status: closed
deps: []
links: []
created_iso: '2026-08-10T20:09:55Z'
status_updated_iso: 2026-08-10T22:40:40Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [persistence]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
---
Follow-up from the review of ticket nid_ghaeps3siekw0oe17mr4xpmad_e (commits 06da6ce + eb6d428 on src/persistence/PluginDataStore.ts).

Obsidian's Vault.readJson returns `undefined` for BOTH a transient fs read failure AND a persistent JSON.parse failure of a corrupted data.json (torn write, sync conflict). PluginDataStore.init cannot tell them apart, so a PERMANENTLY corrupted file now hits the same path every session: 3 retries exhaust, defaults are shown, all data.json writes are refused (protectingUnreadDataJson), and the one-time notice says "restart Obsidian to load it again" — advice that can never work for corruption. The only way out is manually deleting `.obsidian/plugins/vicinity-graph/data.json`, which nothing tells the user.

The refusal itself is deliberate and correct (never overwrite a file that could not be read — the pre-06da6ce behavior silently overwrote a corrupt file with defaults, destroying whatever was recoverable), so this is NOT a request to weaken the write protection.

DECIDE (human): pick one —
(a) Distinguish corruption from transient failure with a direct `vault.adapter.read` probe of the plugin's data.json path after retries exhaust: raw read succeeds but JSON.parse fails => file is corrupt, not transient => quarantine it (rename to data.json.corrupt-<ts>, same set-aside pattern as VaultFileStore) and start fresh with writes ENABLED. Adds a second read path — some complexity.
    `HUMAN: YES lets try to read it to distinguish`
(b) Keep the code as is and only fix the notice copy for honesty: mention that if the message repeats every restart, the settings file is damaged and deleting/renaming it resets settings. Zero risk, but leaves a permanently-degraded plugin behind one manual step.

Either way the notice copy in INIT_LOAD_FAILED_NOTICE (src/persistence/PluginDataStore.ts) needs the repeated-failure story.

## Acceptance Criteria

A vault whose data.json is permanently unparseable either self-recovers with the original file preserved (option a) or tells the user exactly how to recover (option b); a unit test covers the chosen behavior at the ScriptedPluginDataPort seam in src/persistence/PluginDataStore.test.ts.

## Resolution — option (a), the human's pick ("YES lets try to read it to distinguish")

A permanently corrupt `data.json` now SELF-RECOVERS on the first session, original bytes preserved.

**How it distinguishes corrupt from transient.** After `PluginDataStore`'s `INIT_LOAD_ATTEMPTS` retries all come back `undefined`, `recoverAfterExhaustedReads()` runs a raw-bytes PROBE (`isCorruptOnDisk()`):
- Bytes present but `JSON.parse` throws ⇒ CORRUPT ⇒ quarantine the file (rename aside, never delete) and start FRESH with writes ENABLED (`protectingUnreadDataJson` stays `false`).
- No bytes / bytes that DO parse / the probe itself threw ⇒ TRANSIENT ⇒ unchanged pre-existing behavior: keep the intact file unread, refuse writes so this session's defaults never overwrite the user's real settings.

**Files changed:**
- `src/persistence/storagePorts.ts` — widened `PluginDataPort` with `readRawData()` (raw probe; `null` when absent or the fs read failed) and `quarantineData()` (rename to a `.corrupt-<ts>` sibling, returns the set-aside NAME). The bare `Plugin` can no longer satisfy the port (it only reads/writes parsed JSON inside its own folder), so the raw ops reach `vault.adapter`.
- `src/persistence/PluginDataStore.ts` — `recoverAfterExhaustedReads()` + `isCorruptOnDisk()`; a NEW corruption notice (`initCorruptQuarantinedNotice`, names the set-aside file); `INIT_LOAD_FAILED_NOTICE` gained the repeated-failure story (transient clears on restart, so a message that returns every session points at a damaged file the probe still cannot read — e.g. a permissions error — deleting/renaming `data.json` resets settings).
- `src/persistence/PluginDataAdapter.ts` (NEW) — the production `PluginDataPort`: delegates `loadData`/`saveData` to `Plugin`, and does the raw probe + collision-safe `.corrupt-<ts>` quarantine over a `VaultFsPort`. Thin obsidian-adjacent glue; classification lives in the store.
- `src/main.ts` — wires `PluginDataAdapter` (over `this`, `VaultAdapterFsPort(this.app.vault.adapter)`, `<manifest.dir>/data.json`, `Date.now`) into `PluginDataStore`.
- `src/persistence/FakePluginDataPort.ts`, `RejectingPluginDataPort.ts` — implement the two new port methods.

**Tests (all green):**
- `src/persistence/PluginDataStore.test.ts` — new `PluginDataStore.init corruption recovery` suite at the ScriptedPluginDataPort seam (probe returns unparseable bytes ⇒ quarantined once, writes enabled, defaults served, user told once naming the set-aside file; probe returns parseable bytes OR throws ⇒ NOT quarantined, writes stay refused).
- `src/persistence/PluginDataAdapter.test.ts` (NEW) — raw read returns bytes / null-on-absent / null-on-read-throw; quarantine renames to `.corrupt-<ts>`, removes the original, returns the name, and uses a `_2` sibling on collision.

`npm run check` ✓, `npm test` (1860) ✓, `npm run test:e2e -- controlsRestart.e2e.ts` (data.json persistence across a real Obsidian restart) ✓. Note: the dev env was missing `stable-ids-for-obsidian`; `npm install` restored it (pre-existing, unrelated to this change).
