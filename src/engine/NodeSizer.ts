import { CENTRAL_SIZE_SCORE, NEUTRAL_NORMALIZED_VALUE } from "./constants";
import type { LinkProvider } from "./LinkProvider";
import { NodeEligibility } from "./NodeEligibility";
import type { TraversedNode } from "./NeighborhoodTraversal";
import type { SizeMetricId, SizingSettings, VaultPath } from "./types";

/** Computed size of one node — `sizePx` is the stable field step-04 diffs against. */
export interface NodeSize {
	/** Composed, normalized score in [0, 1]. */
	readonly sizeScore: number;
	readonly sizePx: number;
}

/**
 * One composable sizing metric: produces an independently-normalized value in
 * [0, 1] per node. Adding a metric = adding an entry to the registry in
 * {@link NodeSizer} — no other code changes (OCP).
 */
interface SizeMetric {
	normalizedValues(nodes: ReadonlyMap<VaultPath, TraversedNode>): ReadonlyMap<VaultPath, number>;
}

/**
 * Composes enabled, weighted metrics into a size score per node, then maps the
 * score onto the configured [minPx, maxPx] range.
 *
 * Centrals (MAIN + pinned — even when disconnected from MAIN) bypass metric
 * composition entirely and get {@link CENTRAL_SIZE_SCORE} → maxPx.
 */
export class NodeSizer {
	private readonly eligibility: NodeEligibility;

	constructor(private readonly provider: LinkProvider) {
		this.eligibility = new NodeEligibility(provider);
	}

	computeSizes(
		nodes: ReadonlyMap<VaultPath, TraversedNode>,
		settings: SizingSettings,
	): ReadonlyMap<VaultPath, NodeSize> {
		const enabledMetrics = this.enabledWeightedMetrics(settings);
		const totalWeight = enabledMetrics.reduce((sum, entry) => sum + entry.weight, 0);
		const normalizedPerMetric = enabledMetrics.map((entry) => ({
			weight: entry.weight,
			values: entry.metric.normalizedValues(nodes),
		}));
		const sizes = new Map<VaultPath, NodeSize>();
		for (const [path, node] of nodes) {
			const score = node.isCentral ? CENTRAL_SIZE_SCORE : this.composeScore(path, normalizedPerMetric, totalWeight);
			sizes.set(path, {
				sizeScore: score,
				sizePx: settings.minPx + score * (settings.maxPx - settings.minPx),
			});
		}
		return sizes;
	}

	private composeScore(
		path: VaultPath,
		normalizedPerMetric: readonly { readonly weight: number; readonly values: ReadonlyMap<VaultPath, number> }[],
		totalWeight: number,
	): number {
		if (totalWeight <= 0) {
			return NEUTRAL_NORMALIZED_VALUE; // No enabled metric can discriminate.
		}
		let weightedSum = 0;
		for (const { weight, values } of normalizedPerMetric) {
			weightedSum += weight * (values.get(path) ?? NEUTRAL_NORMALIZED_VALUE);
		}
		return weightedSum / totalWeight;
	}

	/** The metric registry: extend sizing by adding one entry here. */
	private enabledWeightedMetrics(
		settings: SizingSettings,
	): readonly { readonly metric: SizeMetric; readonly weight: number }[] {
		const registry: Readonly<Record<SizeMetricId, SizeMetric>> = {
			// log1p tames byte-size outliers (one huge note must not flatten the rest).
			"own-file-size": new MinMaxNormalizedMetric((node) => node.sizeBytes, Math.log1p),
			"total-linker-size": new MinMaxNormalizedMetric((node) => this.totalLinkerBytes(node.path), Math.log1p),
			"backlink-count": new MinMaxNormalizedMetric((node) => this.provider.getIncomingLinks(node.path).length),
			"outlink-count": new MinMaxNormalizedMetric((node) => this.nodeBearingOutlinkCount(node.path)),
			"depth-decay": new DepthDecayMetric(settings.depthDecayK),
		};
		return (Object.keys(registry) as SizeMetricId[])
			.filter((id) => settings.metrics[id].enabled)
			.map((id) => ({ metric: registry[id], weight: settings.metrics[id].weight }));
	}

	private totalLinkerBytes(path: VaultPath): number {
		let total = 0;
		for (const linker of this.provider.getIncomingLinks(path)) {
			total += this.provider.getFileMetadata(linker)?.sizeBytes ?? 0;
		}
		return total;
	}

	/** Attachments are not nodes, so links to them do not count as outlinks. */
	private nodeBearingOutlinkCount(path: VaultPath): number {
		return this.provider.getOutgoingLinks(path).filter((target) => this.eligibility.isNodeBearing(target)).length;
	}
}

/**
 * Min-max normalization over an optionally transformed raw value. When all
 * transformed values are equal (single node, all-zero bytes, ...) the metric
 * cannot discriminate and every node gets {@link NEUTRAL_NORMALIZED_VALUE}.
 */
class MinMaxNormalizedMetric implements SizeMetric {
	constructor(
		private readonly rawValue: (node: TraversedNode) => number,
		private readonly transform: (raw: number) => number = (raw) => raw,
	) {}

	normalizedValues(nodes: ReadonlyMap<VaultPath, TraversedNode>): ReadonlyMap<VaultPath, number> {
		const transformed = new Map<VaultPath, number>();
		for (const [path, node] of nodes) {
			transformed.set(path, this.transform(this.rawValue(node)));
		}
		const values = [...transformed.values()];
		const min = Math.min(...values);
		const max = Math.max(...values);
		const normalized = new Map<VaultPath, number>();
		for (const [path, value] of transformed) {
			normalized.set(path, max === min ? NEUTRAL_NORMALIZED_VALUE : (value - min) / (max - min));
		}
		return normalized;
	}
}

/** `1 / (1 + k * minDepth)` — inherently in (0, 1], no min-max pass needed. */
class DepthDecayMetric implements SizeMetric {
	constructor(private readonly k: number) {}

	normalizedValues(nodes: ReadonlyMap<VaultPath, TraversedNode>): ReadonlyMap<VaultPath, number> {
		const normalized = new Map<VaultPath, number>();
		for (const [path, node] of nodes) {
			normalized.set(path, 1 / (1 + this.k * node.minDepth));
		}
		return normalized;
	}
}
