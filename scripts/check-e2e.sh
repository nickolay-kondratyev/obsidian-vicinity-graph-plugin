#!/usr/bin/env bash
# Type-check the e2e suite — but ONLY when it is actually checked out.
#
# WHY the guard: the e2e specs live in a PRIVATE git submodule (see .gitmodules).
# `release_update_tag.sh` and local dev run with the submodule present, so this
# type-checks it. GitHub CI (`.github/workflows/release.yml`) checks out the
# repo WITHOUT the submodule on purpose — e2e is the LOCAL release gate, not a
# CI concern (that workflow's header spells out WHY-NOT). Absent the submodule
# there is no `e2e/tsconfig.json`; skip cleanly instead of failing the build.
#
# The skip is guarded to a MISSING file only: when the submodule IS present we
# `exec tsc` and propagate its exit code, so real e2e type errors still fail.
set -euo pipefail

e2e_tsconfig="e2e/tsconfig.json"

if [[ ! -f "${e2e_tsconfig}" ]]; then
	echo "e2e/tsconfig.json absent (submodule not checked out) — skipping e2e type-check."
	exit 0
fi

exec tsc -noEmit -p "${e2e_tsconfig}"
