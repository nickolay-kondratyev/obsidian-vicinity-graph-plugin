import { createContext, useContext } from "react";
import type { TagFilterPort } from "./viewPorts";

/**
 * Delivers the {@link TagFilterPort} to the node components (a tag box label, a
 * note's tag chips) — the sibling of `NoteOpenContext`, for the same reason: React
 * Flow instantiates node components itself, so context is the only clean channel
 * to the controller. Provided by `VicinityGraphFlow`.
 */
export const TagFilterContext = createContext<TagFilterPort | null>(null);

/** The in-graph tag filter; throws when rendered outside `VicinityGraphFlow` (programmer error). */
export function useTagFilter(): TagFilterPort {
	const tagFilter = useContext(TagFilterContext);
	if (tagFilter === null) {
		throw new Error("TagFilterContext is missing — nodes must render inside VicinityGraphFlow");
	}
	return tagFilter;
}
