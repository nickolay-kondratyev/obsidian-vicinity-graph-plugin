#!/usr/bin/env bash
# Entry point for the Playwright e2e suite (`npm run test:e2e`).
#
# Ensures a real Obsidian binary is available before running: when OBSIDIAN_PATH
# is unset it auto-downloads a pinned build via setup-obsidian-bin.sh (Linux /
# Docker); an already-set OBSIDIAN_PATH is honoured untouched. Then seeds the dev
# vault, type-checks the specs, and runs Playwright. Extra args pass through, e.g.
#   npm run test:e2e -- vicinityGraph.e2e.ts
# VICINITY_E2E_VAULT (opt-in) drives an arbitrary vault in place instead of the
# dev vault — see the README e2e section.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

if [[ -z "${OBSIDIAN_PATH:-}" ]]; then
	OBSIDIAN_PATH="$(bash scripts/setup-obsidian-bin.sh)"
	export OBSIDIAN_PATH
fi

# Headless environments (Docker / CI) have no display server, so Electron must
# render via Chromium's offscreen Ozone backend or it dies on boot ("Missing X
# server or $DISPLAY"). Default those flags when NO display is detected; an
# explicit OBSIDIAN_E2E_EXTRA_ARGS always wins (override for a real/GPU display).
if [[ -z "${OBSIDIAN_E2E_EXTRA_ARGS:-}" && -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" ]]; then
	export OBSIDIAN_E2E_EXTRA_ARGS="--ozone-platform=headless --disable-gpu"
	echo "run-e2e: no display detected — using headless Obsidian flags: ${OBSIDIAN_E2E_EXTRA_ARGS}" >&2
fi

# VICINITY_E2E_VAULT drives an arbitrary vault IN PLACE, so the dev vault is never
# opened — seeding it would be pointless work. The plugin bundle is still built so
# a symlinked install inside that vault picks up the current code.
if [[ -n "${VICINITY_E2E_VAULT:-}" ]]; then
	echo "run-e2e: VICINITY_E2E_VAULT set — skipping dev-vault seeding: ${VICINITY_E2E_VAULT}" >&2
	npm run build
else
	npm run setup:dev-vault
fi
# WHY-NOT a `tsc -p e2e/tsconfig.json` line here: both branches above run
# `npm run build`, whose `check` step now type-checks `e2e/` too. Repeating it
# would only make every e2e run slower.
exec npx playwright test --config e2e/playwright.config.ts "$@"
