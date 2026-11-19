// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Tags } from "../shared/Tags";
import type { Tag } from "../shared/Tags";
import { GraphModeCopy } from "./graphMode";
import type { GraphModeStatus } from "./graphMode";
import { GraphModePill } from "./GraphModePill";

/**
 * The rendered status pill (tags-v1 decision 12): what it SAYS per mode, that the
 * hover explanation is attached, and that tag mode — and only tag mode — offers
 * the exit. Wording is asserted through {@link GraphModeCopy}'s own strings where
 * the test is about wiring, and literally where the wording IS the behavior.
 */

function tag(raw: string): Tag {
	const parsed = Tags.parse(raw);
	if (parsed === undefined) {
		throw new Error(`fixture bug: [${raw}] is not a tag`);
	}
	return parsed;
}

const NOTE_STATUS: GraphModeStatus = { kind: "note", noteTitle: "Hub" };
const TAG_STATUS: GraphModeStatus = { kind: "tag", tag: tag("#Project"), noteCount: 12 };

function renderPill(status: GraphModeStatus): { readonly onExit: ReturnType<typeof vi.fn> } {
	const onExit = vi.fn();
	render(<GraphModePill status={status} onExitTagMode={onExit} />);
	return { onExit };
}

describe("GraphModePill", () => {
	afterEach(() => {
		cleanup();
	});

	it("WHEN the graph follows a note THEN the pill names that note", () => {
		renderPill(NOTE_STATUS);

		expect(screen.getByRole("status").textContent).toBe("Vicinity of Hub");
	});

	it("WHEN the graph is filtered by a tag THEN the pill names the tag and the note count", () => {
		renderPill(TAG_STATUS);

		expect(screen.getByRole("status").textContent).toBe("Tagged #Project · 12 notes");
	});

	it("WHEN the pill is hovered in note mode THEN the note-mode explanation is offered", () => {
		renderPill(NOTE_STATUS);

		expect(screen.getByRole("status").getAttribute("title")).toBe(GraphModeCopy.explanation(NOTE_STATUS));
	});

	it("WHEN the pill is hovered in tag mode THEN the tag-mode explanation is offered", () => {
		renderPill(TAG_STATUS);

		expect(screen.getByRole("status").getAttribute("title")).toBe(GraphModeCopy.explanation(TAG_STATUS));
	});

	it("WHEN the graph follows a note THEN there is no exit button", () => {
		renderPill(NOTE_STATUS);

		expect(screen.queryByRole("button")).toBeNull();
	});

	it("WHEN the graph is filtered by a tag THEN the pill offers the way back to the active note", () => {
		renderPill(TAG_STATUS);

		expect(screen.getByRole("button", { name: "Back to active note" })).toBeTruthy();
	});

	it("WHEN the exit button is pressed THEN the exit is requested", () => {
		const { onExit } = renderPill(TAG_STATUS);

		fireEvent.click(screen.getByRole("button", { name: "Back to active note" }));

		expect(onExit).toHaveBeenCalledTimes(1);
	});
});

describe("GraphModeCopy.explanation", () => {
	it("WHEN in note mode THEN it says the graph follows the open note", () => {
		expect(GraphModeCopy.explanation(NOTE_STATUS)).toContain("follows whichever note you open");
	});

	it("WHEN in tag mode THEN it says links do not matter", () => {
		expect(GraphModeCopy.explanation(TAG_STATUS)).toContain("whether or not they link to each other");
	});

	it("WHEN in tag mode THEN it says the graph does not follow the open note", () => {
		expect(GraphModeCopy.explanation(TAG_STATUS)).toContain("stays on this tag when you open other notes");
	});
});
