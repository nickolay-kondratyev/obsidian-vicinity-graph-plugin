#!/usr/bin/env bash
# Run the e2e suite against the SUPPORTED FLOOR (`npm run test:e2e:floor`).
#
# WHY: `manifest.json` declares `minAppVersion` as a floor, and the default e2e
# run only ever exercises the newer pinned build — so nothing proves the plugin
# still works on the oldest Obsidian we claim to support. This is the same suite,
# same flags, only the downloaded binary differs. Extra args pass through, e.g.
#   npm run test:e2e:floor -- vicinityGraph.e2e.ts
#
# Expect some noise on a floor/newer run: a few specs match version-dependent
# Obsidian chrome (see the 1.13 caveat in scripts/setup-obsidian-bin.sh).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

OBSIDIAN_VERSION="$(bash "${REPO_ROOT}/scripts/obsidian-floor-version.sh")"
export OBSIDIAN_VERSION

# An already-set OBSIDIAN_PATH wins in run-e2e.sh, so the floor download would be
# skipped and this run would exercise SOME OTHER build. REFUSE rather than run:
# a green `test:e2e:floor` must mean the floor is green, and a warning that scrolls
# past minutes of Playwright output ahead of exit 0 does not say that.
# WHY-NOT trusting the binary: nothing here can tell which version it is.
if [[ -n "${OBSIDIAN_PATH:-}" ]]; then
	echo "run-e2e-floor: REFUSING — OBSIDIAN_PATH is set, so run-e2e.sh would use that binary," >&2
	echo "run-e2e-floor: not the manifest floor (${OBSIDIAN_VERSION}); a pass would not be a floor pass." >&2
	echo "run-e2e-floor: unset OBSIDIAN_PATH to auto-download the floor build (Linux only)," >&2
	echo "run-e2e-floor: or run 'npm run test:e2e' if you meant to use your own binary." >&2
	exit 1
fi

echo "run-e2e-floor: running against the manifest floor: Obsidian ${OBSIDIAN_VERSION}" >&2

exec bash "${REPO_ROOT}/scripts/run-e2e.sh" "$@"
