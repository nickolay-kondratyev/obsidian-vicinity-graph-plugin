/**
 * In-memory bidirectional path↔docid map. Persistence is docid-keyed, but
 * vault events (`delete`) and pin resolution speak paths — this map bridges
 * them without disk reads. Warmed by the delayed sweep, lazily filled on
 * visit, kept fresh by `vault.on('rename'|'delete')` (see main.ts wiring).
 */
export class PathDocIdMap {
	private readonly docidByPath = new Map<string, string>();
	private readonly pathByDocid = new Map<string, string>();

	set(path: string, docid: string): void {
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
			this.set(newPath, docid);
		}
	}

	/** Returns the deleted doc's docid (the live-cleanup key), if it was mapped. */
	handleDelete(path: string): string | undefined {
		const docid = this.docidByPath.get(path);
		this.deleteByPath(path);
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
