#!/usr/bin/env bash
# Wire up the local Obsidian dev vault for manual smoke testing.
#
# WHY this script exists: `.dev-vault/` is gitignored (local-only), so a clean
# checkout has no vault to open, and the plugin has to be built + copied in
# before Obsidian can load it. This script makes the whole loop one command.
#
# Idempotent: fixtures and `.obsidian` config are (re)created ONLY when missing,
# so local enrichment of note1/note2/... is never clobbered. Re-run any time to
# rebuild and re-copy the plugin artifacts.
#
# Ref: docs-internal/tickets/ticket-step-03-human-smoke-run.md
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

VAULT=".dev-vault"
OBSIDIAN="${VAULT}/.obsidian"
PLUGIN_ID="$(node -p "require('./manifest.json').id")"

# write_if_missing PATH < CONTENT — create a text fixture only when absent.
write_if_missing() {
	local target="$1"
	if [[ -e "${target}" ]]; then
		echo "  keep   ${target} (already present)"
		cat >/dev/null # drain heredoc
		return
	fi
	mkdir -p "$(dirname "${target}")"
	cat >"${target}"
	echo "  create ${target}"
}

echo "==> Ensuring dev-vault fixtures in ${VAULT}/"

write_if_missing "${VAULT}/note1.md" <<'EOF'
Central note for the step-03 debug harness.

Links out: [[note2]] and [[note3]].

Embedded attachment (first-image candidate): ![[pic.png]]
EOF

write_if_missing "${VAULT}/note2.md" <<'EOF'
Backlink to [[note1]] (incoming edge for the harness).
EOF

write_if_missing "${VAULT}/note3.md" <<'EOF'
Leaf note: reachable from note1 (body link) and from test.canvas (file node).
EOF

write_if_missing "${VAULT}/test.canvas" <<'EOF'
{
	"nodes": [
		{ "id": "n1", "type": "file", "file": "note1.md", "x": 0, "y": 0, "width": 300, "height": 200 },
		{ "id": "n2", "type": "file", "file": "note3.md", "x": 400, "y": 0, "width": 300, "height": 200 },
		{ "id": "n3", "type": "text", "text": "Text node with a [[note2]] wikilink — skipped in V1.", "x": 0, "y": 300, "width": 300, "height": 100 }
	],
	"edges": []
}
EOF

# pic.png: a 1x1 transparent PNG — the first-image attachment candidate for note1.
if [[ -e "${VAULT}/pic.png" ]]; then
	echo "  keep   ${VAULT}/pic.png (already present)"
else
	base64 -d >"${VAULT}/pic.png" <<'EOF'
iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==
EOF
	echo "  create ${VAULT}/pic.png"
fi

echo "==> Ensuring minimal .obsidian config"
write_if_missing "${OBSIDIAN}/app.json" <<'EOF'
{}
EOF
write_if_missing "${OBSIDIAN}/appearance.json" <<'EOF'
{}
EOF
# Auto-enable our community plugin so the vault loads it without manual toggling.
write_if_missing "${OBSIDIAN}/community-plugins.json" <<EOF
[
  "${PLUGIN_ID}"
]
EOF

echo "==> Building plugin (npm run build → copies artifacts into the vault)"
mkdir -p .tmp
if npm run build >.tmp/setup-dev-vault-build.log 2>&1; then
	echo "  build OK — artifacts copied to ${OBSIDIAN}/plugins/${PLUGIN_ID}/"
else
	echo "  BUILD FAILED — see .tmp/setup-dev-vault-build.log" >&2
	tail -n 20 .tmp/setup-dev-vault-build.log >&2
	exit 1
fi

cat <<EOF

============================================================
 Dev vault ready. Open this folder as a vault in Obsidian:

   ${REPO_ROOT}/${VAULT}

 Manual smoke test (step-03 exit criteria):

 1. Enable "Neighborhood Graph" if not already
    (Settings → Community plugins). Turn OFF Restricted mode.
 2. Open note1.md. Run command palette →
    "Neighborhood Graph: Debug: log neighborhood graph for active file".
    Open devtools console (Ctrl/Cmd+Opt+I) and expect:
      - nodes: note1, note2, note3, test.canvas
      - note1's first image attachment = pic.png
      - no errors in the console
 3. Leave the vault open ~15s after the plugin loads and confirm
    the orphan sweep runs (delayed + chunked, no console errors).

 Record the result in:
   docs-internal/tickets/ticket-step-03-human-smoke-run.md
============================================================
EOF
