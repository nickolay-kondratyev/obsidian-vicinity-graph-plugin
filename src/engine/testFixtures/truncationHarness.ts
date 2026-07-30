import { EngineDefaults } from "../constants";
import type { FakeVaultSpec } from "../FakeLinkProvider";
import { FakeLinkProvider } from "../FakeLinkProvider";
import { GraphTruncator } from "../GraphTruncator";
import type { TruncationResult } from "../GraphTruncator";
import { VicinityTraversal } from "../VicinityTraversal";
import type { TraversalResult, TraversalRoot } from "../VicinityTraversal";
import { NodeSizer } from "../NodeSizer";
import type { NodeSize } from "../NodeSizer";
import type { DepthSettings, VaultPath } from "../types";
import { asVaultPath } from "../types";

/**
 * Shared traverse→size→truncate harness for engine cap tests. Extracted so the
 * hand-written truncator tests and the dense-fixture suite (step-07) share ONE
 * pipeline helper instead of duplicating it — and so runtime-cap tests can reuse
 * a single traversal across several caps (see {@link truncateAt}).
 */

const DEFAULT_TEST_DEPTH = 2;

/** The pre-truncation stages, so a caller can re-truncate one traversal at many caps. */
export interface TruncationStages {
	readonly traversal: TraversalResult;
	readonly sizes: ReadonlyMap<VaultPath, NodeSize>;
	readonly mainPath: VaultPath;
}

/** Traverse + size a fixture; MAIN is the first root. Later stages read from this. */
export function traverseAndSize(
	spec: FakeVaultSpec,
	rootPaths: readonly string[],
	depths: Partial<DepthSettings> = {},
): TruncationStages {
	const mainPath = rootPaths[0];
	if (mainPath === undefined) {
		throw new Error("traverseAndSize() needs at least one root");
	}
	const provider = new FakeLinkProvider(spec);
	const roots: TraversalRoot[] = rootPaths.map((path) => ({
		descriptor: { path: asVaultPath(path) },
		depths: {
			linkDepthOut: depths.linkDepthOut ?? DEFAULT_TEST_DEPTH,
			// Unstated embed budget mirrors the link budget (the shipped default relationship).
			embedDepthOut: depths.embedDepthOut ?? depths.linkDepthOut ?? DEFAULT_TEST_DEPTH,
			linkDepthIn: depths.linkDepthIn ?? DEFAULT_TEST_DEPTH,
		},
	}));
	const traversal = new VicinityTraversal(provider).traverse(roots);
	const sizes = new NodeSizer(provider).computeSizes(traversal.nodes, EngineDefaults.sizingSettings());
	return { traversal, sizes, mainPath: asVaultPath(mainPath) };
}

/** Truncate already-computed stages at `nodeCap` (reuses one traversal across caps). */
export function truncateAt(stages: TruncationStages, nodeCap: number): TruncationResult {
	return GraphTruncator.truncate({
		nodes: stages.traversal.nodes,
		sizes: stages.sizes,
		edges: stages.traversal.edges,
		mainPath: stages.mainPath,
		nodeCap,
	});
}

/** Traverse + size + truncate over a fixture; MAIN is the first root. */
export function build(
	spec: FakeVaultSpec,
	rootPaths: readonly string[],
	nodeCap: number,
	depths: Partial<DepthSettings> = {},
): TruncationResult {
	return truncateAt(traverseAndSize(spec, rootPaths, depths), nodeCap);
}

/** Visible paths as a sorted array, for stable assertions. */
export function visible(result: TruncationResult): string[] {
	return [...result.visiblePaths].sort();
}
