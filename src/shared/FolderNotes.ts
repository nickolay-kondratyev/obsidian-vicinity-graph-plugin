import { FileKinds } from "./FileKinds";
import { VaultPathFacts } from "./VaultPathFacts";

/**
 * THE folder-note convention, resolved from vault PATHS alone (the 'Folder Notes'
 * plugin convention). Pure and shared: the engine reaches it through the
 * {@link import("../engine/LinkProvider").LinkProvider} seam (via the adapter's
 * index and `FakeLinkProvider`), so this module — like the rest of `src/shared/`
 * — never touches obsidian/react (import-guarded).
 *
 * ## The rule (owner-locked, plan `nid_ri1d36t7hmhu0kr652wny1dmz_e`)
 * A folder `X` has AT MOST ONE folder note. Candidates, in DESCENDING precedence:
 *   1. `X/<name>.md`      (INSIDE the folder)
 *   2. `X/<name>.canvas`  (inside)
 *   3. `<name>.md`        (SIBLING of the folder)
 *   4. `<name>.canvas`    (sibling)
 * where `<name>` is the folder's own last segment. LOCATION dominates EXTENSION:
 * an inside note wins over any sibling, and `.md` breaks the tie only WITHIN a
 * location ("inside `X/X.md` beats sibling `X.md`; `.md` beats `.canvas`"). Only
 * `.md` + `.canvas` participate — no `.base` in v1.
 *
 * ## The relation
 * - CHILDREN of a folder note = the node-bearing files sitting DIRECTLY in the
 *   folder it owns, minus the folder note itself ("the folder note is never its
 *   own child"), PLUS, for each DIRECT subfolder of that owned folder, that
 *   subfolder's winning folder note WHEN it is inside-style (it lives one level
 *   deeper, so it is not already a direct file). One hop = one folder level: a
 *   sibling-style subfolder note is already a direct file; an inside-style one is
 *   bridged UP to level 1 so descendants stay SYMMETRIC with the parent walk (a
 *   folder with no folder note is still not bridged — no synthetic folder nodes).
 * - The PARENT of a note walks up ONE folder-note per hop: the folder note of the
 *   note's containing folder, or — when the note IS that folder note (inside
 *   style) — the folder note of the parent folder. The first folder-note gap
 *   stops the walk.
 */
export class FolderNotes {
	/** Every vault path, for candidate-existence checks. */
	private readonly allPaths: ReadonlySet<string>;
	/** Node-bearing files grouped by their containing folder, in input order (deterministic children). */
	private readonly nodeBearingFilesByFolder: ReadonlyMap<string, readonly string[]>;
	/**
	 * DIRECT subfolders of each folder, derived from the folders that (transitively)
	 * hold node-bearing files — the only folders whose folder notes can matter.
	 */
	private readonly directSubfoldersByFolder: ReadonlyMap<string, readonly string[]>;
	/** Memoised folder-note resolution — one answer per folder across a build. */
	private readonly folderNoteByFolder = new Map<string, string | undefined>();

	private constructor(
		allPaths: ReadonlySet<string>,
		nodeBearingFilesByFolder: ReadonlyMap<string, readonly string[]>,
		directSubfoldersByFolder: ReadonlyMap<string, readonly string[]>,
	) {
		this.allPaths = allPaths;
		this.nodeBearingFilesByFolder = nodeBearingFilesByFolder;
		this.directSubfoldersByFolder = directSubfoldersByFolder;
	}

	static fromPaths(paths: Iterable<string>): FolderNotes {
		const allPaths = new Set<string>();
		const filesByFolder = new Map<string, string[]>();
		for (const path of paths) {
			allPaths.add(path);
			if (FileKinds.isNodeBearingPath(path)) {
				const folder = VaultPathFacts.folderOf(path);
				const files = filesByFolder.get(folder) ?? [];
				files.push(path);
				filesByFolder.set(folder, files);
			}
		}
		return new FolderNotes(allPaths, filesByFolder, deriveDirectSubfolders(filesByFolder.keys()));
	}

	/** The winning folder note of `folder`, or `undefined` when none of the candidates exist. */
	folderNoteOf(folder: string): string | undefined {
		const cached = this.folderNoteByFolder.get(folder);
		if (cached !== undefined || this.folderNoteByFolder.has(folder)) {
			return cached;
		}
		const resolved = this.resolveFolderNote(folder);
		this.folderNoteByFolder.set(folder, resolved);
		return resolved;
	}

	/**
	 * Node-bearing files directly inside the folder(s) `notePath` is the folder note
	 * of, minus `notePath` itself. Empty when `notePath` owns no folder (an ordinary
	 * note, or a losing sibling when an inside note took the folder).
	 */
	childNotesOf(notePath: string): readonly string[] {
		if (!FileKinds.isNodeBearingPath(notePath)) {
			return [];
		}
		const children: string[] = [];
		const seen = new Set<string>();
		const addChild = (file: string): void => {
			if (file !== notePath && !seen.has(file)) {
				seen.add(file);
				children.push(file);
			}
		};
		for (const ownedFolder of this.foldersOwnedBy(notePath)) {
			for (const file of this.nodeBearingFilesByFolder.get(ownedFolder) ?? []) {
				addChild(file);
			}
			// Bridge each DIRECT subfolder's INSIDE-style folder note up to level 1 (a
			// sibling-style one is already a direct file above). This keeps descendants
			// symmetric with parentNoteOf's inside-style ancestor hop.
			for (const subfolder of this.directSubfoldersByFolder.get(ownedFolder) ?? []) {
				const subfolderNote = this.folderNoteOf(subfolder);
				if (subfolderNote !== undefined && VaultPathFacts.folderOf(subfolderNote) === subfolder) {
					addChild(subfolderNote);
				}
			}
		}
		return children;
	}

	/** The folder note one hop UP from `notePath`, or `undefined` at the first folder-note gap. */
	parentNoteOf(notePath: string): string | undefined {
		const folder = VaultPathFacts.folderOf(notePath);
		const containingFolderNote = this.folderNoteOf(folder);
		if (containingFolderNote !== undefined && containingFolderNote !== notePath) {
			// `notePath` is a plain member of `folder` — its parent is that folder's note.
			return containingFolderNote;
		}
		if (containingFolderNote === notePath) {
			// `notePath` IS the (inside-style) folder note of `folder` — walk to the
			// folder note of the PARENT folder, so an inside-style chain has ancestors.
			return this.folderNoteOf(VaultPathFacts.folderOf(folder));
		}
		return undefined; // `folder` has no folder note: the walk stops here (a gap).
	}

	/** The folder(s) `notePath` is the winning folder note of (usually one; a note sits in one folder). */
	private foldersOwnedBy(notePath: string): readonly string[] {
		const name = VaultPathFacts.titleOf(notePath);
		const containingFolder = VaultPathFacts.folderOf(notePath);
		const insideOwned = containingFolder; // `X/<name>.md` owns folder `X`.
		const siblingOwned = joinFolder(containingFolder, name); // `<name>.md` owns folder `<name>`.
		const owned: string[] = [];
		for (const folder of new Set([insideOwned, siblingOwned])) {
			if (this.folderNoteOf(folder) === notePath) {
				owned.push(folder);
			}
		}
		return owned;
	}

	private resolveFolderNote(folder: string): string | undefined {
		if (folder === "") {
			return undefined; // The vault root owns no folder note (there is no `<root>.md`).
		}
		const name = VaultPathFacts.folderNameOf(folder);
		const parent = VaultPathFacts.folderOf(folder);
		// Precedence: inside beats sibling; within a location, `.md` beats `.canvas`.
		const candidates = [
			`${folder}/${name}.md`,
			`${folder}/${name}.canvas`,
			`${joinFolder(parent, name)}.md`,
			`${joinFolder(parent, name)}.canvas`,
		];
		return candidates.find((candidate) => this.allPaths.has(candidate));
	}
}

/**
 * Direct parent→child folder edges, derived from the folders that directly hold
 * node-bearing files by walking each up to the root. Only folders that
 * transitively contain node-bearing files can carry a folder note that matters,
 * so those keys are a sufficient basis; each parent lists each child once.
 */
function deriveDirectSubfolders(fileFolders: Iterable<string>): Map<string, string[]> {
	const byFolder = new Map<string, string[]>();
	const recorded = new Set<string>();
	for (const folder of fileFolders) {
		let current = folder;
		while (current !== "") {
			const parent = VaultPathFacts.folderOf(current);
			const edge = `${parent}\n${current}`;
			if (!recorded.has(edge)) {
				recorded.add(edge);
				const children = byFolder.get(parent) ?? [];
				children.push(current);
				byFolder.set(parent, children);
			}
			current = parent;
		}
	}
	return byFolder;
}

/** Vault-path folder join: the root ("") prefixes nothing. */
function joinFolder(parent: string, name: string): string {
	return parent === "" ? name : `${parent}/${name}`;
}
