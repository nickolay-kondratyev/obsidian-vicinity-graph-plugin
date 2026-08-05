#!/usr/bin/env bash
# Run EVERY test gate in one go (`npm run test:all`).
#
# WHY: `npm test` is only the vitest half; the e2e suite is a separate command and
# `npm run check` is a third. "Did I run everything?" should be one command, not a
# checklist a person (or an agent) has to remember before calling a change done.
#
# Stages, in order — fail FAST, cheapest gate first, so a type error does not cost
# a full Obsidian download + Playwright run:
#   1. check  — tsc -noEmit for src/ and e2e/
#   2. unit   — vitest run (unit + integration + source-scan guards)
#   3. e2e    — Playwright against a REAL Obsidian (auto-provisions on Linux/CI)
#
# Flags:
#   --with-floor   also run the e2e suite against the manifest minAppVersion floor
#                  build. Off by default: it is the SAME suite on an older binary,
#                  a second full download + run, and belongs to release checks.
#
# Extra args are NOT passed through to a single stage on purpose — this target is
# "run everything"; use the individual npm scripts to narrow a run.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

WITH_FLOOR=0
for arg in "$@"; do
	case "${arg}" in
	--with-floor) WITH_FLOOR=1 ;;
	*)
		echo "test:all: unknown argument arg=[${arg}] (supported: --with-floor)" >&2
		exit 2
		;;
	esac
done

run_stage() {
	local name="$1"
	shift
	echo "" >&2
	echo "=== test:all: ${name} ===" >&2
	if ! "$@"; then
		echo "" >&2
		echo "test:all: FAILED at stage=[${name}] — stopping." >&2
		exit 1
	fi
}

run_stage "check (tsc src + e2e)" npm run check
run_stage "unit + integration (vitest)" npm test
run_stage "e2e (Playwright + real Obsidian)" npm run test:e2e
if [[ "${WITH_FLOOR}" == "1" ]]; then
	run_stage "e2e on manifest floor build" npm run test:e2e:floor
fi

echo "" >&2
echo "test:all: ALL STAGES PASSED" >&2
