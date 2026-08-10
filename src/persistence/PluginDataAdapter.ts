import { formatQuarantineTimestamp } from "./quarantineTimestamp";
import type { PluginDataPort } from "./storagePorts";
import type { VaultFsPort } from "./vaultFsPort";

/** Infix marking a set-aside corrupt `data.json` (ticket nid_08ripmsxon0r9ncn42lp623g1_e). */
const CORRUPT_INFIX = ".corrupt-";

/** Structural slice of `Plugin` this adapter delegates the PARSED read/write to. */
export interface PluginDataIo {
	loadData(): Promise<unknown>;
	saveData(data: unknown): Promise<void>;
}

/**
 * The production {@link PluginDataPort}: `Plugin`'s own `loadData`/`saveData` for
 * the PARSED path, plus a raw-bytes probe and a quarantine that reach the vault
 * filesystem directly. The bare `Plugin` cannot do the latter two — its config
 * adapter only reads/writes `data.json` as parsed JSON — so those go through the
 * same raw `vault.adapter` seam ({@link VaultFsPort}) the per-file store uses.
 *
 * The probe + quarantine let {@link ./PluginDataStore.PluginDataStore} tell a
 * PERMANENTLY corrupt `data.json` (present but unparseable) from a TRANSIENT read
 * failure once its retries exhaust: the corrupt file is renamed aside (never
 * deleted) so the session recovers with writes enabled and the damaged bytes stay
 * recoverable. Living OUTSIDE the tested store on purpose — this is the thin,
 * obsidian-adjacent glue; the classification logic is the store's.
 */
export class PluginDataAdapter implements PluginDataPort {
	/**
	 * @param io the plugin's own `loadData`/`saveData` (bind them from the `Plugin`).
	 * @param fs raw vault filesystem for the probe/quarantine (`vault.adapter`, wrapped).
	 * @param dataJsonPath vault-root-relative path of the plugin's `data.json`
	 *   (`<manifest.dir>/data.json`).
	 * @param clock injected epoch-millis source for the quarantine timestamp (never `Date.now()` directly here).
	 */
	constructor(
		private readonly io: PluginDataIo,
		private readonly fs: VaultFsPort,
		private readonly dataJsonPath: string,
		private readonly clock: () => number,
	) {}

	loadData(): Promise<unknown> {
		return this.io.loadData();
	}

	saveData(data: unknown): Promise<void> {
		return this.io.saveData(data);
	}

	/** Raw `data.json` text, or `null` when absent OR the read failed (an unclassifiable transient). */
	async readRawData(): Promise<string | null> {
		try {
			if (!(await this.fs.exists(this.dataJsonPath))) {
				return null;
			}
			return await this.fs.read(this.dataJsonPath);
		} catch {
			return null;
		}
	}

	/** Renames `data.json` to a free `data.json.corrupt-<ts>` sibling; returns that name. */
	async quarantineData(): Promise<string> {
		const target = await this.freeCorruptPath();
		await this.fs.rename(this.dataJsonPath, target);
		return PluginDataAdapter.nameOf(target);
	}

	/** The first free `<data.json>.corrupt-<ts>[_n]` sibling (collision-safe, never overwrites). */
	private async freeCorruptPath(): Promise<string> {
		const stamped = `${this.dataJsonPath}${CORRUPT_INFIX}${formatQuarantineTimestamp(this.clock())}`;
		for (let attempt = 1; ; attempt++) {
			const candidate = attempt === 1 ? stamped : `${stamped}_${attempt}`;
			if (!(await this.fs.exists(candidate))) {
				return candidate;
			}
		}
	}

	private static nameOf(path: string): string {
		const slash = path.lastIndexOf("/");
		return slash === -1 ? path : path.slice(slash + 1);
	}
}
