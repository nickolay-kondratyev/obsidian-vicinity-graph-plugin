#!/usr/bin/env bash
# Entry point for the Playwright e2e suite (`npm run test:e2e`).
#
# Ensures a real Obsidian binary is available before running: when OBSIDIAN_PATH
# is unset it auto-downloads a pinned build via setup-obsidian-bin.sh (Linux /
# Docker); an already-set OBSIDIAN_PATH is honoured untouched. Then seeds the dev
# vault, type-checks the specs, and runs Playwright. Extra args pass through, e.g.
#   npm run test:e2e -- neighborhoodGraph.e2e.ts
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

if [[ -z "${OBSIDIAN_PATH:-}" ]]; then
	OBSIDIAN_PATH="$(bash scripts/setup-obsidian-bin.sh)"
	export OBSIDIAN_PATH
fi

npm run setup:dev-vault
npx tsc -p e2e/tsconfig.json
exec npx playwright test --config e2e/playwright.config.ts "$@"
