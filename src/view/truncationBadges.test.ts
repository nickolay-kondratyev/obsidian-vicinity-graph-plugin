import { describe, expect, it } from "vitest";
import type { FolderPath } from "../engine";
import { asFolderPath } from "../engine";
import { deriveTruncationBadges, NO_ORPHAN_TRUNCATION } from "./truncationBadges";

function hiddenCounts(entries: Record<string, number>): ReadonlyMap<FolderPath, number> {
	return new Map(Object.entries(entries).map(([folder, count]) => [asFolderPath(folder), count]));
}

function folders(...paths: string[]): ReadonlySet<FolderPath> {
	return new Set(paths.map(asFolderPath));
}

describe("deriveTruncationBadges per-group badges", () => {
	it("WHEN a hidden folder has a rendered group THEN its count becomes that group's badge", () => {
		const badges = deriveTruncationBadges(hiddenCounts({ notes: 3 }), folders("notes"));
		expect(badges.hiddenCountByGroupFolder.get(asFolderPath("notes"))).toBe(3);
	});

	it("WHEN a hidden folder has a rendered group THEN it does not leak into the orphan aggregate", () => {
		const badges = deriveTruncationBadges(hiddenCounts({ notes: 3 }), folders("notes"));
		expect(badges.orphan).toEqual(NO_ORPHAN_TRUNCATION);
	});
});

describe("deriveTruncationBadges orphan aggregate (folders without a rendered group)", () => {
	it("WHEN hidden folders have no rendered group THEN their counts sum into the overlay total", () => {
		const badges = deriveTruncationBadges(hiddenCounts({ lost: 2, gone: 3 }), folders());
		expect(badges.orphan.totalHiddenCount).toBe(5);
	});

	it("WHEN aggregating THEN the tooltip breakdown lists each folder sorted by path", () => {
		const badges = deriveTruncationBadges(hiddenCounts({ lost: 2, gone: 3 }), folders());
		expect(badges.orphan.breakdown).toEqual([
			{ folder: "gone", hiddenCount: 3 },
			{ folder: "lost", hiddenCount: 2 },
		]);
	});

	it("WHEN the vault root has hidden nodes THEN they aggregate too (root never groups)", () => {
		const badges = deriveTruncationBadges(hiddenCounts({ "": 1 }), folders());
		expect(badges.orphan.totalHiddenCount).toBe(1);
	});

	it("WHEN nothing was hidden THEN the orphan aggregate is the shared zero constant", () => {
		expect(deriveTruncationBadges(hiddenCounts({}), folders()).orphan).toBe(NO_ORPHAN_TRUNCATION);
	});

	it("WHEN counts split between grouped and orphan folders THEN every hidden node surfaces exactly once", () => {
		const badges = deriveTruncationBadges(hiddenCounts({ notes: 3, lost: 2 }), folders("notes"));
		const surfaced = badges.orphan.totalHiddenCount + (badges.hiddenCountByGroupFolder.get(asFolderPath("notes")) ?? 0);
		expect(surfaced).toBe(5);
	});
});
