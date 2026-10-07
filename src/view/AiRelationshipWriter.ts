import type { VaultPort } from "../adapters/obsidianPorts";
import type { AiNamedRelationship } from "../engine";
import type { PersistenceServices } from "../persistence/PersistenceServices";
import type { NonSettingsWriteSubject } from "./settingsWriteFailureNotice";
import type { SettingsWritePipeline } from "./settingsWritePipeline";
import type { AiRelationshipWriterPort } from "./viewPorts";

/** What a failed AI-name save is announced as — the sentence is `settingsWriteFailureNotice.ts`'s. */
const RELATIONSHIP_WRITE_SUBJECT: NonSettingsWriteSubject = "relationship-name";

/**
 * Where an AI-generated name lands (task 3/4 `nid_cbnhpdfn4myqfzqr8weyg7kq5_e`):
 * the `AiRelationshipQueue`'s ONE write. PLUGIN-lived, like the queue it serves
 * (one per plugin in `main.ts`), which is why it is not a method on the per-view
 * `ControlsActions` — the queue outlives any one view.
 *
 * Rides the same guarded seam as a manual name, so a failed save gets the ONE
 * failure notice and a stored name repaints every view. Unlike a manual name a
 * refusal is SILENT: nobody clicked anything, and auto mode would show it once per
 * edge. A pair named meanwhile (manual, AI or dismissed) keeps its record —
 * nothing moved.
 */
export class AiRelationshipWriter implements AiRelationshipWriterPort {
	constructor(
		private readonly persistenceServices: PersistenceServices,
		private readonly vault: VaultPort,
		private readonly settingsWrites: SettingsWritePipeline,
	) {}

	saveAiRelationship(sourcePath: string, targetPath: string, named: AiNamedRelationship): Promise<void> {
		return this.settingsWrites.runGuarded(RELATIONSHIP_WRITE_SUBJECT, async () => {
			const sourceFile = this.vault.getFileByPath(sourcePath);
			const targetFile = this.vault.getFileByPath(targetPath);
			if (sourceFile === null || targetFile === null) {
				return "store-unchanged";
			}
			const outcome = await this.persistenceServices.saveAiRelationship(sourceFile, targetFile, named);
			return outcome.kind === "persisted" ? "store-changed" : "store-unchanged";
		});
	}
}
