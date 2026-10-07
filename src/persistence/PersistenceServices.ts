import type { DocIdPort, VaultFilePort } from "../adapters/obsidianPorts";
import type { AiNamedRelationship, RelationshipName } from "../engine";
import type { NotPersistableReason, PersistableIdentity } from "./DocPersistEligibility";
import { DocPersistEligibility } from "./DocPersistEligibility";
import type { PathDocIdMap } from "./PathDocIdMap";
import type { NodeOverrideChange, NodeOverrideField, PerDocStore } from "./PerDocStore";
import type { PluginDataStore } from "./PluginDataStore";
import type { RelationshipStore } from "./RelationshipStore";

/**
 * Verdict of a LOCAL pin: it needs TWO persistable docids (the map is keyed by
 * MAIN, valued by TARGET), so a refusal must name WHICH doc could not be
 * persisted — reusing the same {@link NotPersistableReason} vocabulary a global
 * pin reports, so the node emblem's copy stays one set of reasons.
 */
export type LocalPinPersistOutcome =
	| { readonly kind: "persisted"; readonly mainDocid: string; readonly targetDocid: string }
	| { readonly kind: "not-persistable"; readonly refusedDoc: "main" | "target"; readonly reason: NotPersistableReason };

/**
 * Verdict of naming a relationship: like a local pin it needs TWO persistable
 * docids (the file is `from_id/<source>/<target>.json`), so a refusal names
 * WHICH note could not be persisted, in the same {@link NotPersistableReason}
 * vocabulary.
 */
export type RelationshipPersistOutcome =
	| { readonly kind: "persisted" }
	| { readonly kind: "not-persistable"; readonly refusedDoc: "source" | "target"; readonly reason: NotPersistableReason };

/**
 * Verdict of storing an AI name: a {@link RelationshipPersistOutcome}, or
 * `already-named` when the pair got a record (manual, AI or dismissed) while the
 * request was in flight — that record wins and nothing is written.
 */
export type AiRelationshipPersistOutcome = RelationshipPersistOutcome | { readonly kind: "already-named" };

/** Both notes of a relationship, minted and persistable. */
interface RelationshipIdentities {
	readonly sourceDocid: string;
	readonly targetDocid: string;
}

/**
 * The doc-scoped write-intent facade: every entry point is an EXPLICIT user
 * action on one doc, so this is the only place that calls `ensureDocId` (id-lib
 * contract: never ensure ids on read/bulk paths), and pinning returns the
 * {@link PersistableIdentity} verdict — a refused doc (Q3: no docid / unsafe
 * foreign docid) persists NOTHING and the typed reason feeds the node emblem.
 *
 * Settings have NO doc identity involved (they are global) — callers use
 * {@link PluginDataStore} directly. What is left doc-scoped: the GLOBAL pinned
 * set (kept in `data.json`, so global pin/unpin go to {@link PluginDataStore}),
 * and the per-doc/per-main facts — node overrides and local pins — which now live
 * in the per-file store ({@link PerDocStore}). This facade is the seam that keeps
 * both routings behind ONE `ensureDocId`/eligibility discipline.
 */
export class PersistenceServices {
	constructor(
		private readonly docIdPort: DocIdPort,
		private readonly pluginDataStore: PluginDataStore,
		private readonly perDocStore: PerDocStore,
		/** The stored relationship names (manual + AI), one file per directed pair. */
		private readonly relationshipStore: RelationshipStore,
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
	 * Locally pins TARGET under MAIN — a write intent needing a docid for BOTH
	 * (the map is keyed by main, valued by target; Q2: minting on the un-clicked
	 * MAIN is sanctioned). Classifies the CLICKED target FIRST, so a doomed pin
	 * (target unpinnable) never writes frontmatter into the main the user did not
	 * touch; MAIN is minted only once the pin is certain to land. A re-pin
	 * refreshes the timestamp ({@link PluginDataStore.addLocalPin}).
	 */
	async localPinDoc(mainFile: VaultFilePort, targetFile: VaultFilePort): Promise<LocalPinPersistOutcome> {
		const targetIdentity = DocPersistEligibility.classify(await this.docIdPort.ensureDocId(targetFile));
		if (targetIdentity.kind !== "persistable") {
			return { kind: "not-persistable", refusedDoc: "target", reason: targetIdentity.reason };
		}
		const mainIdentity = DocPersistEligibility.classify(await this.docIdPort.ensureDocId(mainFile));
		if (mainIdentity.kind !== "persistable") {
			return { kind: "not-persistable", refusedDoc: "main", reason: mainIdentity.reason };
		}
		this.pathDocIdMap.set(targetFile.path, targetIdentity.docid);
		this.pathDocIdMap.set(mainFile.path, mainIdentity.docid);
		await this.perDocStore.addLocalPin(mainIdentity.docid, targetIdentity.docid, this.clock());
		return { kind: "persisted", mainDocid: mainIdentity.docid, targetDocid: targetIdentity.docid };
	}

	/**
	 * Locally unpins TARGET from MAIN. Like {@link clearNodeOverrideField} it reads
	 * the MAIN's id with `getDocId` and NEVER mints: a main with no persistable
	 * docid owns no local pins, so "unpinned" is already true. Lands
	 * unconditionally and reports no verdict — there is nothing to refuse.
	 */
	async localUnpinDoc(mainFile: VaultFilePort, targetDocid: string): Promise<void> {
		const identity = DocPersistEligibility.classify(await this.docIdPort.getDocId(mainFile));
		if (identity.kind !== "persistable") {
			return;
		}
		this.pathDocIdMap.set(mainFile.path, identity.docid);
		await this.perDocStore.removeLocalPins(identity.docid, [targetDocid]);
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
			this.perDocStore.saveNodeOverrideField(docid, change),
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
		await this.perDocStore.clearNodeOverrideField(identity.docid, field);
	}

	/**
	 * Names (or renames) the DIRECTED relationship source → target as the user's
	 * manual name — a write intent on BOTH notes, so ids are minted for both (like a
	 * local pin), by {@link relationshipIdentities}.
	 */
	async nameRelationship(
		sourceFile: VaultFilePort,
		targetFile: VaultFilePort,
		name: RelationshipName,
	): Promise<RelationshipPersistOutcome> {
		const identities = await this.relationshipIdentities(sourceFile, targetFile);
		if (identities.kind !== "persistable") {
			return identities.refusal;
		}
		await this.relationshipStore.saveManualName(identities.ids.sourceDocid, identities.ids.targetDocid, name);
		return { kind: "persisted" };
	}

	/**
	 * Stores an AI name for source → target (task 3/4). A write intent exactly like
	 * a manual name — ids are minted for both notes, by the same rule — but it never
	 * overwrites: a pair that holds ANY record by now keeps it (`already-named`).
	 */
	async saveAiRelationship(
		sourceFile: VaultFilePort,
		targetFile: VaultFilePort,
		named: AiNamedRelationship,
	): Promise<AiRelationshipPersistOutcome> {
		const identities = await this.relationshipIdentities(sourceFile, targetFile);
		if (identities.kind !== "persistable") {
			return identities.refusal;
		}
		const written = await this.relationshipStore.saveAiName(identities.ids.sourceDocid, identities.ids.targetDocid, named);
		return written ? { kind: "persisted" } : { kind: "already-named" };
	}

	/**
	 * Clears the stored name of source → target. Like {@link clearNodeOverrideField}
	 * it NEVER mints: a note without a persistable id cannot be part of a stored
	 * relationship, so "cleared" is already true. Lands unconditionally, no verdict.
	 */
	async clearRelationship(sourceFile: VaultFilePort, targetFile: VaultFilePort): Promise<void> {
		const source = DocPersistEligibility.classify(await this.docIdPort.getDocId(sourceFile));
		const target = DocPersistEligibility.classify(await this.docIdPort.getDocId(targetFile));
		if (source.kind !== "persistable" || target.kind !== "persistable") {
			return;
		}
		this.pathDocIdMap.set(sourceFile.path, source.docid);
		this.pathDocIdMap.set(targetFile.path, target.docid);
		await this.relationshipStore.clearName(source.docid, target.docid);
	}

	/**
	 * Mints (write intent!) both notes' ids. Both are checked for eligibility BEFORE
	 * either is minted, so a pair that cannot be stored (an attachment endpoint)
	 * writes nothing into the other note. An unsafe foreign id is only known once
	 * read, so that refusal can follow a mint on the source — which is then simply a
	 * note with an id.
	 */
	private async relationshipIdentities(
		sourceFile: VaultFilePort,
		targetFile: VaultFilePort,
	): Promise<
		| { readonly kind: "persistable"; readonly ids: RelationshipIdentities }
		| { readonly kind: "refused"; readonly refusal: RelationshipPersistOutcome }
	> {
		if (!this.docIdPort.isEligible(sourceFile)) {
			return { kind: "refused", refusal: { kind: "not-persistable", refusedDoc: "source", reason: "no-docid" } };
		}
		if (!this.docIdPort.isEligible(targetFile)) {
			return { kind: "refused", refusal: { kind: "not-persistable", refusedDoc: "target", reason: "no-docid" } };
		}
		const source = DocPersistEligibility.classify(await this.docIdPort.ensureDocId(sourceFile));
		if (source.kind !== "persistable") {
			return { kind: "refused", refusal: { kind: "not-persistable", refusedDoc: "source", reason: source.reason } };
		}
		const target = DocPersistEligibility.classify(await this.docIdPort.ensureDocId(targetFile));
		if (target.kind !== "persistable") {
			return { kind: "refused", refusal: { kind: "not-persistable", refusedDoc: "target", reason: target.reason } };
		}
		this.pathDocIdMap.set(sourceFile.path, source.docid);
		this.pathDocIdMap.set(targetFile.path, target.docid);
		return { kind: "persistable", ids: { sourceDocid: source.docid, targetDocid: target.docid } };
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
