/**
 * Cross-node de-duplication of the in-node image thumbnail (ticket
 * nid_ivt836nuelyse1c0epp86d36z_e). When several nodes would render the SAME
 * image as their thumbnail, only ONE keeps it; the rest fall back to whatever
 * their preview ladder offers WITHOUT the image (outline or title-only). This
 * stops the graph repeating one picture across a cluster of notes that all embed
 * it — the second node with that image simply does not display it.
 *
 * TWO consumers agree on this ONE algorithm (why it lives in the pure engine, not
 * the view where it began): the VIEW mapping decides which node actually paints the
 * image (its candidacy honours the per-node content override), and the content-fit
 * {@link import("./NodeSizer").NodeSizer} decides how tall a node must be for the
 * region it shows — a loser must be sized WITHOUT the thumbnail slot or it renders a
 * large empty box (ticket nid_psgov2t1d2s8d7rk2qvux02zb_e). The winner rule and the
 * "who was going to render a thumbnail" grouping are identical for both; only the
 * candidate `rendersThumbnail` basis differs (the sizer reads the GLOBAL preference,
 * so `sizePx` stays independent of a per-node content flip — see `NodeSizer`).
 *
 * Winner rule (the ticket's tie-breaker): the note HIGHER UP the folder hierarchy
 * wins — fewer folder segments. Equal depth is broken by the vault path
 * lexicographically, purely for determinism.
 */

/** One node's bid to render a thumbnail, everything the winner rule needs. */
export interface ThumbnailCandidate {
	readonly path: string;
	readonly folder: string;
	/** The image the node would render as its thumbnail; absent when it has none. */
	readonly firstImagePath: string | undefined;
	/** True iff the node's preview would resolve to a thumbnail BEFORE de-dup. */
	readonly rendersThumbnail: boolean;
}

const FOLDER_SEPARATOR = "/";

/** Segment count of a folder path; the vault root ("") is depth 0. */
function folderDepthOf(folder: string): number {
	return folder === "" ? 0 : folder.split(FOLDER_SEPARATOR).length;
}

/** The higher-up-the-hierarchy note; path lexicographic as the deterministic tie-break. */
function preferredThumbnailOwner(a: ThumbnailCandidate, b: ThumbnailCandidate): ThumbnailCandidate {
	const depthA = folderDepthOf(a.folder);
	const depthB = folderDepthOf(b.folder);
	if (depthA !== depthB) {
		return depthA < depthB ? a : b;
	}
	return a.path < b.path ? a : b;
}

/**
 * The paths whose thumbnail must be SUPPRESSED because another node higher in the
 * folder hierarchy already renders the same image. Only nodes that WERE going to
 * display the image (`rendersThumbnail`) take part; the winner of each duplicate
 * group is never returned.
 */
export function suppressedDuplicateThumbnails(candidates: readonly ThumbnailCandidate[]): ReadonlySet<string> {
	const byImage = new Map<string, ThumbnailCandidate[]>();
	for (const candidate of candidates) {
		if (!candidate.rendersThumbnail || candidate.firstImagePath === undefined) {
			continue;
		}
		const group = byImage.get(candidate.firstImagePath);
		if (group === undefined) {
			byImage.set(candidate.firstImagePath, [candidate]);
		} else {
			group.push(candidate);
		}
	}
	const suppressed = new Set<string>();
	for (const group of byImage.values()) {
		if (group.length < 2) {
			continue;
		}
		const winner = group.reduce(preferredThumbnailOwner);
		for (const candidate of group) {
			if (candidate.path !== winner.path) {
				suppressed.add(candidate.path);
			}
		}
	}
	return suppressed;
}
