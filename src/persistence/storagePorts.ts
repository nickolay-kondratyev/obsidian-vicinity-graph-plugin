/**
 * The plugin's owner of `data.json` I/O (DIP, same pattern as
 * `src/adapters/obsidianPorts.ts`): production wires the real
 * {@link ./PluginDataAdapter.PluginDataAdapter} over `Plugin` + `vault.adapter`,
 * tests use an in-memory fake.
 *
 * `data.json` is the plugin's ONLY persisted config file (settings are
 * global-only, pins are global). The first two methods are `Plugin`'s own
 * `loadData`/`saveData`; the last two are the raw-read PROBE and the QUARANTINE
 * that let {@link ./PluginDataStore.PluginDataStore} tell a permanently corrupt
 * file from a transient read failure once its retries exhaust — both of which the
 * bare `Plugin` cannot do (it can only read/write INSIDE its own folder through
 * the config adapter, and only as parsed JSON), so they reach the raw
 * `vault.adapter` in the real implementation.
 */
export interface PluginDataPort {
	loadData(): Promise<unknown>;
	saveData(data: unknown): Promise<void>;
	/**
	 * The raw text of `data.json` EXACTLY as on disk — the corruption probe run
	 * after {@link ./PluginDataStore.INIT_LOAD_ATTEMPTS} exhaust. `null` when the
	 * file is absent OR the fs read itself failed: either way the bytes cannot be
	 * classified, so the caller treats it as transient. Unlike `loadData` this does
	 * NOT parse — the caller parses the returned text to tell corrupt (bytes present
	 * but unparseable) from transient.
	 */
	readRawData(): Promise<string | null>;
	/**
	 * Sets aside a corrupt `data.json` — renames it to a `.corrupt-<ts>` sibling,
	 * NEVER deletes — so the session can start fresh with writes enabled while the
	 * user's damaged bytes stay recoverable. Returns the set-aside file's NAME for
	 * the recovery notice.
	 */
	quarantineData(): Promise<string>;
}
