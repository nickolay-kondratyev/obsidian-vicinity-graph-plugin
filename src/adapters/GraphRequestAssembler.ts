import type {
	DepthSettings,
	GraphBuildRequest,
	NodeExclusionSettings,
	NodeOverride,
	PinnedNodeDescriptor,
	VaultPath,
	ViewSettings,
} from "../engine";
import { asDocId, asVaultPath } from "../engine";
import type { PinnedDocEntry } from "../persistence/persistedShapes";

/** Everything the assembler needs, already loaded (it does no IO itself). */
export interface GraphRequestInputs {
	readonly mainPath: string;
	/** `null` when the main doc has no docid (graph still builds; it just cannot be pinned). */
	readonly mainDocId: string | null;
	readonly pins: readonly PinnedDocEntry[];
	/**
	 * The ACTIVE main's local pins (already selected by the builder from the
	 * docid-keyed `localPins` map). Merged with {@link pins} into ONE pinned-root
	 * list — the engine cannot tell local from global; local-vs-global is a
	 * persistence/view fact, not a traversal fact.
	 */
	readonly localPins: readonly PinnedDocEntry[];
	/** The docid-keyed per-node override map (data.json, verbatim). */
	readonly nodeOverrides: Readonly<Record<string, NodeOverride>>;
	/** docid → current vault path (the in-memory map). `undefined` = unresolvable docid. */
	readonly resolveDocPath: (docid: string) => string | undefined;
	readonly globalDepths: DepthSettings;
	readonly globalView: ViewSettings;
	/** Global node exclusion (vault-wide). Passed straight through to the engine. */
	readonly nodeExclusion: NodeExclusionSettings;
}

/**
 * PURE translation of the docid-keyed persisted maps (pins, per-node
 * overrides) into the PATH-keyed {@link GraphBuildRequest} the engine demands
 * (engine contract: persisted docid-keyed data never crosses the boundary
 * untranslated). Settings need no translation at all — they are global.
 *
 * Judgments encoded here:
 * - a pin/override whose docid does not resolve to a path is SKIPPED. The read
 *   path already warmed the map on demand (DocIdMapWarmer), so this is almost
 *   always a true orphan the delayed sweep will delete; a doc the warm-up could
 *   not READ lands here too, and is likewise skipped rather than guessed at,
 * - a pin pointing at the main doc is skipped (it is already central) — an
 *   OVERRIDE on the main doc is NOT: overrides apply from any central.
 */
export class GraphRequestAssembler {
	static assemble(inputs: GraphRequestInputs): GraphBuildRequest {
		const pinned = GraphRequestAssembler.pinnedDescriptors(inputs);
		const nodeOverrides = GraphRequestAssembler.pathKeyedOverrides(inputs);
		return {
			main: {
				path: asVaultPath(inputs.mainPath),
				...(inputs.mainDocId !== null ? { docid: asDocId(inputs.mainDocId) } : {}),
			},
			...(pinned.length > 0 ? { pinned } : {}),
			...(nodeOverrides.size > 0 ? { nodeOverrides } : {}),
			globalDepths: inputs.globalDepths,
			globalView: inputs.globalView,
			nodeExclusion: inputs.nodeExclusion,
		};
	}

	private static pinnedDescriptors(inputs: GraphRequestInputs): readonly PinnedNodeDescriptor[] {
		// GLOBAL ∪ the active main's LOCAL pins, deduped by docid keeping the MOST
		// RECENT pinTimestamp so NodePriorityChain recency stays honest for a doc
		// pinned both ways. Insertion order (globals first) is preserved.
		const mostRecentByDocid = new Map<string, number>();
		for (const pin of [...inputs.pins, ...inputs.localPins]) {
			const existing = mostRecentByDocid.get(pin.docid);
			if (existing === undefined || pin.pinTimestamp > existing) {
				mostRecentByDocid.set(pin.docid, pin.pinTimestamp);
			}
		}
		const descriptors: PinnedNodeDescriptor[] = [];
		for (const [docid, pinTimestamp] of mostRecentByDocid) {
			const path = inputs.resolveDocPath(docid);
			// A pin whose docid does not resolve is a true orphan (skip); a pin that
			// IS the main doc is already central (skip) — unchanged from global-only.
			if (path === undefined || path === inputs.mainPath) {
				continue;
			}
			descriptors.push({ path: asVaultPath(path), docid: asDocId(docid), pinTimestamp });
		}
		return descriptors;
	}

	private static pathKeyedOverrides(inputs: GraphRequestInputs): ReadonlyMap<VaultPath, NodeOverride> {
		const overrides = new Map<VaultPath, NodeOverride>();
		for (const [docid, override] of Object.entries(inputs.nodeOverrides)) {
			const path = inputs.resolveDocPath(docid);
			if (path !== undefined) {
				overrides.set(asVaultPath(path), override);
			}
		}
		return overrides;
	}
}
