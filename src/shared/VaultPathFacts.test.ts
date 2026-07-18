import { describe, expect, it } from "vitest";
import { VaultPathFacts } from "./VaultPathFacts";

describe("VaultPathFacts.extensionOf", () => {
	it("WHEN a nested path has an extension THEN it is returned lower-cased without the dot", () => {
		expect(VaultPathFacts.extensionOf("Folder/Note.MD")).toBe("md");
	});

	it("WHEN the basename has no dot THEN the extension is empty", () => {
		expect(VaultPathFacts.extensionOf("folder/README")).toBe("");
	});

	it("WHEN a folder name contains a dot THEN it does not leak into the extension", () => {
		expect(VaultPathFacts.extensionOf("v1.2/notes")).toBe("");
	});
});

describe("VaultPathFacts.folderOf", () => {
	it("WHEN the file sits in a nested folder THEN the folder part is returned", () => {
		expect(VaultPathFacts.folderOf("a/b/c.md")).toBe("a/b");
	});

	it("WHEN the file sits at the vault root THEN the folder is empty", () => {
		expect(VaultPathFacts.folderOf("root.md")).toBe("");
	});
});

describe("VaultPathFacts.titleOf", () => {
	it("WHEN the file has an extension THEN the title strips it", () => {
		expect(VaultPathFacts.titleOf("folder/My Note.md")).toBe("My Note");
	});

	it("WHEN the basename is a dot-file THEN the full name is kept", () => {
		expect(VaultPathFacts.titleOf(".hidden")).toBe(".hidden");
	});
});

describe("VaultPathFacts.folderNameOf", () => {
	it("WHEN the folder is nested THEN only the last segment is returned", () => {
		expect(VaultPathFacts.folderNameOf("projects/alpha/notes")).toBe("notes");
	});

	it("WHEN the folder is top-level THEN the folder itself is returned", () => {
		expect(VaultPathFacts.folderNameOf("notes")).toBe("notes");
	});

	it("WHEN the folder is the vault root THEN the empty string is returned", () => {
		expect(VaultPathFacts.folderNameOf("")).toBe("");
	});
});
