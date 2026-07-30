import { describe, expect, it } from "vitest";
import { LINK_KINDS, LinkKinds } from "./LinkKind";

describe("LinkKinds.ofEmbedMarker", () => {
	it("WHEN the captured marker is a bang THEN the kind is embed", () => {
		expect(LinkKinds.ofEmbedMarker("!")).toBe("embed");
	});

	it("WHEN the captured marker is empty THEN the kind is a plain link", () => {
		expect(LinkKinds.ofEmbedMarker("")).toBe("link");
	});
});

describe("LINK_KINDS", () => {
	it("WHEN the kinds are enumerated THEN exactly link and embed exist", () => {
		expect([...LINK_KINDS]).toEqual(["link", "embed"]);
	});
});
