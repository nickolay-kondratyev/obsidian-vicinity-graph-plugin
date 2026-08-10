import type { VaultFsPort } from "./vaultFsPort";

/**
 * In-memory {@link VaultFsPort} for tests: a flat `path → contents` map with the
 * SAME semantics as the real adapter (`list` returns immediate children, `read`
 * rejects on absent, `rename` MOVES the key). Directories are implicit — a path
 * exists when it is the parent of some stored file — so `mkdir` only records
 * explicitly-created (possibly empty) folders.
 *
 * The workhorse for {@link VaultFileStore} unit tests, including simulating a
 * merge-conflicted file (`write(path, "<<<<<<< …")`) and asserting quarantine.
 */
export class FakeVaultFsPort implements VaultFsPort {
	/** path → file contents. */
	readonly files = new Map<string, string>();
	/** Explicitly `mkdir`'d folders (so an EMPTY dir still lists/exists). */
	private readonly folders = new Set<string>();

	async exists(path: string): Promise<boolean> {
		return this.files.has(path) || this.folders.has(path) || this.hasChildren(path);
	}

	async read(path: string): Promise<string> {
		const contents = this.files.get(path);
		if (contents === undefined) {
			throw new Error(`FakeVaultFsPort: no file at ${path}`);
		}
		return contents;
	}

	async write(path: string, contents: string): Promise<void> {
		this.files.set(path, contents);
	}

	async remove(path: string): Promise<void> {
		if (!this.files.delete(path)) {
			throw new Error(`FakeVaultFsPort: no file to remove at ${path}`);
		}
	}

	async rename(oldPath: string, newPath: string): Promise<void> {
		const contents = this.files.get(oldPath);
		if (contents === undefined) {
			throw new Error(`FakeVaultFsPort: no file to rename at ${oldPath}`);
		}
		this.files.delete(oldPath);
		this.files.set(newPath, contents);
	}

	async mkdir(path: string): Promise<void> {
		this.folders.add(path);
	}

	async list(dirPath: string): Promise<{ files: string[]; folders: string[] }> {
		const prefix = `${dirPath}/`;
		const files: string[] = [];
		const folders = new Set<string>();
		for (const path of this.files.keys()) {
			this.collectChild(path, prefix, files, folders);
		}
		for (const folder of this.folders) {
			this.collectChild(folder, prefix, [], folders);
		}
		return { files, folders: [...folders] };
	}

	/** Sorts `path` into `files` (immediate child file) or `folders` (deeper descendant's top segment). */
	private collectChild(path: string, prefix: string, files: string[], folders: Set<string>): void {
		if (!path.startsWith(prefix)) {
			return;
		}
		const rest = path.slice(prefix.length);
		const slash = rest.indexOf("/");
		if (slash === -1) {
			files.push(path);
		} else {
			folders.add(`${prefix}${rest.slice(0, slash)}`);
		}
	}

	/** True when some stored file sits under `path/` — the implicit-directory rule. */
	private hasChildren(path: string): boolean {
		const prefix = `${path}/`;
		for (const filePath of this.files.keys()) {
			if (filePath.startsWith(prefix)) {
				return true;
			}
		}
		return false;
	}
}
