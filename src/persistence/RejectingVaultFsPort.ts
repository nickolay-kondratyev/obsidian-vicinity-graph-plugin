import { FakeVaultFsPort } from "./FakeVaultFsPort";

/**
 * A {@link FakeVaultFsPort} whose WRITE rejects — what a locked vault, a full disk
 * or a permissions failure looks like to the {@link VaultFileStore} underneath the
 * per-file store. Reads/lists still behave (so a warm before the failing write
 * works); only the atomic write's first step (the `.tmp` write) fails. The
 * per-file counterpart to {@link RejectingPluginDataPort}, for suites pinning the
 * FAILURE policy on writes that now live in the vault rather than `data.json`.
 */
export class RejectingVaultFsPort extends FakeVaultFsPort {
	/** THE failure every suite rejects with, so no test re-types the sentence. */
	static readonly WRITE_FAILURE = new Error("vault file could not be written");

	constructor(private readonly failure: Error = RejectingVaultFsPort.WRITE_FAILURE) {
		super();
	}

	override write(): Promise<void> {
		return Promise.reject(this.failure);
	}
}
