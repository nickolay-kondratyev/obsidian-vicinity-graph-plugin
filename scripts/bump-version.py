#!/usr/bin/env python3
"""Bump the PATCH version coherently across the four release files.

Called by ``release_update_tag.sh`` once the test matrix is green. It reads the
current version from ``package.json``, increments the patch component, and writes
it back into the three files Obsidian's release process must keep in agreement
(docs-internal/RELEASE_CHECKLIST.md §3):

  - package.json      -> ``version``
  - manifest.json     -> ``version``
  - versions.json     -> a new ``"<newVersion>": "<minAppVersion>"`` entry
                         (minAppVersion read from manifest.json)
  - package-lock.json -> ``version`` AND ``packages[""].version`` (npm keeps the
                         package version in TWO places; `npm ci` — the CI release
                         gate — REFUSES when the lock's version disagrees with
                         package.json, which is what broke Release 0.1.2)

It prints ONLY the new version string on stdout so the caller can tag with it;
all human-facing narration goes to stderr.

WHY targeted text edits (not json.dump) for package.json/manifest.json: a full
re-serialise would reorder keys and reflow the file, burying the one-line version
bump in noise. versions.json IS rebuilt from its parsed map because it is a flat
map whose tab-indented shape ``json.dumps(indent="\t")`` reproduces exactly, and
that is the clean way to insert a new key.

These files use TAB indentation; every edit here preserves it.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
PACKAGE_JSON = REPO_ROOT / "package.json"
MANIFEST_JSON = REPO_ROOT / "manifest.json"
VERSIONS_JSON = REPO_ROOT / "versions.json"
PACKAGE_LOCK_JSON = REPO_ROOT / "package-lock.json"


def fail(message: str) -> "None":
    print(f"bump-version: {message}", file=sys.stderr)
    raise SystemExit(1)


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def bumped_patch(version: str) -> str:
    match = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)", version)
    if match is None:
        fail(f"version [{version}] in package.json is not a MAJOR.MINOR.PATCH string")
    major, minor, patch = (int(part) for part in match.groups())  # type: ignore[union-attr]
    return f"{major}.{minor}.{patch + 1}"


def replace_version_field(path: Path, old_version: str, new_version: str) -> "None":
    """Replace the FIRST ``"version": "<old>"`` occurrence, byte-preserving the rest."""
    text = path.read_text(encoding="utf-8")
    pattern = re.compile(r'("version"\s*:\s*")' + re.escape(old_version) + r'(")')
    updated, count = pattern.subn(rf"\g<1>{new_version}\g<2>", text, count=1)
    if count != 1:
        fail(f'could not find a "version": "{old_version}" field in {path.name}')
    path.write_text(updated, encoding="utf-8")


def update_lockfile_version(old_version: str, new_version: str) -> "None":
    """Bump the package version in package-lock.json, byte-preserving the rest.

    npm records the package version in TWO places at the TOP of the lock file —
    the top-level ``"version"`` and ``packages[""]."version"`` — and both precede
    every dependency's own ``"version"`` in file order, so replacing the FIRST TWO
    occurrences of the old version updates exactly the root fields and nothing else.
    Refuse on any other count: fewer means the lock already drifted, more would
    risk clobbering a dependency that happens to share the version.
    """
    text = PACKAGE_LOCK_JSON.read_text(encoding="utf-8")
    pattern = re.compile(r'("version"\s*:\s*")' + re.escape(old_version) + r'(")')
    updated, count = pattern.subn(rf"\g<1>{new_version}\g<2>", text, count=2)
    if count != 2:
        fail(
            f"expected 2 root \"version\": \"{old_version}\" fields in "
            f"package-lock.json, replaced {count} — refusing to leave it drifted"
        )
    PACKAGE_LOCK_JSON.write_text(updated, encoding="utf-8")


def add_versions_entry(new_version: str, min_app_version: str) -> "None":
    versions = read_json(VERSIONS_JSON)
    if new_version in versions:
        fail(f"versions.json already has an entry for {new_version}")
    versions[new_version] = min_app_version
    # indent="\t" reproduces the file's tab-indented flat-map shape exactly.
    VERSIONS_JSON.write_text(json.dumps(versions, indent="\t") + "\n", encoding="utf-8")


def main() -> "None":
    package = read_json(PACKAGE_JSON)
    manifest = read_json(MANIFEST_JSON)

    old_version = package.get("version")
    if not isinstance(old_version, str):
        fail("package.json has no string `version`")

    # The three files must already agree before we bump — a mismatch means an
    # earlier bump half-landed, and blindly bumping would deepen the drift.
    if manifest.get("version") != old_version:
        fail(
            f"manifest.json version [{manifest.get('version')}] "
            f"disagrees with package.json [{old_version}] — refusing to bump on drift"
        )

    min_app_version = manifest.get("minAppVersion")
    if not isinstance(min_app_version, str):
        fail("manifest.json has no string `minAppVersion`")

    new_version = bumped_patch(old_version)

    print(f"bump-version: {old_version} -> {new_version} (minAppVersion {min_app_version})", file=sys.stderr)

    replace_version_field(PACKAGE_JSON, old_version, new_version)
    replace_version_field(MANIFEST_JSON, old_version, new_version)
    update_lockfile_version(old_version, new_version)
    add_versions_entry(new_version, min_app_version)

    # stdout carries ONLY the new version, for the caller to tag with.
    print(new_version)


if __name__ == "__main__":
    main()
