#!/usr/bin/env bash
# Release driver (`./release_update_tag.sh`): green-gate, bump the PATCH version,
# tag it, and push — which fires the tag-triggered build workflow
# (.github/workflows/release.yml → a PUBLISHED GitHub Release with the raw assets).
#
# RUN THIS TO CUT A RELEASE. It is the ONE command that takes a clean `main` from
# "green on both shipped Obsidian builds" to "tag pushed", so a release engineer
# does not have to remember the gate, the four-file version bump, and the tag
# convention separately. What it does, in order:
#
#   1. Preflight (cheapest, fail first):
#        - current branch IS the origin default branch (resolved, not hard-coded);
#        - working tree is CLEAN;
#        - local is in sync with origin/<default> (fetch, then refuse if the branch
#          is ahead / behind / diverged).
#   2. Test matrix: the SAME two-version e2e gate this script has always run —
#        check → npm test → e2e on BOTH shipped builds (pinned + manifest floor),
#        both arms even if the first fails, with a per-version summary. A red matrix
#        stops the release BEFORE anything is bumped or pushed.
#   3. Version bump (only if green): scripts/bump-version.py revs the PATCH version
#        and updates all four release files coherently (package.json, manifest.json,
#        a new versions.json entry, and the two package-lock.json root versions so
#        the tag build's `npm ci` stays happy). See docs-internal/RELEASE_CHECKLIST.md §3.
#   4. Commit the four-file bump, then create an ANNOTATED tag equal to the new RAW
#        version string (NO `v` prefix — Obsidian/BRAT match the raw version).
#   5. Push the bump commit to origin/<default> and push the tag — printing exactly
#        what will be pushed first. Pushing the tag is what fires the workflow.
#
# WHY the e2e matrix lives here and NOT in CI: it needs a real Obsidian download +
# a display. CI (the tag workflow) runs only the fast headless gates before
# building. This script is the e2e AUTHORITY; run it in a display-capable env.
#
# WHY the two-version matrix (floor + pinned) instead of `npm run test:all`:
#   - `npm run test:all` is the EVERY-CHANGE dev gate: e2e on the pinned build only,
#     because the floor run is a SECOND ~200MB download plus a full second suite —
#     too costly on every change, and it stops at the FIRST red so a red pinned arm
#     hides whether the floor is also broken.
#   - The floor+pinned matrix is a RELEASE concern: it catches issues that only
#     appear on the oldest Obsidian we support (manifest minAppVersion) or only on
#     the newer pinned build. Both arms always run; the summary NAMES which broke.
# This split is documented next to the "When to run npm run test:e2e" guidance in
# README.md and CLAUDE.md — keep those three in agreement.
#
# A floor-only red (pinned green, floor red) is usually a real floor regression —
# but a few specs match Obsidian's own chrome, which moves between releases (see the
# 1.13 slider-readout caveat in scripts/setup-obsidian-bin.sh and the WHY block in
# e2e/settingsUxVisual.e2e.ts). The per-version summary NAMES which build failed so
# that call is made with the version in hand, not guessed.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${REPO_ROOT}"

# --- Preflight: refuse early, with actionable messages (POLS). ---------------
# Resolve the origin default branch instead of hard-coding `main`, so this keeps
# working if the default ever changes. Requires the remote HEAD ref to be known.
if ! DEFAULT_REF="$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null)"; then
	echo "release: REFUSING — cannot resolve the origin default branch." >&2
	echo "release: run 'git remote set-head origin --auto' (needs network) and re-run." >&2
	exit 1
fi
DEFAULT_BRANCH="${DEFAULT_REF#refs/remotes/origin/}"

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "${CURRENT_BRANCH}" != "${DEFAULT_BRANCH}" ]]; then
	echo "release: REFUSING — you are on branch=[${CURRENT_BRANCH}], not the default branch=[${DEFAULT_BRANCH}]." >&2
	echo "release: a release is cut from the default branch; run 'git switch ${DEFAULT_BRANCH}' and re-run." >&2
	exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
	echo "release: REFUSING — the working tree is not clean." >&2
	echo "release: commit or stash your changes so the release contains only the version bump." >&2
	git status --short >&2
	exit 1
fi

echo "release: fetching origin/${DEFAULT_BRANCH} to check sync..." >&2
git fetch --quiet origin "${DEFAULT_BRANCH}"

# --left-right --count HEAD...origin/<default> => "<ahead>\t<behind>".
SYNC_COUNTS="$(git rev-list --left-right --count "HEAD...origin/${DEFAULT_BRANCH}")"
AHEAD="$(echo "${SYNC_COUNTS}" | cut -f1)"
BEHIND="$(echo "${SYNC_COUNTS}" | cut -f2)"
if [[ "${AHEAD}" != "0" || "${BEHIND}" != "0" ]]; then
	echo "release: REFUSING — local ${DEFAULT_BRANCH} is out of sync with origin/${DEFAULT_BRANCH}" >&2
	echo "release:   ahead by [${AHEAD}] commit(s), behind by [${BEHIND}] commit(s)." >&2
	if [[ "${BEHIND}" != "0" ]]; then
		echo "release: pull first (e.g. 'git pull --ff-only') so the release builds on the latest." >&2
	fi
	if [[ "${AHEAD}" != "0" ]]; then
		echo "release: push or review your local commits before cutting a release from them." >&2
	fi
	exit 1
fi
echo "release: preflight OK — on ${DEFAULT_BRANCH}, clean, in sync with origin." >&2

# An OBSIDIAN_PATH set in the environment would make scripts/run-e2e.sh use that ONE
# binary for BOTH arms, and run-e2e-floor.sh would REFUSE (its honesty guard) — so a
# release matrix could never exercise two versions. Refuse up front with a clear
# message instead of dying mid-run inside the floor arm.
if [[ -n "${OBSIDIAN_PATH:-}" ]]; then
	echo "release: REFUSING — OBSIDIAN_PATH is set, so both matrix arms would use that ONE binary" >&2
	echo "release: (and the floor arm refuses outright). The release matrix must auto-download each" >&2
	echo "release: build; unset OBSIDIAN_PATH and re-run (Linux/CI auto-provisions both)." >&2
	exit 1
fi

run_fatal_stage() {
	# A version-independent gate: any failure aborts the release run immediately —
	# there is no point downloading Obsidian to run e2e over code that does not
	# type-check or whose unit suite is red.
	local name="$1"
	shift
	echo "" >&2
	echo "=== release: ${name} ===" >&2
	local status=0
	"$@" || status=$?
	if [[ "${status}" != "0" ]]; then
		echo "" >&2
		echo "release: FAILED at gate=[${name}] exit=[${status}] — stopping before the e2e matrix." >&2
		exit "${status}"
	fi
}

run_fatal_stage "check (tsc src + e2e)" npm run check
run_fatal_stage "unit + integration (vitest)" npm test

# --- e2e matrix: run BOTH arms, remember each result, summarise at the end. ---
# A failing arm does NOT abort the run: the release engineer must see the full
# floor-vs-pinned picture in ONE run. `set -e` would kill the script on the first
# non-zero, so each arm is guarded with `|| status=$?`.
FLOOR_VERSION="$(bash "${REPO_ROOT}/scripts/obsidian-floor-version.sh")"

pinned_status=0
echo "" >&2
echo "=== release: e2e matrix [1/2] pinned default build ===" >&2
npm run test:e2e || pinned_status=$?

floor_status=0
echo "" >&2
echo "=== release: e2e matrix [2/2] manifest floor build (${FLOOR_VERSION}) ===" >&2
npm run test:e2e:floor || floor_status=$?

format_arm() { [[ "$1" == "0" ]] && echo "PASS" || echo "FAIL (exit $1)"; }

echo "" >&2
echo "=== release: e2e matrix summary ===" >&2
echo "release:   pinned default : $(format_arm "${pinned_status}")" >&2
echo "release:   floor ${FLOOR_VERSION}   : $(format_arm "${floor_status}")" >&2

if [[ "${pinned_status}" != "0" || "${floor_status}" != "0" ]]; then
	echo "" >&2
	echo "release: MATRIX RED — do NOT publish until both builds are green (or a floor-only" >&2
	echo "release: red is confirmed to be version-dependent chrome, not a plugin regression)." >&2
	echo "release: nothing was bumped, committed, or pushed." >&2
	# Non-zero, but 0 is reserved for "both green"; use 1 as the aggregate failure.
	exit 1
fi

echo "" >&2
echo "release: MATRIX GREEN on both builds." >&2

# --- Version bump: only reached when the whole matrix is green. --------------
# scripts/bump-version.py revs the PATCH version across all four release files
# (package.json, manifest.json, versions.json, package-lock.json) preserving their tab indentation,
# and prints ONLY the new version string on stdout.
echo "" >&2
echo "=== release: bumping PATCH version ===" >&2
NEW_VERSION="$(python3 "${REPO_ROOT}/scripts/bump-version.py")"
echo "release: new version = ${NEW_VERSION}" >&2

# package-lock.json carries the SAME version in two spots; the bump keeps it in
# sync so the tag build's `npm ci` does not refuse (what broke Release 0.1.2).
git add package.json manifest.json versions.json package-lock.json
git commit --quiet -m "Release ${NEW_VERSION}"
# Annotated tag == the RAW version string (no `v` prefix), which is what
# .github/workflows/release.yml triggers on and what Obsidian/BRAT match.
git tag -a "${NEW_VERSION}" -m "Release ${NEW_VERSION}"
COMMIT_SHA="$(git rev-parse --short HEAD)"

# --- Push: print exactly what will be pushed, then push. ---------------------
echo "" >&2
echo "=== release: pushing ===" >&2
echo "release: will push the following to origin:" >&2
echo "release:   branch ${DEFAULT_BRANCH} -> origin/${DEFAULT_BRANCH}: commit ${COMMIT_SHA} (Release ${NEW_VERSION})" >&2
echo "release:   annotated tag ${NEW_VERSION} (fires .github/workflows/release.yml)" >&2

# --atomic: the branch commit and the tag land together or not at all. Pushing
# them as two commands would let the bump commit reach origin while the tag push
# fails (e.g. the branch moved under us, or a network drop between the two) —
# leaving a released-looking commit on the default branch with NO tag and so NO
# release fired, plus a stranded local tag. Both-or-neither keeps the remote
# consistent; on failure nothing is pushed and the run can simply be retried.
git push --atomic origin "${DEFAULT_BRANCH}" "refs/tags/${NEW_VERSION}"

echo "" >&2
echo "release: DONE — pushed Release ${NEW_VERSION} and its tag." >&2
echo "release: the tag build workflow will PUBLISH a GitHub Release with the raw" >&2
echo "release: assets (manifest.json, main.js, styles.css) — no manual publish needed." >&2
