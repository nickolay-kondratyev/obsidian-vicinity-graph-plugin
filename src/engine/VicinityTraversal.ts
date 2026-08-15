import type { LinkKind } from "../shared/LinkKind";
import { VaultPathFacts } from "../shared/VaultPathFacts";
import { EdgeAccumulator } from "./EdgeAccumulator";
import type { LinkProvider } from "./LinkProvider";
import { OutgoingReferences } from "./LinkProvider";
import { NodeEligibility } from "./NodeEligibility";
import { PathExclusionMatcher } from "./PathExclusionMatcher";
import type {
	AttachmentRef,
	CentralNodeDescriptor,
	Channel,
	ChannelDepths,
	DepthTag,
	DirectedLink,
	DocId,
	FolderPath,
	OutlineEntry,
	VaultPath,
} from "./types";
import { CHANNEL_DEPTH_FIELD, CHANNEL_RELATION, CHANNELS, directedLinkKey } from "./types";

/** One traversal root with its (already resolved) per-root depth limits. */
export interface TraversalRoot {
	readonly descriptor: CentralNodeDescriptor;
	readonly depths: ChannelDepths;
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
	/** Provider-owned heading outline (empty when this note offers none). */
	readonly outline: readonly OutlineEntry[];
	readonly firstImagePath?: VaultPath;
	/** Provider-owned document-position fact (see `FileMetadata.imagePrecedesOutline`). */
	readonly imagePrecedesOutline: boolean;
}

export interface TraversalResult {
	readonly nodes: ReadonlyMap<VaultPath, TraversedNode>;
	/** Walked (source, target) pairs — count-free; multiplicity and kind are attached by EdgeAssembly. */
	readonly edges: readonly DirectedLink[];
	/**
	 * {@link directedLinkKey}s of the pairs that carry the folder-note HIERARCHY
	 * relation (a subset of {@link edges}). EdgeAssembly reads this to mark an edge
	 * `hierarchy`; a pair keyed here with NO link occurrences is a PURE hierarchy edge.
	 */
	readonly hierarchyPairKeys: ReadonlySet<string>;
	/**
	 * {@link directedLinkKey}s of the pairs walked over a LINK channel (a subset of
	 * {@link edges}). EdgeAssembly reads this to decide a pair carries a LINK
	 * relation — a pair keyed ONLY in {@link hierarchyPairKeys} is a pure hierarchy
	 * edge even when the two notes independently link (that link was not walked).
	 */
	readonly linkPairKeys: ReadonlySet<string>;
	/**
	 * Distinct non-root NODE-BEARING neighbor paths rejected by global exclusion
	 * during traversal. Excluded attachments are not counted — they were never
	 * node candidates (and still render via `FileMetadata.attachments`).
	 */
	readonly excludedNodeCount: number;
}

/**
 * Which endpoint of a walked hop is the LINKER, per channel — edges always point
 * linker → linked, whichever channel discovered them.
 *
 * A table rather than a `channel !== "incoming"` test so a future incoming-side
 * channel is a COMPILE ERROR here instead of a silently back-to-front edge.
 */
const CHANNEL_LINKER: Readonly<Record<Channel, "current" | "neighbor">> = {
	"outgoing-link": "current",
	"outgoing-embed": "current",
	incoming: "neighbor",
	// Hierarchy edges ALWAYS point parent → child (owner decision, both channels
	// agree on orientation): descendants walk parent→child, so the parent is the
	// current node; ancestors walk child→parent, so the parent is the neighbor.
	descendants: "current",
	ancestors: "neighbor",
};

/**
 * Multi-root channel BFS (step-02 CLARIFICATION Q3): each root × channel
 * runs an independent BFS with its own depth limit; results are unioned and
 * deduped by path. Within one BFS a visited map guarantees a node is expanded
 * at most once (BFS visits in nondecreasing depth, so the first visit is the
 * shallowest). Re-traversal ACROSS roots is expected and fine (small scale).
 *
 * Non-node-bearing files never become nodes; they surface as attachments via
 * `FileMetadata.attachments` on each linking node (first image identified).
 */
export class VicinityTraversal {
	private readonly eligibility: NodeEligibility;

	constructor(
		private readonly provider: LinkProvider,
		/** Global neighbor exclusion; defaults to a no-op matcher (nothing excluded). */
		private readonly exclusion: PathExclusionMatcher = PathExclusionMatcher.fromPatterns([]),
	) {
		this.eligibility = new NodeEligibility(provider);
	}

	traverse(roots: readonly TraversalRoot[]): TraversalResult {
		const collector = new TraversalCollector();
		// Roots are EXEMPT from exclusion (binding: exclusion applies only to
		// discovered neighbors) — computed once so bfs can wave a matching root past
		// the neighbor gate even when another root links to it.
		const rootPaths = new Set(roots.map((root) => root.descriptor.path));
		for (const root of dedupeRootsByPath(roots)) {
			// Roots that are unknown or non-node-bearing are skipped gracefully:
			// a build request may momentarily reference a deleted/renamed file.
			if (!this.eligibility.isNodeBearing(root.descriptor.path)) {
				continue;
			}
			for (const channel of CHANNELS) {
				this.bfs(root, channel, rootPaths, collector);
			}
		}
		return this.assemble(roots, collector);
	}

	private bfs(
		root: TraversalRoot,
		channel: Channel,
		rootPaths: ReadonlySet<VaultPath>,
		collector: TraversalCollector,
	): void {
		const rootPath = root.descriptor.path;
		const depthLimit = root.depths[CHANNEL_DEPTH_FIELD[channel]];
		const visited = new Map<VaultPath, number>([[rootPath, 0]]);
		const queue: VaultPath[] = [rootPath];
		collector.recordDepthTag(rootPath, { rootPath, channel, depth: 0 });
		for (let head = 0; head < queue.length; head++) {
			const current = queue[head];
			if (current === undefined) {
				continue; // Unreachable: head < queue.length. Satisfies noUncheckedIndexedAccess.
			}
			const currentDepth = visited.get(current) ?? 0;
			if (currentDepth >= depthLimit) {
				continue; // Depth budget exhausted — do not expand further.
			}
			for (const neighbor of this.neighborsOf(current, channel)) {
				// Exclusion FIRST (before the isNodeBearing metadata read): an excluded
				// neighbor is never enqueued, never expanded through, and never fetches
				// metadata — the performance win. Roots are exempt (checked above).
				if (!rootPaths.has(neighbor) && this.exclusion.excludes(neighbor)) {
					collector.recordExcluded(neighbor);
					continue;
				}
				if (!this.eligibility.isNodeBearing(neighbor)) {
					continue; // Attachment, not a node; surfaced via FileMetadata.attachments.
				}
				collector.recordEdge(current, neighbor, channel);
				if (visited.has(neighbor)) {
					continue; // Already seen at ≤ this depth — never re-expand (Q3).
				}
				visited.set(neighbor, currentDepth + 1);
				collector.recordDepthTag(neighbor, { rootPath, channel, depth: currentDepth + 1 });
				queue.push(neighbor);
			}
		}
	}

	/**
	 * KIND-PURE (owner decision D1 / research 6a): each outgoing channel sees only
	 * its own kind of reference, so the two outgoing BFS runs are independent walks
	 * that get unioned — exactly the architecture the outgoing/incoming split
	 * already used. Incoming stays kind-blind by scope decision.
	 */
	private neighborsOf(path: VaultPath, channel: Channel): readonly VaultPath[] {
		switch (channel) {
			case "outgoing-link":
				return this.outgoingTargetsOfKind(path, "link");
			case "outgoing-embed":
				return this.outgoingTargetsOfKind(path, "embed");
			case "incoming":
				return this.provider.getIncomingLinks(path);
			case "descendants":
				return this.provider.getChildNotes(path);
			case "ancestors": {
				const parent = this.provider.getParentNote(path);
				return parent === undefined ? [] : [parent];
			}
		}
	}

	private outgoingTargetsOfKind(path: VaultPath, kind: LinkKind): readonly VaultPath[] {
		return OutgoingReferences.targetsOfKind(this.provider.getOutgoingReferences(path), kind);
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
				// Step-05 human decision: frontmatter title/name wins over basename.
				title: metadata.frontmatterTitle ?? VaultPathFacts.titleOf(path),
				folder: metadata.folder,
				sizeBytes: metadata.sizeBytes,
				isCentral: rootPaths.has(path),
				depthTags,
				minDepth: Math.min(...depthTags.map((tag) => tag.depth)),
				attachments: metadata.attachments,
				outline: metadata.outline,
				firstImagePath: firstImage?.path,
				imagePrecedesOutline: metadata.imagePrecedesOutline,
			});
		}
		return {
			nodes,
			edges: collector.edges(),
			hierarchyPairKeys: collector.hierarchyPairKeys(),
			linkPairKeys: collector.linkPairKeys(),
			// Counted LAZILY here (one metadata read per distinct excluded path) so an
			// excluded ATTACHMENT — never a node candidate — does not inflate the
			// toolbar's "N node(s) excluded" badge, while the BFS hot path keeps
			// skipping the metadata read for excluded neighbors.
			excludedNodeCount: collector
				.excludedPaths()
				.filter((path) => this.eligibility.isNodeBearing(path)).length,
		};
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
	/** {@link directedLinkKey}s of pairs walked over a HIERARCHY channel (carry the folder relation). */
	private readonly hierarchyPairs = new Set<string>();
	/**
	 * {@link directedLinkKey}s of pairs walked over a LINK channel (carry a link
	 * occurrence). Tracked SEPARATELY from {@link hierarchyPairs} so EdgeAssembly can
	 * tell a merged edge (walked BOTH) from a pure hierarchy edge (walked only as
	 * hierarchy, even when the parent independently links the child — that link is
	 * NOT walked at descendantDepth with the link dial off, so it is not a relation).
	 */
	private readonly linkPairs = new Set<string>();
	/** Distinct neighbor paths rejected by exclusion (deduped across roots/directions). */
	private readonly excluded = new Set<VaultPath>();

	recordDepthTag(path: VaultPath, tag: DepthTag): void {
		const tagsForPath = this.tags.get(path) ?? [];
		tagsForPath.push(tag);
		this.tags.set(path, tagsForPath);
	}

	/**
	 * Normalises a walked hop into source → target (see {@link CHANNEL_LINKER}) — for
	 * a link channel the source is the linker, for a hierarchy channel it is the
	 * parent. A hierarchy hop ALSO records the ordered pair as carrying the folder
	 * relation, so EdgeAssembly can mark (or merge) it.
	 */
	recordEdge(current: VaultPath, neighbor: VaultPath, channel: Channel): void {
		const currentIsSource = CHANNEL_LINKER[channel] === "current";
		const source = currentIsSource ? current : neighbor;
		const target = currentIsSource ? neighbor : current;
		this.edgeAccumulator.add(source, target);
		const key = directedLinkKey(source, target);
		if (CHANNEL_RELATION[channel] === "hierarchy") {
			this.hierarchyPairs.add(key);
		} else {
			this.linkPairs.add(key);
		}
	}

	/** Records a distinct excluded neighbor path (deduped; feeds excludedNodeCount). */
	recordExcluded(path: VaultPath): void {
		this.excluded.add(path);
	}

	depthTagsByPath(): ReadonlyMap<VaultPath, readonly DepthTag[]> {
		return this.tags;
	}

	edges(): readonly DirectedLink[] {
		return this.edgeAccumulator.edges();
	}

	hierarchyPairKeys(): ReadonlySet<string> {
		return this.hierarchyPairs;
	}

	linkPairKeys(): ReadonlySet<string> {
		return this.linkPairs;
	}

	/** Distinct excluded paths, attachments included — the caller filters to node-bearing. */
	excludedPaths(): readonly VaultPath[] {
		return [...this.excluded];
	}
}
