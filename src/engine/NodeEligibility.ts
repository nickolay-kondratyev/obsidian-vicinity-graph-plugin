import type { LinkProvider } from "./LinkProvider";
import type { VaultPath } from "./types";

/**
 * SRP owner of "may this path be a graph node?" inside the engine (human
 * requirement, step-02 CLARIFICATION Q4). The REAL rule (`.md` + `.canvas`)
 * lives adapter-side and reaches us as `FileMetadata.isNodeBearing`; this
 * class is the single engine location that interprets that flag.
 */
export class NodeEligibility {
	constructor(private readonly provider: LinkProvider) {}

	/** Unknown files (no metadata) are never nodes. */
	isNodeBearing(path: VaultPath): boolean {
		return this.provider.getFileMetadata(path)?.isNodeBearing ?? false;
	}
}
