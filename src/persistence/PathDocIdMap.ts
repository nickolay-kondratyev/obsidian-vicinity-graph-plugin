/**
 * In-memory bidirectional path↔docid map. Persistence is docid-keyed, but
 * vault events (`delete`) and pin resolution speak paths — this map bridges
 * them without disk reads. Filled by `DocIdMapWarmer` — on demand for the docids
 * a build needs, and in full by the delayed sweep — plus lazily on visit, and
 * kept fresh by `vault.on('rename'|'delete')` (see main.ts wiring).
 */
export class PathDocIdMap {
	private readonly docidByPath = new Map<string, string>();
	private readonly pathByDocid = new Map<string, string>();
	// Docids live in user-visible frontmatter, so "Make a copy" / templates /
	// sync can put the SAME docid at two live paths. The map cannot tell that
	// apart from a missed rename, so it only remembers the ambiguity (sticky for
	// the session) and lets handleDelete withhold the cleanup key — the orphan
	// sweep's full-scan re-derivation is the one place with enough evidence.
	private readonly docidsSeenAtMultiplePaths = new Set<string>();

	set(path: string, docid: string): void {
		const previousPath = this.pathByDocid.get(docid);
		if (previousPath !== undefined && previousPath !== path) {
			this.docidsSeenAtMultiplePaths.add(docid);
		}
		// Drop stale pairings first: the docid may have moved to a new path
		// (rename missed) or the path may now hold a different doc.
		this.deleteByPath(path);
		this.deleteByDocid(docid);
		this.docidByPath.set(path, docid);
		this.pathByDocid.set(docid, path);
	}

	getDocId(path: string): string | undefined {
		return this.docidByPath.get(path);
	}

	getPath(docid: string): string | undefined {
		return this.pathByDocid.get(docid);
	}

	/** Docids make renames a persistence non-event; only this map needs the move. */
	handleRename(oldPath: string, newPath: string): void {
		const docid = this.docidByPath.get(oldPath);
		if (docid !== undefined) {
			// Unmap the old path FIRST so set() sees one live path, not two — a
			// rename is the one two-path sighting that is provably NOT a duplicate.
			this.deleteByPath(oldPath);
			this.set(newPath, docid);
		}
	}

	/**
	 * Returns the deleted doc's docid (the live-cleanup key), if it was mapped —
	 * UNLESS the docid was ever seen at a second live path this session: a
	 * surviving frontmatter twin may still carry it, and live cleanup DELETES
	 * persisted state, so the ambiguous case is left to the orphan sweep.
	 */
	handleDelete(path: string): string | undefined {
		const docid = this.docidByPath.get(path);
		this.deleteByPath(path);
		if (docid !== undefined && this.docidsSeenAtMultiplePaths.has(docid)) {
			return undefined;
		}
		return docid;
	}

	private deleteByPath(path: string): void {
		const docid = this.docidByPath.get(path);
		if (docid !== undefined) {
			this.docidByPath.delete(path);
			this.pathByDocid.delete(docid);
		}
	}

	private deleteByDocid(docid: string): void {
		const path = this.pathByDocid.get(docid);
		if (path !== undefined) {
			this.pathByDocid.delete(docid);
			this.docidByPath.delete(path);
		}
	}
}
