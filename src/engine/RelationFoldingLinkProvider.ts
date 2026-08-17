import type { FileMetadata, LinkProvider, OutgoingReference } from "./LinkProvider";
import { OutgoingReferences } from "./LinkProvider";
import type { RelationProvider } from "./RelationProvider";
import type { VaultPath } from "./types";

/**
 * THE rel-note folding choke point (feature `named-relationships`): a
 * {@link LinkProvider} decorator that subtracts each rel-note NAME occurrence
 * (`[[he supports]]` of a `[[he supports]]::[[x]]` statement) from the plain link
 * stream, PER OCCURRENCE (see {@link RelationProvider}).
 *
 * It wraps the base provider so BOTH traversal discovery
 * ({@link import("./VicinityTraversal").VicinityTraversal}, which reads
 * `getIncomingLinks`/`getOutgoingReferences`) AND edge assembly
 * ({@link import("./EdgeAssembly").EdgeAssembly}, which reads `getLinkCount`/
 * `getOutgoingReferences`) see the SAME folded truth — folding at edge assembly
 * alone would let the rel note be DISCOVERED as a node via the very occurrence being
 * folded, then stranded. All non-link facts (metadata, folder hierarchy) pass
 * straight through.
 *
 * The fold is kind-blind and total-count based, which is exactly correct: a rel-note
 * name occurrence IS a physical link occurrence counted by {@link getLinkCount}, so
 * `base >= folds` always, and `base === folds` means EVERY occurrence of that target
 * was a rel-note name — the target has no non-relationship usage from this source
 * and drops out of its streams entirely. Any remaining plain occurrence
 * (`base > folds`) keeps the target visible and counted, so a rel note that is also
 * plainly linked still renders as a normal node.
 */
export class RelationFoldingLinkProvider implements LinkProvider {
	/** source → (rel-note target → number of folded occurrences). Memoised per source. */
	private readonly foldsBySource = new Map<VaultPath, ReadonlyMap<VaultPath, number>>();

	constructor(
		private readonly base: LinkProvider,
		private readonly relations: RelationProvider,
	) {}

	getOutgoingReferences(path: VaultPath): readonly OutgoingReference[] {
		const references = this.base.getOutgoingReferences(path);
		if (this.foldsFor(path).size === 0) {
			return references;
		}
		return references.filter((reference) => !this.fullyFolded(path, reference.target));
	}

	getOutgoingLinks(path: VaultPath): readonly VaultPath[] {
		return OutgoingReferences.targetsOf(this.getOutgoingReferences(path));
	}

	getIncomingLinks(path: VaultPath): readonly VaultPath[] {
		return this.base.getIncomingLinks(path).filter((source) => !this.fullyFolded(source, path));
	}

	getChildNotes(path: VaultPath): readonly VaultPath[] {
		return this.base.getChildNotes(path);
	}

	getParentNote(path: VaultPath): VaultPath | undefined {
		return this.base.getParentNote(path);
	}

	getFileMetadata(path: VaultPath): FileMetadata | undefined {
		return this.base.getFileMetadata(path);
	}

	getLinkCount(source: VaultPath, target: VaultPath): number {
		const folded = this.foldsFor(source).get(target) ?? 0;
		return Math.max(0, this.base.getLinkCount(source, target) - folded);
	}

	/** True iff EVERY base occurrence of `source` → `target` was a folded rel-note name. */
	private fullyFolded(source: VaultPath, target: VaultPath): boolean {
		const folded = this.foldsFor(source).get(target) ?? 0;
		return folded > 0 && this.base.getLinkCount(source, target) - folded <= 0;
	}

	private foldsFor(source: VaultPath): ReadonlyMap<VaultPath, number> {
		const cached = this.foldsBySource.get(source);
		if (cached !== undefined) {
			return cached;
		}
		const counts = new Map<VaultPath, number>();
		for (const target of this.relations.relNoteFolds(source)) {
			counts.set(target, (counts.get(target) ?? 0) + 1);
		}
		this.foldsBySource.set(source, counts);
		return counts;
	}
}
