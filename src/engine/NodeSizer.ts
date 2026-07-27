import {
	CENTRAL_SIZE_SCORE,
	NEUTRAL_NORMALIZED_VALUE,
	THUMBNAIL_VISIBLE_MIN_NODE_PX,
	clampSizingSettings,
} from "./constants";
import type { LinkProvider } from "./LinkProvider";
import { NodeEligibility } from "./NodeEligibility";
import type { TraversedNode } from "./VicinityTraversal";
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
 *
 * Image-bearing nodes then get a pixel FLOOR so their thumbnail actually fits
 * (see {@link NodeSizer.withImageSpace}).
 */
export class NodeSizer {
	private readonly eligibility: NodeEligibility;

	constructor(private readonly provider: LinkProvider) {
		this.eligibility = new NodeEligibility(provider);
	}

	computeSizes(
		nodes: ReadonlyMap<VaultPath, TraversedNode>,
		rawSettings: SizingSettings,
	): ReadonlyMap<VaultPath, NodeSize> {
		// The sizer is TOTAL: `sizePx` becomes node geometry a downstream wasm
		// router cannot survive being handed non-finite, so hostile settings are
		// clamped here with the SAME single-source table the settings boundary
		// uses — never with a bespoke guard that could drift from it.
		const settings = clampSizingSettings(rawSettings);
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
				// The floor is applied to the PIXELS only, never to the score: the score
				// is pure relevance and also ranks truncation (`NodePriorityChain`), so
				// raising it would let an image promote a note over more relevant ones.
				sizeScore: score,
				sizePx: NodeSizer.withImageSpace(node, settings.minPx + score * (settings.maxPx - settings.minPx), settings),
			});
		}
		return sizes;
	}

	/**
	 * Guarantees a note that HAS an image is tall enough for its thumbnail to be
	 * displayed ({@link THUMBNAIL_VISIBLE_MIN_NODE_PX}) — without it, a low-scoring
	 * note's image is silently never shown.
	 *
	 * Keyed on the STABLE fact `firstImagePath !== undefined`, deliberately NOT on
	 * the resolved preview kind (`nodePreviewChoice`): `sizePx` must not move with
	 * `nodePreviewPreference`, or flipping the preview pill would cross
	 * `SIZE_RELAYOUT_THRESHOLD` and force a full relayout instead of the data-only
	 * refresh the pill promises. So a note with an image reserves the space even
	 * when the preference currently shows its outline there instead.
	 *
	 * The floor itself is capped by the user's `maxPx` (an explicit maximum is never
	 * overruled) and can only ever GROW a node — the outer `Math.max` keeps it a
	 * floor even under inverted `minPx > maxPx` settings, which the per-field clamp
	 * permits.
	 */
	private static withImageSpace(node: TraversedNode, sizePx: number, settings: SizingSettings): number {
		if (node.firstImagePath === undefined) {
			return sizePx;
		}
		return Math.max(sizePx, Math.min(THUMBNAIL_VISIBLE_MIN_NODE_PX, settings.maxPx));
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
		// Loop, not Math.min(...spread): sizing runs pre-truncation, so the node
		// count is unbounded by the cap and a spread could hit argument limits.
		let min = Number.POSITIVE_INFINITY;
		let max = Number.NEGATIVE_INFINITY;
		for (const value of transformed.values()) {
			min = Math.min(min, value);
			max = Math.max(max, value);
		}
		const normalized = new Map<VaultPath, number>();
		for (const [path, value] of transformed) {
			normalized.set(path, max === min ? NEUTRAL_NORMALIZED_VALUE : (value - min) / (max - min));
		}
		return normalized;
	}
}

/**
 * `1 / (1 + k * minDepth)` — inherently in (0, 1] for the `k >= 0` the settings
 * bounds allow, so no min-max pass is needed.
 *
 * The finite guard is DELIBERATE defence in depth, and it is honestly unreachable
 * from {@link NodeSizer.computeSizes} today: that method clamps `k` into
 * `SIZING_RANGES.depthDecayK` before constructing this metric, so removing the
 * guard breaks nothing there. It exists because the class is constructible with
 * any number and must be total in its own right — the denominator vanishes at
 * `k = -1/minDepth` (`Infinity`) and `k = Infinity` gives `Infinity * 0 = NaN` at
 * depth 0. A non-finite result degrades to {@link NEUTRAL_NORMALIZED_VALUE}, the
 * same "cannot discriminate" convention {@link MinMaxNormalizedMetric} uses.
 *
 * Exported ONLY so `NodeSizer.test.ts` can exercise that guard directly (it is
 * not re-exported from `src/engine/index.ts`); an untestable guard would rot.
 */
export class DepthDecayMetric implements SizeMetric {
	constructor(private readonly k: number) {}

	normalizedValues(nodes: ReadonlyMap<VaultPath, TraversedNode>): ReadonlyMap<VaultPath, number> {
		const normalized = new Map<VaultPath, number>();
		for (const [path, node] of nodes) {
			const decayed = 1 / (1 + this.k * node.minDepth);
			normalized.set(path, Number.isFinite(decayed) ? decayed : NEUTRAL_NORMALIZED_VALUE);
		}
		return normalized;
	}
}
