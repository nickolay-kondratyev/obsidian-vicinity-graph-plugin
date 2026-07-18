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

/** The slice of Obsidian navigation the controller needs: read the active file
 * and open a clicked node. Keeps the controller obsidian-free. */
export interface NoteNavigatorPort {
	activeFilePath(): string | null;
	openNote(path: string): void;
}
