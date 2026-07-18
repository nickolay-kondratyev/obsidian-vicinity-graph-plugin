import { describe, expect, it } from "vitest";
import { ATTACHMENT_MENU_MAX_ITEMS, planAttachmentMenu } from "./attachmentMenu";

function pathsOfLength(count: number): string[] {
	return Array.from({ length: count }, (_, i) => `assets/file-${i}.png`);
}

describe("planAttachmentMenu", () => {
	describe("GIVEN a group at or below the cap", () => {
		it("WHEN planning THEN every path is visible", () => {
			const paths = pathsOfLength(ATTACHMENT_MENU_MAX_ITEMS);
			expect(planAttachmentMenu(paths).visiblePaths).toEqual(paths);
		});

		it("WHEN planning THEN there is no overflow item", () => {
			expect(planAttachmentMenu(pathsOfLength(ATTACHMENT_MENU_MAX_ITEMS)).overflowText).toBeNull();
		});
	});

	describe("GIVEN a group above the cap", () => {
		const paths = pathsOfLength(ATTACHMENT_MENU_MAX_ITEMS + 5);

		it("WHEN planning THEN visible entries are capped to the first ATTACHMENT_MENU_MAX_ITEMS", () => {
			expect(planAttachmentMenu(paths).visiblePaths).toEqual(paths.slice(0, ATTACHMENT_MENU_MAX_ITEMS));
		});

		it("WHEN planning THEN the overflow item counts the capped-off entries", () => {
			expect(planAttachmentMenu(paths).overflowText).toBe("…and 5 more");
		});
	});
});
