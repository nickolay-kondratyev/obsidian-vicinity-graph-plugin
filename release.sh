#!/usr/bin/env bash
# Pre-publish release gate (`./release.sh`).
#
# RUN THIS BEFORE PUBLISHING A RELEASE UPWARDS (cutting a GitHub Release / community
# submission — the "later" steps in docs-internal/RELEASE_CHECKLIST.md). It is the
# ONE command that proves the plugin is green on BOTH Obsidian builds we ship
# against, so a release engineer does not have to remember two e2e commands.
#
# WHY this exists as its own script, separate from `npm run test:all`:
#   - `npm run test:all` is the EVERY-CHANGE dev gate: it runs e2e on the pinned
#     build only, because the floor run is a SECOND ~200MB Obsidian download plus a
#     full second suite run — too costly to pay on every change.
#   - The two-version matrix (floor + pinned) is a RELEASE concern: it catches
#     issues that only appear on the oldest Obsidian we claim to support
#     (`manifest.json` minAppVersion) or only on the newer pinned build. So it lives
#     here, gated behind a release-named entry point, NOT on the hot path.
# This split is documented next to the "When to run npm run test:e2e" guidance in
# README.md and CLAUDE.md — keep those three in agreement.
#
# What it runs, in order (cheapest, version-independent gates first so a type error
# does not cost two Obsidian downloads):
#   1. check   — tsc -noEmit for src/ + e2e/           (fail-fast)
#   2. unit    — vitest run                            (fail-fast)
#   3. e2e MATRIX — the SAME Playwright suite on each shipped Obsidian build:
#        - pinned default (scripts/setup-obsidian-bin.sh)
#        - manifest floor  (scripts/run-e2e-floor.sh, derived from minAppVersion)
#      Both arms run even if the FIRST arm fails, then a per-version summary is
#      printed — the whole point is to SPOT which build breaks, which a fail-fast
#      that stopped after the pinned arm would hide.
#
# A floor-only red (pinned green, floor red) is usually a real floor regression —
# but a few specs match Obsidian's own chrome, which moves between releases (see the
# 1.13 slider-readout caveat in scripts/setup-obsidian-bin.sh and the WHY block in
# e2e/settingsUxVisual.e2e.ts). The per-version summary NAMES which build failed so
# that call is made with the version in hand, not guessed.
#
# WHY-NOT an `npm run test:e2e:matrix` alias: an npm script invites use on the hot
# path, which is exactly what the cost split above rules out. The release-named
# script keeps the intent — run at release time — legible.
#
# WHY-NOT reusing `npm run test:all -- --with-floor`: that stops at the FIRST failing
# stage, so a red pinned arm means the floor arm never runs and the release engineer
# never learns whether the floor is also broken. Release triage wants BOTH results.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${REPO_ROOT}"

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
	# Non-zero, but 0 is reserved for "both green"; use 1 as the aggregate failure.
	exit 1
fi

echo "" >&2
echo "release: MATRIX GREEN on both builds. Continue with docs-internal/RELEASE_CHECKLIST.md." >&2
