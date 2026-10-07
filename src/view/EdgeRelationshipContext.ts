import { createContext, useContext, useSyncExternalStore } from "react";
import type { EdgeRelationship } from "../engine";
import type { EdgeRelationshipOverlayStore } from "./EdgeRelationshipOverlayStore";

/**
 * Delivers the {@link EdgeRelationshipOverlayStore} to edge components — React
 * Flow instantiates `edgeTypes` itself, so context is the only channel (the
 * sibling of `NoteOpenContext`). Provided by `VicinityGraphFlow`.
 */
export const EdgeRelationshipContext = createContext<EdgeRelationshipOverlayStore | null>(null);

/**
 * The relationship named for the edge with this `directedLinkKey`, or null when
 * it has none — or when `key` is null (a collapsed folder-group edge, which
 * stands for many pairs and carries no label). Throws outside `VicinityGraphFlow`
 * (programmer error).
 */
export function useEdgeRelationship(key: string | null): EdgeRelationship | null {
	const relationships = useEdgeRelationships();
	return key === null ? null : (relationships.get(key) ?? null);
}

/**
 * Every name of the current build, keyed by `directedLinkKey` — LIVE: a name
 * published after the caller rendered (a build's names read, a name the user just
 * saved) re-renders it. Throws outside `VicinityGraphFlow` (programmer error).
 */
export function useEdgeRelationships(): ReadonlyMap<string, EdgeRelationship> {
	const store = useContext(EdgeRelationshipContext);
	if (store === null) {
		throw new Error("EdgeRelationshipContext is missing — edges must render inside VicinityGraphFlow");
	}
	return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
