import { VaultPathFacts } from "./VaultPathFacts";

/**
 * Node-bearing files become graph nodes; everything else is (at most) an
 * attachment. Single source of this knowledge (CLARIFICATION Q4: the adapter
 * owns the real rule; `FakeLinkProvider` mirrors it for fixtures).
 */
const NODE_BEARING_EXTENSIONS: ReadonlySet<string> = new Set(["md", "canvas"]);

/** Attachment extensions rendered as thumbnails (drives `firstImagePath`). */
const IMAGE_EXTENSIONS: ReadonlySet<string> = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp"]);

/**
 * Pure file-kind classification shared by the engine's fixture provider and
 * the real Obsidian adapters. See `VaultPathFacts` for the purity contract of
 * `src/shared/`.
 */
export class FileKinds {
	static isNodeBearingPath(path: string): boolean {
		return NODE_BEARING_EXTENSIONS.has(VaultPathFacts.extensionOf(path));
	}

	static isImagePath(path: string): boolean {
		return IMAGE_EXTENSIONS.has(VaultPathFacts.extensionOf(path));
	}
}
