import type { PluginDataPort } from "./storagePorts";

/** In-memory data.json port for tests; `saved` mirrors what Obsidian would hold on disk. */
export class FakePluginDataPort implements PluginDataPort {
	saved: unknown = null;

	async loadData(): Promise<unknown> {
		return this.saved;
	}

	async saveData(data: unknown): Promise<void> {
		// Deep copy: catches accidental reliance on shared object identity.
		this.saved = JSON.parse(JSON.stringify(data));
	}

	/**
	 * Raw bytes of what is "on disk". `loadData` here always parses, so the store's
	 * corruption probe is never reached through this fake — defined for interface
	 * completeness (corruption is exercised via ScriptedPluginDataPort in the test).
	 */
	async readRawData(): Promise<string | null> {
		return this.saved === null ? null : JSON.stringify(this.saved);
	}

	async quarantineData(): Promise<string> {
		this.saved = null;
		return "data.json.corrupt-fake";
	}
}
