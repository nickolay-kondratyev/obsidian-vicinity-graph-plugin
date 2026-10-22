import type { GraphEdge, VaultPath } from "../engine";
import { FileKinds } from "../shared/FileKinds";
import { NamedLinks } from "../shared/NamedLinks";
import type { MetadataCachePort, VaultPort } from "./obsidianPorts";
import { ReferenceOrder } from "./ReferenceOrder";

/**
 * Post-engine pass attaching {@link GraphEdge.relation} — the `name::[[target]]`
 * named-link label (ticket `nid_wu4gfieqps2uw9l8f4wab1abq_e`). It lives here, not
 * in the engine, because the relation needs the source note's TEXT, and the
 * synchronous `LinkProvider` seam has none; it reads only the sources of the
 * edges the build kept, so the work is bounded by the visible graph (node cap),
 * never by the vault.
 *
 * Rules (ticket Assumptions): plain BODY wikilinks only — `ReferenceOrder` tags
 * each reference by array provenance, so embeds (`kind: "embed"`) and frontmatter
 * links (negative sentinel offset, no body position) are dropped; the FIRST
 * labelled link per resolved target wins, in document order, and unlabelled links
 * never suppress a later label. Non-markdown sources (canvas) carry no body text
 * and are skipped.
 */
/** Body offsets are >= 0; `ReferenceOrder` parks frontmatter links below this at a negative sentinel. */
const FIRST_BODY_OFFSET = 0;

export class EdgeRelationLabeler {
	constructor(
		private readonly vault: VaultPort,
		private readonly metadataCache: MetadataCachePort,
	) {}

	/** The same edges, with `relation` set on each pair whose source names it; untouched edges are returned as-is. */
	async label(edges: readonly GraphEdge[]): Promise<readonly GraphEdge[]> {
		const sources = new Set(edges.filter((edge) => edge.count >= 1).map((edge) => edge.source));
		const relationsBySource = new Map(
			await Promise.all(
				[...sources].map(async (source) => [source, await this.relationsFrom(source)] as const),
			),
		);
		return edges.map((edge) => {
			// A pure-hierarchy edge (count 0) is not a link, so no text names it — even
			// when a sibling link edge from the same source was read.
			const relation = edge.count >= 1 ? relationsBySource.get(edge.source)?.get(edge.target) : undefined;
			return relation === undefined ? edge : { ...edge, relation };
		});
	}

	/** target path → relation of the first labelled plain link from `source` to it. */
	private async relationsFrom(source: VaultPath): Promise<ReadonlyMap<string, string>> {
		const relations = new Map<string, string>();
		if (!FileKinds.isMarkdownPath(source)) {
			return relations;
		}
		const file = this.vault.getFileByPath(source);
		const cache = file === null ? null : this.metadataCache.getFileCache(file);
		if (file === null || cache === null) {
			return relations;
		}
		const bodyLinks = ReferenceOrder.orderedReferences(cache).filter(
			(reference) => reference.kind === "link" && reference.offset >= FIRST_BODY_OFFSET,
		);
		if (bodyLinks.length === 0) {
			return relations;
		}
		const text = await this.vault.cachedRead(file);
		for (const link of bodyLinks) {
			const relation = NamedLinks.relationAt(text, link.offset);
			if (relation === undefined) {
				continue;
			}
			const target = this.metadataCache.getFirstLinkpathDest(link.link, source)?.path;
			if (target !== undefined && !relations.has(target)) {
				relations.set(target, relation);
			}
		}
		return relations;
	}
}
