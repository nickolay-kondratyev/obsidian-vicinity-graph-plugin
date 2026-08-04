#!/usr/bin/env bash
# Print the SUPPORTED Obsidian floor — manifest.json's `minAppVersion` — on stdout.
#
# WHY derived, not a second literal: the floor lives in manifest.json (it is what
# Obsidian enforces on install). Anything that wants to RUN against the floor
# (run-e2e-floor.sh) asks here, so bumping the manifest is the only edit needed.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# `node -e` is CommonJS even though package.json says "type": "module", so `require` is fine.
node -e 'process.stdout.write(require(process.argv[1]).minAppVersion)' "${REPO_ROOT}/manifest.json"
echo
