import { CENTRAL_SIZE_SCORE } from "./constants";
import { NodePriorityChain } from "./NodePriorityChain";
import type { PriorityRankable } from "./NodePriorityChain";
import type { PinnedNodeDescriptor, ViewSettings, ViewSettingsOverride } from "./types";

/** A pinned doc's partial view override, tied to its descriptor for conflict ranking. */
export interface PinnedViewOverride {
	readonly descriptor: PinnedNodeDescriptor;
	readonly override: ViewSettingsOverride;
}

export interface ViewSettingsResolutionInput {
	readonly global: ViewSettings;
	readonly mainOverride?: ViewSettingsOverride;
	readonly pinnedOverrides?: readonly PinnedViewOverride[];
}

/**
 * View cascade (sizing / grouping / cap), resolved PER FIELD:
 * MAIN's override → pinned docs fill remaining gaps → global. Absence of a
 * field = inherit, presence = pinned (never per-document snapshots).
 *
 * When several pinned docs pin the SAME field, the shared
 * {@link NodePriorityChain} arbitrates. Pinned descriptors are ranked as
 * centrals (minDepth 0, central size score, no MAIN distance), so the chain
 * collapses to: pin recency (most recent wins) → docid.
 */
export class ViewSettingsResolver {
	static resolve(input: ViewSettingsResolutionInput): ViewSettings {
		const rankedPinned = [...(input.pinnedOverrides ?? [])].sort((a, b) =>
			NodePriorityChain.compare(toRankable(a.descriptor), toRankable(b.descriptor)),
		);
		const field = <K extends keyof ViewSettings>(key: K): ViewSettings[K] => {
			const fromMain = input.mainOverride?.[key];
			if (fromMain !== undefined) {
				return fromMain;
			}
			for (const pinned of rankedPinned) {
				const fromPinned = pinned.override[key];
				if (fromPinned !== undefined) {
					return fromPinned;
				}
			}
			return input.global[key];
		};
		return {
			nodeCap: field("nodeCap"),
			groupByFolder: field("groupByFolder"),
			edgeVisibility: field("edgeVisibility"),
			layoutMode: field("layoutMode"),
			sizing: field("sizing"),
		};
	}
}

function toRankable(descriptor: PinnedNodeDescriptor): PriorityRankable {
	return {
		path: descriptor.path,
		minDepth: 0,
		sizeScore: CENTRAL_SIZE_SCORE,
		distanceToMain: undefined,
		pinTimestamp: descriptor.pinTimestamp,
		docid: descriptor.docid,
	};
}
