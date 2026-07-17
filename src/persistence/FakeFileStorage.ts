import type { FileStoragePort } from "./storagePorts";

/**
 * In-memory {@link FileStoragePort} for persistence tests (the storage-side
 * sibling of the engine's `FakeLinkProvider`). Mirrors DataAdapter behavior:
 * `list` returns FULL paths of direct children; reading/removing a missing
 * path rejects.
 */
export class FakeFileStorage implements FileStoragePort {
	private readonly filesByPath = new Map<string, string>();
	private readonly dirs = new Set<string>();

	async exists(path: string): Promise<boolean> {
		return this.filesByPath.has(path) || this.dirs.has(path);
	}

	async read(path: string): Promise<string> {
		const content = this.filesByPath.get(path);
		if (content === undefined) {
			throw new Error(`FakeFileStorage: no such file [${path}]`);
		}
		return content;
	}

	async write(path: string, data: string): Promise<void> {
		this.filesByPath.set(path, data);
	}

	async remove(path: string): Promise<void> {
		if (!this.filesByPath.delete(path)) {
			throw new Error(`FakeFileStorage: no such file [${path}]`);
		}
	}

	async mkdir(path: string): Promise<void> {
		this.dirs.add(path);
	}

	async list(dirPath: string): Promise<{ files: string[]; folders: string[] }> {
		if (!this.dirs.has(dirPath)) {
			throw new Error(`FakeFileStorage: no such folder [${dirPath}]`);
		}
		const prefix = `${dirPath}/`;
		const files = [...this.filesByPath.keys()].filter(
			(path) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/"),
		);
		return { files, folders: [] };
	}

	/** Test instrumentation. */
	fileCount(): number {
		return this.filesByPath.size;
	}

	/** Test seeding without going through the store under test. */
	seedFile(path: string, content: string): void {
		this.filesByPath.set(path, content);
	}
}
