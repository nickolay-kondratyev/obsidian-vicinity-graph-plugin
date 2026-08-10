/**
 * Structural port over the raw vault filesystem — the subset of Obsidian's
 * `DataAdapter` (`this.app.vault.adapter`) that {@link VaultFileStore} needs to
 * read/write files living OUTSIDE `.obsidian/` (so they sync as vault content).
 *
 * Same DIP pattern as {@link ./storagePorts PluginDataPort}: the real
 * `DataAdapter` satisfies {@link VaultDataAdapterSlice} STRUCTURALLY, so
 * production passes `vault.adapter` in unchanged while tests drive
 * {@link ./FakeVaultFsPort FakeVaultFsPort}. This module stays obsidian-free —
 * only `main.ts` constructs the real adapter and hands it here.
 *
 * All paths are vault-root-relative and `/`-separated (Obsidian's normalized
 * form). Callers pass already-normalized paths; this seam does no normalizing.
 */
export interface VaultFsPort {
	exists(path: string): Promise<boolean>;
	/** Rejects if the path is absent. */
	read(path: string): Promise<string>;
	write(path: string, contents: string): Promise<void>;
	remove(path: string): Promise<void>;
	rename(oldPath: string, newPath: string): Promise<void>;
	/** Idempotent: a repeat on an existing dir is a no-op, never a throw. */
	mkdir(path: string): Promise<void>;
	/** Immediate children of `dirPath` (non-recursive); paths are vault-root-relative. */
	list(dirPath: string): Promise<{ files: string[]; folders: string[] }>;
}

/**
 * The exact slice of Obsidian's `DataAdapter` the real port wraps. Declared
 * structurally (no `obsidian` import) so the real adapter — whose `write`/`exists`
 * carry extra optional params — checks bivariantly against it.
 */
export interface VaultDataAdapterSlice {
	exists(path: string): Promise<boolean>;
	read(path: string): Promise<string>;
	write(path: string, data: string): Promise<void>;
	remove(path: string): Promise<void>;
	rename(oldPath: string, newPath: string): Promise<void>;
	mkdir(path: string): Promise<void>;
	list(dirPath: string): Promise<{ files: string[]; folders: string[] }>;
}

/**
 * The real {@link VaultFsPort} — a thin pass-through to `vault.adapter`, with ONE
 * behaviour added: `mkdir` is made idempotent. Obsidian's adapter `mkdir` rejects
 * when the folder already exists on some platforms, but the port's contract (and
 * the store's `mkdir -p` walk) needs a repeat to be a no-op, so we guard on
 * `exists` first. Everything else forwards verbatim.
 */
export class VaultAdapterFsPort implements VaultFsPort {
	constructor(private readonly adapter: VaultDataAdapterSlice) {}

	exists(path: string): Promise<boolean> {
		return this.adapter.exists(path);
	}

	read(path: string): Promise<string> {
		return this.adapter.read(path);
	}

	write(path: string, contents: string): Promise<void> {
		return this.adapter.write(path, contents);
	}

	remove(path: string): Promise<void> {
		return this.adapter.remove(path);
	}

	rename(oldPath: string, newPath: string): Promise<void> {
		return this.adapter.rename(oldPath, newPath);
	}

	async mkdir(path: string): Promise<void> {
		if (await this.adapter.exists(path)) {
			return;
		}
		await this.adapter.mkdir(path);
	}

	list(dirPath: string): Promise<{ files: string[]; folders: string[] }> {
		return this.adapter.list(dirPath);
	}
}
