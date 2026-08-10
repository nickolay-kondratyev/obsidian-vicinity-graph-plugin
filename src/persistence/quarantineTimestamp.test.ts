import { describe, expect, it } from "vitest";
import { formatQuarantineTimestamp } from "./quarantineTimestamp";

describe("formatQuarantineTimestamp", () => {
	it("WHEN given a known instant THEN it renders YYYY-MM-DDTHH-mm-ss in UTC", () => {
		// 2026-08-09T14:32:05.000Z
		const instant = Date.UTC(2026, 7, 9, 14, 32, 5);
		expect(formatQuarantineTimestamp(instant)).toBe("2026-08-09T14-32-05");
	});

	it("WHEN a component is single-digit THEN it is zero-padded", () => {
		const instant = Date.UTC(2026, 0, 3, 4, 5, 6);
		expect(formatQuarantineTimestamp(instant)).toBe("2026-01-03T04-05-06");
	});

	it("WHEN rendered THEN it contains no colon (filename-safe)", () => {
		expect(formatQuarantineTimestamp(Date.UTC(2026, 7, 9, 14, 32, 5))).not.toContain(":");
	});
});
