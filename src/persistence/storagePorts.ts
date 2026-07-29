/**
 * Structural port over Obsidian's storage API (DIP, same pattern as
 * `src/adapters/obsidianPorts.ts`): the real `Plugin` satisfies it unchanged,
 * tests use an in-memory fake.
 *
 * `data.json` is the plugin's ONLY persisted file (settings are global-only,
 * pins are global), so there is no vault-adapter file port here.
 */

/** Structural slice of `Plugin` (`loadData`/`saveData` → the plugin's data.json). */
export interface PluginDataPort {
	loadData(): Promise<unknown>;
	saveData(data: unknown): Promise<void>;
}
