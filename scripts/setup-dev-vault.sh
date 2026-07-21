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

# copy_if_missing SRC DEST — copy a binary fixture (e.g. an image) only when DEST is absent.
copy_if_missing() {
	local src="$1" dest="$2"
	if [[ -e "${dest}" ]]; then
		echo "  keep   ${dest} (already present)"
		return
	fi
	mkdir -p "$(dirname "${dest}")"
	cp "${src}" "${dest}"
	echo "  create ${dest}"
}

echo "==> Ensuring dev-vault fixtures in ${VAULT}/"

write_if_missing "${VAULT}/note1.md" <<'EOF'
Central note for the step-03 debug harness.

Links out: [[note2]] and [[note3]].

Embedded attachment (first-image candidate):

![[pic.jpg]]
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

# pic.jpg: a tiny recognizable public-domain photo (NASA "Blue Marble" Earth,
# Apollo 17) — the first-image attachment candidate for note1. Sourced once
# from Wikimedia Commons and committed small under scripts/dev-vault-fixtures/
# so a clean checkout doesn't need network access to build the vault.
copy_if_missing "scripts/dev-vault-fixtures/pic.jpg" "${VAULT}/pic.jpg"

# --- step-05 fixtures: rich rendering smoke-run material ---------------------
# Exercises: 2+ folder group (projects/), singleton folder (solo/), frontmatter
# titles (incl. whitespace that must render trimmed), duplicate links (edge
# count badge), bidirectional links (mirrored curves), and several attachment
# types (icon strip). New notes link TO note1 (incoming edges) on purpose:
# note1.md is never rewritten once present, so they must pull themselves into
# its vicinity rather than rely on edits to note1.

write_if_missing "${VAULT}/projects/alpha.md" <<'EOF'
---
title: Project Alpha (fm title)
---
Folder-group member (projects/ has 2 notes → renders as a group).

Duplicate link for the edge-count badge: [[note1]] and again [[note1]].

Bidirectional intra-group link: [[beta]].

Attachment types for the icon strip: ![[pic.jpg]], ![[report.pdf]], ![[data.csv]].
EOF

write_if_missing "${VAULT}/projects/beta.md" <<'EOF'
Second projects/ member. Links back to [[alpha]] (bidirectional pair) and to [[note1]].
EOF

write_if_missing "${VAULT}/solo/gamma.md" <<'EOF'
---
title: "  Gamma (solo, trimmed title)  "
---
Singleton folder note: solo/ has one note → breadcrumb title, no group box.
Links to [[note1]].

Second recognizable image, so the thumbnail feature isn't only exercised by one shared file: ![[pic2.jpg]].
EOF

write_if_missing "${VAULT}/assets/data.csv" <<'EOF'
id,name
1,alpha
2,beta
EOF

# pic2.jpg: second tiny recognizable public-domain photo (NASA Apollo 11,
# "Buzz Aldrin on the Moon") — solo/gamma's embedded image.
copy_if_missing "scripts/dev-vault-fixtures/pic2.jpg" "${VAULT}/assets/pic2.jpg"

# report.pdf: minimal valid single-page PDF — a non-image attachment type.
write_if_missing "${VAULT}/assets/report.pdf" <<'EOF'
%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj
trailer<</Root 1 0 R>>
%%EOF
EOF

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

 1. Enable "Vicinity Graph" if not already
    (Settings → Community plugins). Turn OFF Restricted mode.
 2. Open note1.md. Run command palette →
    "Vicinity Graph: Debug: log vicinity graph for active file".
    Open devtools console (Ctrl/Cmd+Opt+I) and expect:
      - nodes: note1, note2, note3, test.canvas
      - note1's first image attachment = pic.jpg
      - no errors in the console
 3. Leave the vault open ~15s after the plugin loads and confirm
    the orphan sweep runs (delayed + chunked, no console errors).

 Step-05 smoke material (open note1's vicinity graph):
   - projects/ (alpha, beta) → folder group; alpha↔beta bidirectional
   - alpha → note1 twice → edge count badge "2"
   - alpha: frontmatter title + png/pdf/csv attachment strip
   - solo/gamma → singleton folder breadcrumb, trimmed fm title

 Record the result in:
   docs-internal/tickets/ticket-step-03-human-smoke-run.md
============================================================
EOF
