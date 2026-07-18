import type { ElkNode } from "elkjs";
import type { NeighborhoodGraph } from "../engine";

/**
 * Narrow structural ports the {@link GraphViewController} depends on (DIP).
 * Types only — no runtime import — so the controller has ZERO obsidian / elkjs /
 * builder runtime coupling and is fully node-testable with plain fakes (no
 * obsidian runtime mock). Real collaborators satisfy these structurally:
 * `NeighborhoodGraphBuilder` → {@link GraphSourcePort}, `ElkLayoutRunner` →
 * {@link GraphLayoutPort}, `ObsidianNoteNavigator` → {@link NoteNavigatorPort}.
 */

/** Builds the neighborhood graph for a MAIN file path. `null` = path unresolved. */
export interface GraphSourcePort {
	build(mainPath: string): Promise<NeighborhoodGraph | null>;
}

/** Runs the elk layout on an elk graph, returning it annotated with coordinates. */
export interface GraphLayoutPort {
	layout(graph: ElkNode): Promise<ElkNode>;
}

/** How a clicked note opens (step-05: ctrl/cmd-click = new tab). */
export interface OpenNoteOptions {
	/** `true` opens a NEW tab (`getLeaf(true)`); otherwise the current main-area leaf is reused. */
	readonly newTab: boolean;
}

/** The slice of Obsidian navigation the controller needs: read the active file
 * and open a clicked node. Keeps the controller obsidian-free. */
export interface NoteNavigatorPort {
	activeFilePath(): string | null;
	openNote(path: string, options?: OpenNoteOptions): void;
}

/** Fires Obsidian's native `hover-link` page preview for a hovered node. */
export interface HoverPreviewRequest {
	readonly nativeEvent: MouseEvent;
	/** The hovered node element the popover anchors to. */
	readonly targetEl: HTMLElement;
	/** Vault path of the hovered note. */
	readonly path: string;
}

/** Opens the native attachment menu for one icon-strip chip. */
export interface AttachmentMenuRequest {
	readonly nativeEvent: MouseEvent;
	/** The attachment vault paths listed as menu entries. */
	readonly paths: readonly string[];
}

/**
 * Obsidian UI services the rich node components need (step-05). Split from
 * {@link NoteNavigatorPort} so navigation stays navigation (SRP) and the React
 * components — which receive this port via context — never import `obsidian`
 * directly (that includes icon rendering, hence {@link GraphUiPort.renderIcon}).
 */
export interface GraphUiPort {
	/** App-servable URL for a vault file; `null` when the path resolves to no file. */
	resourcePath(path: string): string | null;
	showHoverPreview(request: HoverPreviewRequest): void;
	showAttachmentMenu(request: AttachmentMenuRequest): void;
	/** Renders a built-in (lucide) icon into `el`, replacing its content. */
	renderIcon(el: HTMLElement, iconId: string): void;
}
