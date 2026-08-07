---
closed_iso: 2026-08-07T19:44:06Z
id: nid_2zm28ijiqp786yw6grwbvmffv_e
title: "Local pinning: human decisions (UX icon, docid minting, depth trio)"
status: closed
deps: []
links: [nid_ndoy0bq50w1p1qzd2i9di2fxo_e, nid_56ggaa2iz70di7xc3h8objt8n_e, nid_6eust4js4l85s163nezeq3v3g_e]
created_iso: 2026-08-07T19:30:09Z
status_updated_iso: 2026-08-07T19:44:06Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [decide]
---

DECIDE ticket for the local-pinning feature (planned from nid_ndoy0bq50w1p1qzd2i9di2fxo_e). Local pinning = a node pinned ONLY in the context of a specific MAIN (active) note; global pinning stays; a note can be both. Implementation tickets depend on this one; each question below has a RECOMMENDED default — confirming the defaults is enough to unblock.

Questions (also mirrored in .out/current_decision.md):

1. UI control & icon. Global pin today: hover PinButton (lucide "pin"/"pin-off") top-right of every node in src/view/NoteNode.tsx + a context-menu entry (pure decision logic in src/view/nodePinAction.ts). RECOMMENDED: add a SECOND hover button next to it for local pin using a visually distinct lucide icon (suggest "map-pin" for locally-pinned state, "map-pin-off"-style for unpin; exact glyph open), plus a second context-menu entry ("Pin for this note" / "Unpin for this note"). Both indicators can show at once when a node is both globally and locally pinned.
2. Docid minting on the MAIN note. Persisting a local pin needs docids for BOTH the target and the MAIN note (map is keyed by main docid). ensureDocId is a write intent; minting an id on the MAIN note is a side effect on a file the user did not click. RECOMMENDED: yes, mint (the user is acting "in the context of" that main note; refusal seam DocPersistEligibility applies to both docs, refuse with the existing not-pinnable notice pattern naming which doc refused).
3. Depth budget. Global pins traverse with the pinned depth trio (Pinned links out / embeds out / links in). RECOMMENDED: locally pinned centrals use the SAME pinned trio — no third trio, no new settings rows.
4. Local pin of the MAIN node itself. RECOMMENDED: hide/disable local-pin control on the MAIN node (self-pin is meaningless). Global pin on MAIN stays as today.
5. Where local pins are editable. You can only see/toggle a local pin while its main note is active (the graph context IS the main note). RECOMMENDED: yes — no separate management UI in V1.

## Acceptance Criteria

Human has confirmed or amended each recommendation; answers recorded in this ticket body; dependent implementation tickets updated if any default was overturned.


## Notes

**2026-08-07T19:44:06Z**

DECISIONS (owner, 2026-08-07) — all five recommendations CONFIRMED:
1. UI: second hover button beside the existing pin button + second context-menu entry ("Pin for this note" / "Unpin for this note"); lucide "map-pin" icon.
2. Docid minting: YES — ids MUST be assigned when absent, via obsidian-id-lib (the shared library keeps id addition locked/consistent across plugins). Applies to BOTH main and target docs.
3. Depth budget: KISS — no new settings; locally pinned notes are treated as PINNED and share the existing pinned depth trio.
4. MAIN node: no local-pin control on the MAIN node (self-pin meaningless); global pin on MAIN unchanged.
5. Edit scope: local pins visible/toggleable ONLY while their main note is active; no separate management UI in V1.

No implementation-ticket amendments needed — the tickets were written against these defaults. nid_56ggaa2iz70di7xc3h8objt8n_e (core) is now unblocked.

**2026-08-07T19:47:45Z**

ADDITIONAL DECISION (owner, 2026-08-07):
6. Unlinked visibility: a locally pinned note SHOWS UP even when it has NO link from the main (active) note — identical to global pinned behavior (a pinned root keeps its own vicinity even when disconnected from MAIN). MUST be captured by an explicit BDD test (core ticket nid_56ggaa2iz70di7xc3h8objt8n_e).
