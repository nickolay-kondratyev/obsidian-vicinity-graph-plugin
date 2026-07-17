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
}
