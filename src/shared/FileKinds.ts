import { VaultPathFacts } from "./VaultPathFacts";

/**
 * Node-bearing files become graph nodes; everything else is (at most) an
 * attachment. Single source of this knowledge (CLARIFICATION Q4: the adapter
 * owns the real rule; `FakeLinkProvider` mirrors it for fixtures).
 */
const NODE_BEARING_EXTENSIONS: ReadonlySet<string> = new Set(["md", "canvas"]);

/** Attachment extensions rendered as thumbnails (drives `firstImagePath`). */
const IMAGE_EXTENSIONS: ReadonlySet<string> = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp"]);

/** The one markdown extension Obsidian recognises (frontmatter, headings, link resolution). */
const MARKDOWN_EXTENSION = "md";

/**
 * Excalidraw drawings are `*.excalidraw.md`: markdown to Obsidian, but the body
 * is a generated drawing payload, not prose. They stay graph NODES
 * (CLARIFICATION Q4) and are excluded from outline PARSING only.
 */
const EXCALIDRAW_SUFFIX = ".excalidraw.md";

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

	/** Markdown — the only file kind carrying frontmatter, headings and resolvable link texts. */
	static isMarkdownPath(path: string): boolean {
		return VaultPathFacts.extensionOf(path) === MARKDOWN_EXTENSION;
	}

	/**
	 * Files whose headings may be rendered as a node outline: markdown, minus
	 * excalidraw drawings. Case-insensitive on the suffix — the vault, not the
	 * user, decides casing (`X.Excalidraw.MD` is the same drawing).
	 */
	static isOutlineBearingPath(path: string): boolean {
		return FileKinds.isMarkdownPath(path) && !path.toLowerCase().endsWith(EXCALIDRAW_SUFFIX);
	}
}
