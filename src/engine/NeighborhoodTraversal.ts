import { VaultPathFacts } from "../shared/VaultPathFacts";
import { EdgeAccumulator } from "./EdgeAccumulator";
import type { LinkProvider } from "./LinkProvider";
import { NodeEligibility } from "./NodeEligibility";
import type {
	AttachmentRef,
	CentralNodeDescriptor,
	DepthSettings,
	DepthTag,
	DirectedLink,
	Direction,
	DocId,
	FolderPath,
	VaultPath,
} from "./types";

/** One traversal root with its (already resolved) per-root depth limits. */
export interface TraversalRoot {
	readonly descriptor: CentralNodeDescriptor;
	readonly depths: DepthSettings;
}

/** Traversal output node: everything except sizing (sizing is a later stage). */
export interface TraversedNode {
	readonly path: VaultPath;
	readonly docid?: DocId;
	readonly title: string;
	readonly folder: FolderPath;
	readonly sizeBytes: number;
	/** True iff this node is one of the traversal roots. */
	readonly isCentral: boolean;
	readonly depthTags: readonly DepthTag[];
	readonly minDepth: number;
	readonly attachments: readonly AttachmentRef[];
	readonly firstImagePath?: VaultPath;
}

export interface TraversalResult {
	readonly nodes: ReadonlyMap<VaultPath, TraversedNode>;
	/** Walked (source, target) pairs — count-free; multiplicity is attached by EdgeVisibility. */
	readonly edges: readonly DirectedLink[];
}

const DIRECTIONS: readonly Direction[] = ["outgoing", "incoming"];

/**
 * Multi-root directional BFS (step-02 CLARIFICATION Q3): each root × direction
 * runs an independent BFS with its own depth limit; results are unioned and
 * deduped by path. Within one BFS a visited map guarantees a node is expanded
 * at most once (BFS visits in nondecreasing depth, so the first visit is the
 * shallowest). Re-traversal ACROSS roots is expected and fine (small scale).
 *
 * Non-node-bearing files never become nodes; they surface as attachments via
 * `FileMetadata.attachments` on each linking node (first image identified).
 */
export class NeighborhoodTraversal {
	private readonly eligibility: NodeEligibility;

	constructor(private readonly provider: LinkProvider) {
		this.eligibility = new NodeEligibility(provider);
	}

	traverse(roots: readonly TraversalRoot[]): TraversalResult {
		const collector = new TraversalCollector();
		for (const root of dedupeRootsByPath(roots)) {
			// Roots that are unknown or non-node-bearing are skipped gracefully:
			// a build request may momentarily reference a deleted/renamed file.
			if (!this.eligibility.isNodeBearing(root.descriptor.path)) {
				continue;
			}
			for (const direction of DIRECTIONS) {
				this.bfs(root, direction, collector);
			}
		}
		return this.assemble(roots, collector);
	}

	private bfs(root: TraversalRoot, direction: Direction, collector: TraversalCollector): void {
		const rootPath = root.descriptor.path;
		const depthLimit = direction === "outgoing" ? root.depths.outgoingDepth : root.depths.incomingDepth;
		const visited = new Map<VaultPath, number>([[rootPath, 0]]);
		const queue: VaultPath[] = [rootPath];
		collector.recordDepthTag(rootPath, { rootPath, direction, depth: 0 });
		for (let head = 0; head < queue.length; head++) {
			const current = queue[head];
			if (current === undefined) {
				continue; // Unreachable: head < queue.length. Satisfies noUncheckedIndexedAccess.
			}
			const currentDepth = visited.get(current) ?? 0;
			if (currentDepth >= depthLimit) {
				continue; // Depth budget exhausted — do not expand further.
			}
			for (const neighbor of this.neighborsOf(current, direction)) {
				if (!this.eligibility.isNodeBearing(neighbor)) {
					continue; // Attachment, not a node; surfaced via FileMetadata.attachments.
				}
				collector.recordEdge(current, neighbor, direction);
				if (visited.has(neighbor)) {
					continue; // Already seen at ≤ this depth — never re-expand (Q3).
				}
				visited.set(neighbor, currentDepth + 1);
				collector.recordDepthTag(neighbor, { rootPath, direction, depth: currentDepth + 1 });
				queue.push(neighbor);
			}
		}
	}

	private neighborsOf(path: VaultPath, direction: Direction): readonly VaultPath[] {
		return direction === "outgoing"
			? this.provider.getOutgoingLinks(path)
			: this.provider.getIncomingLinks(path);
	}

	private assemble(roots: readonly TraversalRoot[], collector: TraversalCollector): TraversalResult {
		const docidByPath = new Map<VaultPath, DocId>();
		const rootPaths = new Set<VaultPath>();
		for (const root of roots) {
			rootPaths.add(root.descriptor.path);
			if (root.descriptor.docid !== undefined) {
				docidByPath.set(root.descriptor.path, root.descriptor.docid);
			}
		}
		const nodes = new Map<VaultPath, TraversedNode>();
		for (const [path, depthTags] of collector.depthTagsByPath()) {
			const metadata = this.provider.getFileMetadata(path);
			if (metadata === undefined) {
				continue; // Unreachable: only node-bearing (⇒ known) paths are collected.
			}
			const firstImage = metadata.attachments.find((attachment) => attachment.isImage);
			nodes.set(path, {
				path,
				docid: docidByPath.get(path),
				title: VaultPathFacts.titleOf(path),
				folder: metadata.folder,
				sizeBytes: metadata.sizeBytes,
				isCentral: rootPaths.has(path),
				depthTags,
				minDepth: Math.min(...depthTags.map((tag) => tag.depth)),
				attachments: metadata.attachments,
				firstImagePath: firstImage?.path,
			});
		}
		return { nodes, edges: collector.edges() };
	}
}

/** MAIN-first: when MAIN is also pinned, the first (MAIN) descriptor wins the dedupe. */
function dedupeRootsByPath(roots: readonly TraversalRoot[]): readonly TraversalRoot[] {
	const seen = new Set<VaultPath>();
	const deduped: TraversalRoot[] = [];
	for (const root of roots) {
		if (!seen.has(root.descriptor.path)) {
			seen.add(root.descriptor.path);
			deduped.push(root);
		}
	}
	return deduped;
}

/** Accumulates depth tags and deduped edges across all per-root BFS runs. */
class TraversalCollector {
	private readonly tags = new Map<VaultPath, DepthTag[]>();
	private readonly edgeAccumulator = new EdgeAccumulator();

	recordDepthTag(path: VaultPath, tag: DepthTag): void {
		const tagsForPath = this.tags.get(path) ?? [];
		tagsForPath.push(tag);
		this.tags.set(path, tagsForPath);
	}

	/** Direction "incoming" means `neighbor` links to `current` — edges always point linker → linked. */
	recordEdge(current: VaultPath, neighbor: VaultPath, direction: Direction): void {
		const source = direction === "outgoing" ? current : neighbor;
		const target = direction === "outgoing" ? neighbor : current;
		this.edgeAccumulator.add(source, target);
	}

	depthTagsByPath(): ReadonlyMap<VaultPath, readonly DepthTag[]> {
		return this.tags;
	}

	edges(): readonly DirectedLink[] {
		return this.edgeAccumulator.edges();
	}
}
