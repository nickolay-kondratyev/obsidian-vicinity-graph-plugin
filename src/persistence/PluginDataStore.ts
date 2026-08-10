import type { DepthSettings, NodeExclusionSettings, ViewSettings } from "../engine";
import { SerialPromiseChain } from "../shared/SerialPromiseChain";
import type { UserNoticePort } from "../view/viewPorts";
import type { PinnedDocEntry, PluginData } from "./persistedShapes";
import { PersistedShapes } from "./persistedShapes";
import type { PluginDataPort } from "./storagePorts";

/**
 * Total `loadData` attempts {@link PluginDataStore.init} spends before giving up
 * on reading `data.json` (the try plus the retries). The failures this guards are
 * TRANSIENT — Obsidian's `Vault.readJson` (verified byte-identical in the shipped
 * 1.12.4 and 1.12.7 bundles) returns `undefined` when the fs read or the JSON
 * parse threw for any reason OTHER than ENOENT, e.g. a resource-exhaustion error
 * under load — so a couple of short-spaced retries recover the user's real
 * settings instead of silently booting the session on defaults (ticket
 * nid_ghaeps3siekw0oe17mr4xpmad_e: restart-time stale controls).
 */
export const INIT_LOAD_ATTEMPTS = 3;

/** Pause between {@link INIT_LOAD_ATTEMPTS}: long enough for a transient fs error to clear, short enough to not delay onload noticeably. */
const INIT_RETRY_DELAY_MS = 100;

/**
 * Shown ONCE when every read attempt failed: the session runs on defaults, but the
 * user's file was not touched — restarting reloads it. Plain language, states the
 * consequence and the way back (interface-design guardrail: no raw error codes).
 */
const INIT_LOAD_FAILED_NOTICE =
	"Vicinity Graph couldn't read its saved settings, so defaults are shown for this session. " +
	"Your settings file was left untouched and changes made this session won't be saved over it — " +
	"restart Obsidian to load it again.";

/** Real wall-clock pause; injectable so tests retry on the microtask queue instead of waiting. */
const REAL_SLEEP = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Typed owner of the plugin's `data.json`: the truly-global config dials
 * (`globalDepths`, `globalView`, `nodeExclusion`) AND the GLOBAL pinned set —
 * the one docid-keyed map the owner kept here (Obsidian-managed, one cheap
 * in-memory read) when the per-doc/per-main maps (`nodeOverrides`, `localPins`)
 * moved onto the per-file store ({@link ./PerDocStore PerDocStore}; ticket
 * `nid_8f8ey41extajt08zphwwxhnwq_e`).
 *
 * Holds the parsed state in memory after {@link init}; every mutation persists
 * through a serialized write chain (last write wins, no interleaved saveData
 * calls).
 */
export class PluginDataStore {
	private data: PluginData = PersistedShapes.defaultPluginData();
	private readonly writes = new SerialPromiseChain();

	/**
	 * True when {@link init} exhausted every read attempt: memory holds defaults
	 * while the user's REAL `data.json` sits intact and unread on disk. Every
	 * mutator persists the whole in-memory object, so any write let through now
	 * would overwrite the user's settings and pins with defaults — {@link persist}
	 * therefore refuses, and the rejection reaches the user through the settings
	 * pipeline's / `runGuarded`'s one failure policy.
	 */
	private protectingUnreadDataJson = false;

	/**
	 * @param notice optional: an init that exhausted its read retries says so ONCE here.
	 * @param sleep injected pause between retries (tests pass an immediate resolve).
	 */
	constructor(
		private readonly port: PluginDataPort,
		private readonly notice?: UserNoticePort,
		private readonly sleep: (ms: number) => Promise<void> = REAL_SLEEP,
	) {}

	/** Loads and defensively parses data.json (first run / malformed → defaults). */
	async init(): Promise<void> {
		this.data = PersistedShapes.parsePluginData(await this.loadRawResiliently());
	}

	/**
	 * The raw `data.json` content, retried on TRANSIENT failure. Obsidian's
	 * `Plugin.loadData` answers three ways (see {@link INIT_LOAD_ATTEMPTS}):
	 * parsed JSON, `null` (no file — a genuine first run, a DEFINITE answer never
	 * retried), or `undefined` (the read/parse FAILED with the file intact on
	 * disk). Only the failure is retried; treating it like a first run is exactly
	 * the silent-defaults bug this guards against — and worse, a later settings
	 * write would then persist those defaults OVER the user's intact file. A port
	 * rejection (the real one never rejects; fakes may) counts as a failed read.
	 */
	private async loadRawResiliently(): Promise<unknown> {
		for (let attempt = 1; attempt <= INIT_LOAD_ATTEMPTS; attempt += 1) {
			let raw: unknown = undefined;
			try {
				raw = await this.port.loadData();
			} catch (error: unknown) {
				console.error("vicinity-graph: reading data.json threw", { attempt }, error);
			}
			if (raw !== undefined) {
				return raw;
			}
			if (attempt < INIT_LOAD_ATTEMPTS) {
				await this.sleep(INIT_RETRY_DELAY_MS);
			}
		}
		console.error(
			`vicinity-graph: data.json unreadable after attempts=[${INIT_LOAD_ATTEMPTS}]; running this session on defaults, writes refused`,
		);
		this.notice?.show(INIT_LOAD_FAILED_NOTICE);
		this.protectingUnreadDataJson = true;
		return null;
	}

	globalDepths(): DepthSettings {
		return this.data.globalDepths;
	}

	globalView(): ViewSettings {
		return this.data.globalView;
	}

	pins(): readonly PinnedDocEntry[] {
		return this.data.pins;
	}

	nodeExclusion(): NodeExclusionSettings {
		return this.data.nodeExclusion;
	}

	async saveGlobalDepths(globalDepths: DepthSettings): Promise<void> {
		await this.persist({ ...this.data, globalDepths });
	}

	async saveGlobalView(globalView: ViewSettings): Promise<void> {
		await this.persist({ ...this.data, globalView });
	}

	async saveNodeExclusion(nodeExclusion: NodeExclusionSettings): Promise<void> {
		await this.persist({ ...this.data, nodeExclusion });
	}

	/** Re-pinning refreshes the timestamp (recency tiebreaker follows the newest pin intent). */
	async addPin(docid: string, pinTimestamp: number): Promise<void> {
		const withoutExisting = this.data.pins.filter((pin) => pin.docid !== docid);
		await this.persist({ ...this.data, pins: [...withoutExisting, { docid, pinTimestamp }] });
	}

	async removePins(docids: readonly string[]): Promise<void> {
		const removed = new Set(docids);
		await this.persist({ ...this.data, pins: this.data.pins.filter((pin) => !removed.has(pin.docid)) });
	}

	/**
	 * Drops the named docs from the GLOBAL pinned set (the only docid-keyed map
	 * still in `data.json`). Deleting a doc is NOT unpinning it, and it spans more
	 * than the pinned set — the per-file facts are dropped by
	 * {@link ./PerDocStore.PerDocStore.forgetDocs}, invoked alongside this by the
	 * live `vault.on('delete')` handler and the orphan sweep. A doc the pinned set
	 * never held is left untouched (vaults delete files the plugin never pinned).
	 */
	async forgetDocs(docids: readonly string[]): Promise<void> {
		const forgotten = new Set(docids);
		const pins = this.data.pins.filter((pin) => !forgotten.has(pin.docid));
		if (pins.length === this.data.pins.length) {
			return;
		}
		await this.persist({ ...this.data, pins });
	}

	/**
	 * In-memory state moves NOW, the disk write is serialised. The chain owns
	 * rejection isolation and caller-visible failure (see {@link SerialPromiseChain}).
	 *
	 * EXCEPT in a session protecting an unread `data.json` (see
	 * {@link protectingUnreadDataJson}): then the write is refused BEFORE memory
	 * moves, so the rebuild the caller's failure policy triggers snaps the screen
	 * back to the store rather than to a value that was never accepted.
	 */
	private persist(updated: PluginData): Promise<void> {
		if (this.protectingUnreadDataJson) {
			return Promise.reject(
				new Error("vicinity-graph: data.json was never read this session; refusing to overwrite it with defaults"),
			);
		}
		this.data = updated;
		return this.writes.run(() => this.port.saveData(this.data));
	}
}
