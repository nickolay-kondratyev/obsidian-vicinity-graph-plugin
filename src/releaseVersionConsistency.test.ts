import { describe, expect, it } from "vitest";
import manifest from "../manifest.json";
import packageJson from "../package.json";
import packageLock from "../package-lock.json";
import versions from "../versions.json";

// The release version lives in FOUR committed files that must agree, or the tag
// build fails. scripts/bump-version.py revs package.json / manifest.json /
// versions.json; package-lock.json carries the SAME version in two spots and
// `npm ci` (the CI release gate) REFUSES when the lock's version disagrees with
// package.json — the exact drift that broke Release 0.1.2 (lock stuck at 0.1.1).
// These run in `npm test`, so a future drift fails the gate BEFORE a tag is cut.
const releaseVersion = packageJson.version;

describe("release version consistency", () => {
	it("WHEN read THEN manifest.json version equals package.json version", () => {
		expect(manifest.version).toBe(releaseVersion);
	});

	it("WHEN read THEN versions.json has an entry for the current version", () => {
		expect(Object.keys(versions)).toContain(releaseVersion);
	});

	// npm ci compares BOTH of these against package.json; either mismatch is fatal.
	it("WHEN read THEN package-lock.json top-level version equals package.json version", () => {
		expect(packageLock.version).toBe(releaseVersion);
	});

	it("WHEN read THEN package-lock.json root package version equals package.json version", () => {
		expect(packageLock.packages[""].version).toBe(releaseVersion);
	});
});
