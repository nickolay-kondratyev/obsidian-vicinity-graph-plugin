/**
 * Pure "Untitled" child-note naming, mirroring Obsidian core's own new-note
 * convention: `Untitled`, then `Untitled 1`, `Untitled 2`, … — the first name
 * whose `.md` path is free. Shared and pure (no `obsidian`/react), so the
 * dedupe is BDD-tested with a fake existence predicate; the adapter passes a
 * live vault read at click time (never the rendered graph snapshot).
 */
export class ChildNoteNaming {
	/** Obsidian's default new-note base name. */
	private static readonly BASE = "Untitled";
	private static readonly EXTENSION = "md";

	/**
	 * The first free `<folder>/Untitled[ N].md` path — `Untitled.md` when it is free,
	 * else `Untitled 1.md`, `Untitled 2.md`, … as `exists` reports each taken. `folder`
	 * is a folder path with no trailing slash (never the vault root — a folder note
	 * always owns a named folder).
	 */
	static untitledChildPath(folder: string, exists: (path: string) => boolean): string {
		for (let suffix = 0; ; suffix += 1) {
			// suffix 0 is the bare base ("Untitled"); 1+ append " N" ("Untitled 1").
			const name = suffix === 0 ? ChildNoteNaming.BASE : `${ChildNoteNaming.BASE} ${suffix}`;
			const path = `${folder}/${name}.${ChildNoteNaming.EXTENSION}`;
			if (!exists(path)) {
				return path;
			}
		}
	}
}
