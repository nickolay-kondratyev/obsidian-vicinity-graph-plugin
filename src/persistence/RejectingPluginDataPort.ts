import type { PluginDataPort } from "./storagePorts";

/**
 * A `data.json` port whose saves REJECT — what a locked vault, a full disk or a sync
 * conflict looks like from inside the plugin. The counterpart to
 * {@link FakePluginDataPort} for every suite that pins the FAILURE policy.
 *
 * `saveAttempts` is part of the contract, not a convenience: it is what shows that a
 * failed write did not take the writes queued behind it down with it.
 */
export class RejectingPluginDataPort implements PluginDataPort {
	saveAttempts = 0;

	constructor(private readonly failure: Error = new Error("data.json could not be written")) {}

	async loadData(): Promise<unknown> {
		return null;
	}

	saveData(): Promise<void> {
		this.saveAttempts += 1;
		return Promise.reject(this.failure);
	}
}
