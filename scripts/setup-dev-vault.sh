#!/usr/bin/env bash
# Wire up the local Obsidian dev vault for manual smoke testing.
#
# WHY this script exists: `.dev-vault/` is gitignored (local-only), so a clean
# checkout has no vault to open, and the plugin has to be built + copied in
# before Obsidian can load it. This script makes the whole loop one command.
#
# Idempotent, with a SCRIPT-OWNED vs ENRICHABLE split (see each writer's WHY
# below): every fixture an e2e spec READS/MEASURES/COUNTS is script-OWNED —
# written through `write_fixture` (text) or `copy_fixture` (binary), so a fixture
# BODY edit reaches every existing vault on the next run instead of being a silent
# no-op. The only fixtures still (re)created ONLY when missing (`write_if_missing`
# / `copy_if_missing`) are the ones NO spec touches — the `stranded-*` + `p/ep/*`
# manual-smoke cluster and the `.obsidian` config — so local enrichment of those
# is never clobbered. Re-run any time to rebuild and re-copy the plugin artifacts.
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

# write_fixture PATH < CONTENT — a SCRIPT-OWNED fixture: created when absent AND
# rewritten whenever its content drifted from what this script declares.
#
# WHY a second writer: `write_if_missing` protects local enrichment, which is
# right for the notes a human explores with — but it makes a fixture BODY change
# a silent no-op on every vault that already exists. `e2e/` runs against a COPY
# of this vault, so a fixture an e2e spec READS — whether it MEASURES it (node
# sizes, edge geometry, outline density) or merely COUNTS it (node/edge/attachment
# counts, link shape) — must be the declared one on every machine, or the suite
# passes on a fresh checkout and fails on a developer's older vault with no clue
# why. So EVERY spec-read fixture below uses `write_fixture`; `write_if_missing`
# is reserved for fixtures no spec touches (ticket nid_v5510dvzp7nw9p4qrrpw7d35s_e).
write_fixture() {
	local target="$1" content
	content="$(cat)"
	# `$(cat file)` strips trailing newlines on BOTH sides, so the comparison and
	# the write below agree on exactly one terminating newline.
	if [[ -e "${target}" && "$(cat "${target}")" == "${content}" ]]; then
		echo "  keep   ${target} (matches the declared fixture)"
		return
	fi
	mkdir -p "$(dirname "${target}")"
	printf '%s\n' "${content}" >"${target}"
	echo "  write  ${target} (declared fixture)"
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

# copy_fixture SRC DEST — the binary analog of `write_fixture`: a SCRIPT-OWNED
# binary fixture, copied when absent AND re-copied whenever DEST drifted from SRC
# (`cmp -s` byte-compare). Used for the images an e2e spec MEASURES (a note's
# thumbnail, the outline-vs-image escape hatch), so swapping the committed source
# image reaches every existing vault instead of only fresh checkouts.
copy_fixture() {
	local src="$1" dest="$2"
	if [[ -e "${dest}" ]] && cmp -s "${src}" "${dest}"; then
		echo "  keep   ${dest} (matches the declared fixture)"
		return
	fi
	mkdir -p "$(dirname "${dest}")"
	cp "${src}" "${dest}"
	echo "  write  ${dest} (declared fixture)"
}

echo "==> Ensuring dev-vault fixtures in ${VAULT}/"

write_fixture "${VAULT}/note1.md" <<'EOF'
Central note for the step-03 debug harness.

Links out: [[note2]] and [[note3]].

Embedded attachment (first-image candidate):

![[pic.jpg]]
EOF

write_fixture "${VAULT}/note2.md" <<'EOF'
Backlink to [[note1]] (incoming edge for the harness).
EOF

write_fixture "${VAULT}/note3.md" <<'EOF'
Leaf note: reachable from note1 (body link) and from test.canvas (file node).
EOF

# test.canvas exercises BOTH canvas reference kinds the plugin must report
# identically on either link regime: file nodes (note1, note3) and a text-node
# wikilink (note2). Ticket nid_s676x55uojmtcwh9t4l9mc6zl_e.
write_fixture "${VAULT}/test.canvas" <<'EOF'
{
	"nodes": [
		{ "id": "n1", "type": "file", "file": "note1.md", "x": 0, "y": 0, "width": 300, "height": 200 },
		{ "id": "n2", "type": "file", "file": "note3.md", "x": 400, "y": 0, "width": 300, "height": 200 },
		{ "id": "n3", "type": "text", "text": "Text node with a [[note2]] wikilink — a real edge, on BOTH canvas link regimes.", "x": 0, "y": 300, "width": 300, "height": 100 }
	],
	"edges": []
}
EOF

# test2.canvas: a SECOND canvas, so the vault can exercise the partial-index case
# (Obsidian indexes canvases one file at a time, so a run can have one canvas in
# `resolvedLinks` and the other not — the regime must be decided per canvas).
# Deliberately reaches note2/note3, which puts it at depth 2 from note1 and so
# OUTSIDE the note1 vicinity the other specs count. Ticket nid_s676x55uojmtcwh9t4l9mc6zl_e.
write_fixture "${VAULT}/test2.canvas" <<'EOF'
{
	"nodes": [
		{ "id": "n1", "type": "file", "file": "note3.md", "x": 0, "y": 0, "width": 300, "height": 200 },
		{ "id": "n2", "type": "text", "text": "Second canvas, text node linking [[note2]].", "x": 0, "y": 300, "width": 300, "height": 100 }
	],
	"edges": []
}
EOF

# pic.jpg: a tiny recognizable public-domain photo (NASA "Blue Marble" Earth,
# Apollo 17) — the first-image attachment candidate for note1. Sourced once
# from Wikimedia Commons and committed small under scripts/dev-vault-fixtures/
# so a clean checkout doesn't need network access to build the vault.
# copy_fixture: note1's node MEASURES this as its thumbnail (vicinityGraph.e2e.ts),
# so a swapped source image must reach every existing vault, not just fresh ones.
copy_fixture "scripts/dev-vault-fixtures/pic.jpg" "${VAULT}/pic.jpg"

# --- step-05 fixtures: rich rendering smoke-run material ---------------------
# Exercises: 2+ folder group (projects/), singleton folder (solo/), frontmatter
# titles (incl. whitespace that must render trimmed), duplicate links (edge
# count badge), bidirectional links (mirrored curves), and several attachment
# types (icon strip). New notes link TO note1 (incoming edges) on purpose: each
# fixture pulls ITSELF into note1's vicinity, so it stays self-describing and does
# not depend on a matching edit to note1's body.

write_fixture "${VAULT}/projects/alpha.md" <<'EOF'
---
title: Project Alpha (fm title)
---
Folder-group member (projects/ has 2 notes → renders as a group).

Duplicate link for the edge-count badge: [[note1]] and again [[note1]].

Bidirectional intra-group link: [[beta]].

Attachment types for the icon strip: ![[pic.jpg]], ![[report.pdf]], ![[data.csv]].
EOF

write_fixture "${VAULT}/projects/beta.md" <<'EOF'
Second projects/ member. Links back to [[alpha]] (bidirectional pair) and to [[note1]].
EOF

write_fixture "${VAULT}/solo/gamma.md" <<'EOF'
---
title: "  Gamma (solo, trimmed title)  "
---
Singleton folder note: solo/ has one note → renders ungrouped, no group box.
Links to [[note1]].

Second recognizable image, so the thumbnail feature isn't only exercised by one shared file: ![[pic2.jpg]].
EOF

write_fixture "${VAULT}/assets/data.csv" <<'EOF'
id,name
1,alpha
2,beta
EOF

# pic2.jpg: second tiny recognizable public-domain photo (NASA Apollo 11,
# "Buzz Aldrin on the Moon") — solo/gamma's embedded image AND outline-cover's
# cover thumbnail, which nodeOutline.e2e.ts reads — so copy_fixture, not copy_if_missing.
copy_fixture "scripts/dev-vault-fixtures/pic2.jpg" "${VAULT}/assets/pic2.jpg"

# report.pdf: minimal valid single-page PDF — a non-image attachment type.
write_fixture "${VAULT}/assets/report.pdf" <<'EOF'
%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj
trailer<</Root 1 0 R>>
%%EOF
EOF

# --- edge-routing__03 tuning fixtures: medium (folder-group heavy) + dense -----
# Two extra vicinities used to tune the routing parameters and measure the pass
# on realistic obstacle sets. Both are self-contained (their members link only to
# their OWN hub, never to note1/crowd), so they never alter note1's vicinity or
# the pre-existing e2e assertions. Open hub-medium.md / zzdense-hub.md to inspect.
# `edgeRoutingEval.e2e.ts` opens each hub central and MEASURES the routing pass
# (dense also drives the perf budget), so the members define the measured graph —
# ALL of these are `write_fixture`, members included, even though no spec names
# an individual member/spoke.
#
# MEDIUM: a root hub + five 3-member folder groups, each member linking to the hub
# (cross-boundary edges collapse onto the group box) plus an inter-group ring —
# exercises collapsed group-box edge attachment across layered (INCLUDE_CHILDREN)
# and radial/force (SEPARATE_CHILDREN + projectedRootEdges).
echo "==> Ensuring medium folder-group routing fixture (hub-medium + grp-*/)"
write_fixture "${VAULT}/hub-medium.md" <<'EOF'
Medium routing fixture hub (edge-routing__03): five folder groups link inward.

Groups: [[ma1]] [[mb1]] [[mc1]] [[md1]] [[me1]].
EOF

# medium_group LETTER NEXT_LETTER — three members of grp-<LETTER>/, each linking to
# the hub, member 1 also linking to the next group's member 1 (inter-group ring).
medium_group() {
	local letter="$1" next="$2"
	write_fixture "${VAULT}/grp-${letter}/m${letter}1.md" <<EOF
Group ${letter} member 1. Hub [[hub-medium]]. Inter-group ring link [[m${next}1]].
EOF
	write_fixture "${VAULT}/grp-${letter}/m${letter}2.md" <<EOF
Group ${letter} member 2. Hub [[hub-medium]]. Intra-group link [[m${letter}1]].
EOF
	write_fixture "${VAULT}/grp-${letter}/m${letter}3.md" <<EOF
Group ${letter} member 3. Hub [[hub-medium]]. Intra-group link [[m${letter}2]].
EOF
}
medium_group a b
medium_group b c
medium_group c d
medium_group d e
medium_group e a

# DENSE: an ungrouped root hub with ~110 spokes (kept at vault root so they do NOT
# collapse into a folder group — the router then sees ~100 individual square
# obstacles once the default nodeCap of 100 applies). Each spoke also links a chord
# 7 ahead, so at outgoing depth 2 (which walks them) the chords cross the
# hub-centred disk and force genuine obstacle detours — the dense stress case for perf + route quality.
# `zz` prefix sorts them to the bottom of the file explorer so manual QA of the
# other fixtures stays uncluttered.
echo "==> Ensuring dense routing fixture (zzdense-hub + 110 ungrouped spokes)"
DENSE_COUNT=110
DENSE_CHORD_STEP=7
{
	echo "Dense routing hub (edge-routing__03): ~110 ungrouped spokes for perf + quality tuning."
	echo
	for i in $(seq 1 "${DENSE_COUNT}"); do
		printf 'Spoke [[%s]].\n' "$(printf 'zzdense-%03d' "${i}")"
	done
} | write_fixture "${VAULT}/zzdense-hub.md"

for i in $(seq 1 "${DENSE_COUNT}"); do
	name="$(printf 'zzdense-%03d' "${i}")"
	chord=$(( ((i - 1 + DENSE_CHORD_STEP) % DENSE_COUNT) + 1 ))
	chordname="$(printf 'zzdense-%03d' "${chord}")"
	printf 'Dense spoke %d. Hub [[zzdense-hub]]. Chord [[%s]].\n' "${i}" "${chordname}" \
		| write_fixture "${VAULT}/${name}.md"
done

# --- ticket-03 stranding fixture: folder-grouped hub + degree-1 leaf ----------
# Mirrors the public-vault "Enchiridion" bug without the private vault: a hub
# note sharing a folder (p/ep/ → 2-member group box) with a sibling fans out to
# 5 ungrouped root crowd notes plus ONE degree-1 leaf in a singleton subfolder.
# The old circular collide stranded the leaf far off the tall group container;
# with the AABB collide it must sit adjacent to the group. Self-contained
# (nothing links note1/hub-medium/zzdense).
#
# KEPT ON write_if_missing: this cluster is exercised ONLY by the manual smoke-run
# check below ("Ticket-03 stranding check"), never by an automated e2e assertion
# (no spec opens or counts it) — so a human can enrich it without the script
# clobbering their edits. If a future spec ever MEASURES it, move it to write_fixture.
echo "==> Ensuring ticket-03 stranding fixture (stranded-main + p/ep/)"
write_if_missing "${VAULT}/stranded-main.md" <<'EOF'
Ticket-03 stranding repro root. Open my vicinity graph with outgoing depth >= 2
(or open stranded-hub directly at default depths): the leaf [[enchiridion]]
must sit adjacent to the p/ep group box, with no long crossing edge.

Hub: [[stranded-hub]].
EOF

write_if_missing "${VAULT}/p/ep/stranded-hub.md" <<'EOF'
Grouped hub (p/ep has 2 notes → group box). Sibling [[stranded-sib]].

Crowd: [[stranded-crowd1]] [[stranded-crowd2]] [[stranded-crowd3]] [[stranded-crowd4]] [[stranded-crowd5]].

Degree-1 leaf in a singleton subfolder: [[enchiridion]].
EOF

write_if_missing "${VAULT}/p/ep/stranded-sib.md" <<'EOF'
Second p/ep member — makes the folder a 2-member group with a tall box.
EOF

write_if_missing "${VAULT}/p/ep/book/enchiridion.md" <<'EOF'
The Enchiridion (The Manual) mirror: degree-1 leaf, linked ONLY from
stranded-hub. Must rest adjacent to the p/ep group box, never mid-graph.
EOF

for i in 1 2 3 4 5; do
	printf 'Ticket-03 crowd note %d (ungrouped root leaf of stranded-hub).\n' "${i}" \
		| write_if_missing "${VAULT}/stranded-crowd${i}.md"
done

# --- node-outline fixtures: in-node heading outline + the image escape hatch ---
# Self-contained ON PURPOSE (they link only to each other, never to note1/crowd/
# hub-medium): the pre-existing e2e suites assert exact node counts for note1's
# vicinity, and a link into it would silently change them.
#
# Both are exercised as the MAIN (central) node, which is always sized at maxPx —
# the only deterministic way to land above the 104px density threshold that
# reveals the outline.
echo "==> Ensuring node-outline fixtures (outline-note + outline-cover)"

# outline-note: image AFTER the first heading -> the node shows the OUTLINE.
# 11 headings at levels 1-2 (so the list provably overflows a 160px node at the
# default depth of 2), one level-1 with two level-2 children (nesting), two
# level-3 headings (depth filter), and one heading carrying inline markdown
# (display stripping: it must render as "Status of outline-cover today").
write_fixture "${VAULT}/outline-note.md" <<'EOF'
# Overview

![[pic.jpg]]

The first image sits AFTER the first heading, so this note's node shows its
heading outline instead of a thumbnail.

## Background

Nested under Overview.

## Scope

Second child of Overview — proves the nesting is real.

### Deep detail one

Level 3: hidden at the default outline depth of 2.

# Method

## Status of [[outline-cover]] **today**

Inline markdown in the heading above must render stripped, while the RAW text
stays the key that opens this note at that heading.

## Data collection

### Deep detail two

Second level-3 heading.

# Results

## Findings

## Limitations

# Discussion

# Conclusion
EOF

# outline-cover: image BEFORE the first heading -> the node shows the IMAGE.
# This is the documented escape hatch for "I want the picture, not the outline".
write_fixture "${VAULT}/outline-cover.md" <<'EOF'
![[assets/pic2.jpg]]

# Cover heading

The first image sits BEFORE the first heading, so this note's node shows the
thumbnail and NO outline.

## Second heading
EOF

# --- edge-routing__06 fixture: facing-side crowding at a folder-group box -----
# WHY this exists: no other fixture can show the reported symptom (edges to a
# folder-group box attaching on a FAR side instead of the side facing their
# neighbour). The medium fixture's groups each carry ONE collapsed edge, and the
# dense fixture has no folder groups at all — so neither ever crowds one side of
# a group box. This one does, and is the automatable stand-in for the human's
# private-vault screenshot check.
#
# Shape (every NODE is one hop from the hub, but see the DEPTH note below):
#   - `facing/` holds the hub + 4 members → a real group box with members inset.
#   - The hub lives INSIDE the group, so each hub→neighbour link is a
#     cross-boundary edge that collapses onto the BOX (one edge per neighbour,
#     since collapsing unions by pair — 12 neighbours give 12 SEPARATE edges, far
#     more than the 3 boundary pins any single side carries).
#   - The neighbours all link one cluster mini-hub (`facing-near1`), so the force
#     layout packs them into a blob on ONE side of the box. That blob is what
#     makes "the facing side" unambiguous — the whole point of the measurement.
# DEPTH: view this at OUTGOING DEPTH 2. The cluster links are sibling links between
# depth-1 neighbours, and only WALKED links become edges — so at depth 1 they are not
# edges, exert no force, and the 12 neighbours spread evenly AROUND the box instead of
# crowding one side (i.e. the fixture silently stops testing what it exists to test;
# this cost the e2e a red assertion, ticket nid_uv3al1mhaxmz37ooiit15iq0w_e). Depth 2
# walks them and adds NO node, since every neighbour is already present at depth 1.
# Self-contained: nothing here links note1/hub-medium/zzdense/stranded.
echo "==> Ensuring facing-side crowding fixture (facing/hub-facing + facing-near*)"
FACING_MEMBER_COUNT=4
FACING_NEIGHBOUR_COUNT=12
FACING_CLUSTER_HUB="facing-near1"

{
	echo "Facing-side crowding hub (edge-routing__06). Inside facing/, so every link"
	echo "below crosses the group boundary and lands on the group BOX, one edge each."
	echo
	for i in $(seq 1 "${FACING_NEIGHBOUR_COUNT}"); do
		printf 'Neighbour [[facing-near%d]].\n' "${i}"
	done
} | write_fixture "${VAULT}/facing/hub-facing.md"

for i in $(seq 1 "${FACING_MEMBER_COUNT}"); do
	printf 'facing/ member %d — gives the group box real area and inset members. Hub [[hub-facing]].\n' "${i}" \
		| write_fixture "${VAULT}/facing/facing-m${i}.md"
done

# Each neighbour carries three headings: content-fit sizing renders a bare
# one-line note at ~minPx (40px), and at that scale the 12-node blob packs so
# tightly against the box corner that libavoid's cheapest pin for one edge is a
# WRAPPED border (the wrong-side wrap itself is a tracked routing follow-up).
# An outline-bearing node is floored at the preview reveal (122px border-box),
# which is the scale the crowd formation and the facing-side guard were tuned
# around.
FACING_NEIGHBOUR_BODY_PADDING='
# Alpha

## Beta

## Gamma'
for i in $(seq 1 "${FACING_NEIGHBOUR_COUNT}"); do
	name="facing-near${i}"
	if [[ "${name}" == "${FACING_CLUSTER_HUB}" ]]; then
		printf 'Facing neighbour %d — the cluster mini-hub the other neighbours link to.\n%s\n' "${i}" "${FACING_NEIGHBOUR_BODY_PADDING}" \
			| write_fixture "${VAULT}/${name}.md"
	else
		printf 'Facing neighbour %d (ungrouped root note). Cluster link [[%s]].\n%s\n' "${i}" "${FACING_CLUSTER_HUB}" "${FACING_NEIGHBOUR_BODY_PADDING}" \
			| write_fixture "${VAULT}/${name}.md"
	fi
done

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
   - solo/gamma → ungrouped singleton (no group box), trimmed fm title

 Node-outline check (open outline-note.md, then outline-cover.md):
   - outline-note's MAIN node lists its headings, nested, with no
     level-3 entry and "Status of outline-cover today" rendered stripped
   - the list scrolls; its scrollbar appears only while the node is hovered
   - clicking an entry opens the note AT that heading (check BOTH
     editing and reading view — Obsidian scrolls to and flashes it)
   - outline-cover's MAIN node shows the image, never an outline
     (true at the DEFAULT Preview = Auto; the pill can override it)
   - Auto is TIER-AWARE (nid_k2pa8khm6ugozmhkd6nlbdrq6_e): with
     outline-cover as MAIN, its NEIGHBOUR outline-note shows a
     thumbnail (not the outline document position would give a
     central); a headings-only neighbour anywhere in the vault is
     title-only at minPx. Pin it and its outline comes back.

 Preview-pill check (Node contents, on the settings tab AND in the
 in-view graph controls — one global value, two surfaces):
   - Outline: outline-cover's MAIN node swaps its image for its outline,
     AND every peripheral note with headings gains one (the pill
     overrides the tier rule, not just document position)
   - Image: outline-note's MAIN node swaps its outline for a thumbnail
   - back to Auto: both MAIN nodes return to what document position says,
     and the peripheral outlines disappear again
   - flipping the pill must NOT move any node (data-only refresh)
   - eyeball the pill in LIGHT and DARK: the selected segment's label
     must stay legible on the accent fill (--text-on-accent), and the
     unselected trough must read as an inset field

 Edge-routing facing-side check:
   - open facing/hub-facing.md at OUTGOING DEPTH 2 (depth 1 does not walk the
     cluster links, so no blob forms) → 12 separate edges reach the group box;
     each must attach on a border its own neighbour actually sits past

 Ticket-03 stranding check:
   - open stranded-main.md (outgoing depth >= 2) or stranded-hub.md →
     enchiridion sits adjacent to the p/ep group box (no long edge)

 Record the result in:
   docs-internal/tickets/ticket-step-03-human-smoke-run.md
============================================================
EOF
