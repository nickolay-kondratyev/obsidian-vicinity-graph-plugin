import { createContext, useContext } from "react";
import type { NoteOpenPort } from "./viewPorts";

/**
 * Delivers the {@link NoteOpenPort} to the node components — the sibling of
 * {@link GraphUiContext} / {@link ControlsActionsContext} for navigation. React
 * Flow instantiates `nodeTypes` components itself, so context is the only clean
 * channel to reach the controller from inside a node; this is what lets an
 * outline entry open its note at a heading without `NoteNode` growing a prop.
 * Provided by `VicinityGraphFlow`.
 */
export const NoteOpenContext = createContext<NoteOpenPort | null>(null);

/** The note opener; throws when rendered outside `VicinityGraphFlow` (programmer error). */
export function useNoteOpen(): NoteOpenPort {
	const open = useContext(NoteOpenContext);
	if (open === null) {
		throw new Error("NoteOpenContext is missing — nodes must render inside VicinityGraphFlow");
	}
	return open;
}
