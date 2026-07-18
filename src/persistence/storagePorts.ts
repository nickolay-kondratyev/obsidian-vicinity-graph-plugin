/**
 * Structural ports over Obsidian's storage APIs (DIP, same pattern as
 * `src/adapters/obsidianPorts.ts`): real objects satisfy them unchanged,
 * tests use in-memory fakes.
 */

/** Structural slice of `Plugin` (`loadData`/`saveData` → the plugin's data.json). */
export interface PluginDataPort {
	loadData(): Promise<unknown>;
	saveData(data: unknown): Promise<void>;
}

/** Structural slice of `vault.adapter` (`DataAdapter`) for the doc-data folder. */
export interface FileStoragePort {
	exists(normalizedPath: string): Promise<boolean>;
	read(normalizedPath: string): Promise<string>;
	write(normalizedPath: string, data: string): Promise<void>;
	remove(normalizedPath: string): Promise<void>;
	mkdir(normalizedPath: string): Promise<void>;
	list(normalizedPath: string): Promise<{ files: string[]; folders: string[] }>;
}
