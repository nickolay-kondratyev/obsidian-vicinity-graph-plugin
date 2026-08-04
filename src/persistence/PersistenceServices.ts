import type { DocIdPort, VaultFilePort } from "../adapters/obsidianPorts";
import type { PersistableIdentity } from "./DocPersistEligibility";
import { DocPersistEligibility } from "./DocPersistEligibility";
import type { PathDocIdMap } from "./PathDocIdMap";
import type { NodeOverrideChange, NodeOverrideField, PluginDataStore } from "./PluginDataStore";

/**
 * The doc-scoped write-intent facade: every entry point is an EXPLICIT user
 * action on one doc, so this is the only place that calls `ensureDocId` (id-lib
 * contract: never ensure ids on read/bulk paths), and pinning returns the
 * {@link PersistableIdentity} verdict — a refused doc (Q3: no docid / unsafe
 * foreign docid) persists NOTHING and the typed reason feeds the node emblem.
 *
 * Settings have NO doc identity involved (they are global) — callers use
 * {@link PluginDataStore} directly. What is left doc-scoped is the pinned set
 * and the per-node override map, both stored globally in `data.json` but keyed
 * by docid.
 */
export class PersistenceServices {
	constructor(
		private readonly docIdPort: DocIdPort,
		private readonly pluginDataStore: PluginDataStore,
		private readonly pathDocIdMap: PathDocIdMap,
		private readonly clock: () => number = Date.now,
	) {}

	async pinDoc(file: VaultFilePort): Promise<PersistableIdentity> {
		return this.withPersistableIdentity(file, (docid) => this.pluginDataStore.addPin(docid, this.clock()));
	}

	/**
	 * Unpin lands unconditionally and returns NO verdict — unlike {@link pinDoc},
	 * which must classify the file first (a docid may be unassignable). Removing a
	 * pin needs only the docid the pin is keyed by, and a docid that is no longer
	 * there is already the desired state. WHY it matters to callers:
	 * `ControlsActions.unpinNode` therefore has no refusal to gate on.
	 */
	async unpinDoc(docid: string): Promise<void> {
		await this.pluginDataStore.removePins([docid]);
	}

	/**
	 * Setting an override field is a write intent exactly like pinning: the id
	 * is ensured LAZILY (frontmatter is written only now, Q5: silently), the
	 * same eligibility rule refuses the same docs, and a refused doc persists
	 * NOTHING. The change names ONE field — the doc's other override field is
	 * merged in the store from state read fresh there.
	 */
	async saveNodeOverrideField(file: VaultFilePort, change: NodeOverrideChange): Promise<PersistableIdentity> {
		return this.withPersistableIdentity(file, (docid) =>
			this.pluginDataStore.saveNodeOverrideField(docid, change),
		);
	}

	/**
	 * Clearing a field ("inherit this again") NEVER mints an id — it reads with
	 * `getDocId`: a doc without a persistable docid cannot own a stored
	 * override, so "cleared" is ALREADY true and ensuring an id would mutate the
	 * user's note to store nothing. Like {@link unpinDoc} it lands
	 * unconditionally and reports no verdict: there is nothing to refuse.
	 */
	async clearNodeOverrideField(file: VaultFilePort, field: NodeOverrideField): Promise<void> {
		const identity = DocPersistEligibility.classify(await this.docIdPort.getDocId(file));
		if (identity.kind !== "persistable") {
			return;
		}
		this.pathDocIdMap.set(file.path, identity.docid);
		await this.pluginDataStore.clearNodeOverrideField(identity.docid, field);
	}

	/** ensureDocId (write intent!) → Q3 classification → persist only on a "persistable" verdict. */
	private async withPersistableIdentity(
		file: VaultFilePort,
		persist: (docid: string) => Promise<void>,
	): Promise<PersistableIdentity> {
		const identity = DocPersistEligibility.classify(await this.docIdPort.ensureDocId(file));
		if (identity.kind === "persistable") {
			this.pathDocIdMap.set(file.path, identity.docid);
			await persist(identity.docid);
		}
		return identity;
	}
}
