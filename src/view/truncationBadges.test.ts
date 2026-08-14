import { describe, expect, it } from "vitest";
import type { FolderPath } from "../engine";
import { asFolderPath } from "../engine";
import type { FolderGroup } from "./folderGrouping";
import { deriveTruncationBadges, NO_ORPHAN_TRUNCATION } from "./truncationBadges";

function hiddenCounts(entries: Record<string, number>): ReadonlyMap<FolderPath, number> {
	return new Map(Object.entries(entries).map(([folder, count]) => [asFolderPath(folder), count]));
}

function group(folder: string): FolderGroup {
	return {
		folder: asFolderPath(folder),
		parentFolder: null,
		leafName: folder,
		chainPath: folder,
		memberPaths: [],
	};
}

/**
 * Rendered-grouping stub: maps each named folder to a group whose `folder` is
 * its NEAREST rendered ancestor (self-or-ancestor), mirroring
 * `FolderGroupingResult.nearestRenderedAncestorGroupOf`. Folders absent from the
 * map render at the top level (no ancestor group → orphan).
 */
function nearestAncestorGroups(
	renderedAncestorByFolder: Record<string, string>,
): (folder: FolderPath) => FolderGroup | null {
	return (folder) => {
		const renderedAncestor = renderedAncestorByFolder[folder];
		return renderedAncestor === undefined ? null : group(renderedAncestor);
	};
}

/** No folder has a rendered ancestor group (everything falls to the orphan overlay). */
const NO_GROUPS = nearestAncestorGroups({});

describe("deriveTruncationBadges per-group badges", () => {
	it("WHEN a hidden folder has a rendered group at its exact folder THEN its count becomes that group's badge", () => {
		const badges = deriveTruncationBadges(hiddenCounts({ notes: 3 }), nearestAncestorGroups({ notes: "notes" }));
		expect(badges.hiddenCountByGroupFolder.get(asFolderPath("notes"))).toBe(3);
	});

	it("WHEN a hidden folder has a rendered group THEN it does not leak into the orphan aggregate", () => {
		const badges = deriveTruncationBadges(hiddenCounts({ notes: 3 }), nearestAncestorGroups({ notes: "notes" }));
		expect(badges.orphan).toEqual(NO_ORPHAN_TRUNCATION);
	});

	it("WHEN a hidden folder's nearest rendered group is an ANCESTOR THEN the ancestor group carries the badge", () => {
		const badges = deriveTruncationBadges(
			hiddenCounts({ "SQL/sub": 2 }),
			nearestAncestorGroups({ "SQL/sub": "SQL" }),
		);
		expect(badges.hiddenCountByGroupFolder.get(asFolderPath("SQL"))).toBe(2);
	});

	it("WHEN a hidden folder attributes to an ancestor group THEN it does not leak into the orphan aggregate", () => {
		const badges = deriveTruncationBadges(
			hiddenCounts({ "SQL/sub": 2 }),
			nearestAncestorGroups({ "SQL/sub": "SQL" }),
		);
		expect(badges.orphan).toEqual(NO_ORPHAN_TRUNCATION);
	});

	it("WHEN several hidden folders share one nearest ancestor group THEN their counts accumulate on that badge", () => {
		const badges = deriveTruncationBadges(
			hiddenCounts({ "SQL/sub": 2, "SQL/other": 3, SQL: 1 }),
			nearestAncestorGroups({ "SQL/sub": "SQL", "SQL/other": "SQL", SQL: "SQL" }),
		);
		expect(badges.hiddenCountByGroupFolder.get(asFolderPath("SQL"))).toBe(6);
	});
});

describe("deriveTruncationBadges orphan aggregate (folders without a rendered ancestor group)", () => {
	it("WHEN hidden folders have no rendered ancestor group THEN their counts sum into the overlay total", () => {
		const badges = deriveTruncationBadges(hiddenCounts({ lost: 2, gone: 3 }), NO_GROUPS);
		expect(badges.orphan.totalHiddenCount).toBe(5);
	});

	it("WHEN aggregating THEN the tooltip breakdown lists each folder sorted by path", () => {
		const badges = deriveTruncationBadges(hiddenCounts({ lost: 2, gone: 3 }), NO_GROUPS);
		expect(badges.orphan.breakdown).toEqual([
			{ folder: "gone", hiddenCount: 3 },
			{ folder: "lost", hiddenCount: 2 },
		]);
	});

	it("WHEN the vault root has hidden nodes THEN they aggregate too (root never groups)", () => {
		const badges = deriveTruncationBadges(hiddenCounts({ "": 1 }), NO_GROUPS);
		expect(badges.orphan.totalHiddenCount).toBe(1);
	});

	it("WHEN nothing was hidden THEN the orphan aggregate is the shared zero constant", () => {
		expect(deriveTruncationBadges(hiddenCounts({}), NO_GROUPS).orphan).toBe(NO_ORPHAN_TRUNCATION);
	});

	it("WHEN counts split between grouped and orphan folders THEN every hidden node surfaces exactly once", () => {
		const badges = deriveTruncationBadges(
			hiddenCounts({ notes: 3, lost: 2 }),
			nearestAncestorGroups({ notes: "notes" }),
		);
		const surfaced = badges.orphan.totalHiddenCount + (badges.hiddenCountByGroupFolder.get(asFolderPath("notes")) ?? 0);
		expect(surfaced).toBe(5);
	});
});
