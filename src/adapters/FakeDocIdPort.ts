import { FileKinds } from "../shared/FileKinds";
import type { DocIdPort, VaultFilePort } from "./obsidianPorts";

/**
 * Test-side {@link DocIdPort}: docids come from a fixed path→docid record
 * (unlisted eligible paths have none, mirroring `getDocId` on an id-less
 * doc). `ensureDocId` mints `docid_minted<n>_e` for unlisted paths and counts
 * its calls so tests can assert the read-path never writes.
 */
export class FakeDocIdPort implements DocIdPort {
	ensureCalls = 0;

	private readonly docidByPath: Map<string, string>;
	private readonly unidentifiablePaths = new Set<string>();
	private readonly unreadablePaths = new Set<string>();
	private mintedCount = 0;

	constructor(docidByPath: Readonly<Record<string, string>> = {}) {
		this.docidByPath = new Map(Object.entries(docidByPath));
	}

	async getDocId(file: VaultFilePort): Promise<string | null> {
		this.failIfUnreadable(file);
		return this.docidByPath.get(file.path) ?? null;
	}

	async ensureDocId(file: VaultFilePort): Promise<string | null> {
		this.ensureCalls += 1;
		this.failIfUnreadable(file);
		if (this.unidentifiablePaths.has(file.path)) {
			return null;
		}
		const existing = this.docidByPath.get(file.path);
		if (existing !== undefined) {
			return existing;
		}
		this.mintedCount += 1;
		const minted = `docid_minted${this.mintedCount}_e`;
		this.docidByPath.set(file.path, minted);
		return minted;
	}

	isEligible(file: VaultFilePort): boolean {
		return FileKinds.isNodeBearingPath(file.path);
	}

	/** Test seeding: id-lib could neither read nor create an id for this path (`ensureDocId` → null). */
	markUnidentifiable(path: string): void {
		this.docidByPath.delete(path);
		this.unidentifiablePaths.add(path);
	}

	/**
	 * Test seeding: reading this path THROWS. Real shape — id-lib resolves an id
	 * through `vault.cachedRead`, which rejects for a file deleted (or made
	 * unreadable) after the caller took its `getFiles()` snapshot.
	 */
	markUnreadable(path: string): void {
		this.unreadablePaths.add(path);
	}

	/** Test seeding: undoes {@link markUnreadable} — the read failure was transient. */
	markReadable(path: string): void {
		this.unreadablePaths.delete(path);
	}

	private failIfUnreadable(file: VaultFilePort): void {
		if (this.unreadablePaths.has(file.path)) {
			throw new Error(`FakeDocIdPort: unreadable path=[${file.path}]`);
		}
	}
}
