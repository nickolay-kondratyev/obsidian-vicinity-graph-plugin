import { describe, expect, it } from "vitest";
import type { AttachmentRef } from "../engine";
import { asVaultPath } from "../engine";
import { attachmentIconStrip } from "./attachmentIconStrip";

function ref(path: string, isImage = false): AttachmentRef {
	return { path: asVaultPath(path), isImage };
}

/** GIVEN attachments referencing pdf, png, pdf again — in that order. */
const MIXED = [ref("docs/spec.pdf"), ref("img/cover.png", true), ref("docs/appendix.pdf")];

describe("attachmentIconStrip grouping", () => {
	it("WHEN attachments share an extension THEN they collapse into one entry with a count", () => {
		expect(attachmentIconStrip(MIXED).find((group) => group.extension === "pdf")?.count).toBe(2);
	});

	it("WHEN grouping THEN entries appear in first-seen extension order", () => {
		expect(attachmentIconStrip(MIXED).map((group) => group.extension)).toEqual(["pdf", "png"]);
	});

	it("WHEN a group is built THEN it lists its files in first-reference order (dropdown entries)", () => {
		expect(attachmentIconStrip(MIXED).find((group) => group.extension === "pdf")?.paths).toEqual([
			"docs/spec.pdf",
			"docs/appendix.pdf",
		]);
	});

	it("WHEN extensions differ only by case THEN they group together (extensionOf lower-cases)", () => {
		const strip = attachmentIconStrip([ref("a.PDF"), ref("b.pdf")]);
		expect(strip).toEqual([{ extension: "pdf", count: 2, paths: ["a.PDF", "b.pdf"] }]);
	});

	it("WHEN there are no attachments THEN the strip is empty", () => {
		expect(attachmentIconStrip([])).toEqual([]);
	});
});
