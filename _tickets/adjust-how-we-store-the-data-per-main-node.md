---
closed_iso: 2026-08-10T03:21:27Z
id: nid_vb246h5pr4609hid76ts1ufe5_e
title: Adjust how we store the data per main node
status: closed
deps: []
links: [nid_cdoymzgq5kjh5d10q1tkavnsy_e, nid_8f8ey41extajt08zphwwxhnwq_e]
created_iso: '2026-08-07T21:28:00Z'
status_updated_iso: 2026-08-10T03:21:27Z
type: task
priority: 1
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
TASK: **PLAN**. Lets clarify any gaps that exist for this ticket
  (if you need to explore code base use cheaper Explore-cheap sub-agent)
  ask human any questions that come up that require human decision.
  Finally create detailed plan with requirements of what we want to achieve
  and steps of execution and put it into a new ticket 
  (or multiple tickets if it warrants a split across multiple tickets).
  Close this ticket after planning is complete.


Right now we store the data into data.json (as far as I understand).

However, as we expand what we store we will likely want to store the data into a separate hidden folder. The path of folder will be `${VAULT_PATH}/.plugin_data/vicinity_graph/` and then store the data with one JSON document per ID. 

The individual settings for a file will be stored in a id based file in path

`${VAULT_PATH}/.plugin_data/vicinity_graph/per_file/<ID>.json`

ID is the stable identifier that gets assigned to the file when we modify it.

## Notes

**2026-08-10T02:23:19Z**

PLANNING IN PROGRESS — blocked on owner decisions.

Explored current persistence: ONE data.json via Plugin.saveData/loadData, loaded
whole into memory, rewritten wholesale via PluginDataStore (SerialPromiseChain).
Holds: global settings (globalDepths/globalView/nodeExclusion) + 3 docid-keyed maps:
pins (global set), localPins (main->targets), nodeOverrides (docid->{sizePx,content}).
Docids are already filename-safe (^[A-Za-z0-9_-]{1,120}$ via DocPersistEligibility),
so <docid>.json needs no escaping. Vault-root .plugin_data/ requires vault.adapter raw
I/O (saveData/loadData only reach the plugin folder). Driving ticket for "expand what we
store" is nid_rnghlzs0uejjlbd5a4bjkq7eg_e (per-main local control overrides).

Key tension: global facts (settings + the SET of globally-pinned docids) are needed in
full on every build; sharding a global set one-file-per-id turns "list all pins" into
"scan every file at startup" -> need a global index. Per-doc/per-main facts (size/content
override, localPins, future local overrides) can load lazily via the existing
DocIdMapWarmer path.

4 decisions written to .out/current_decision.md (D1 location, D2 scope, D3 one-file-both-
roles, D4 migration), each with a recommendation. Awaiting owner reply. Do NOT close until
answered and the plan ticket is created.

**2026-08-10T03:21:27Z**

PLANNING COMPLETE — owner answered all 4 decisions (R1..R4, defaults) + 2 additions.

Decided storage model:
- data.json (.obsidian/plugins/, Obsidian-managed): TRULY-global config dials only
  (globalDepths, globalView, nodeExclusion). Accepted: these don't sync when .obsidian
  is excluded.
- ${VAULT}/.plugin_data/vicinity_graph/global.json: the global pinned SET (vault content,
  syncs everywhere, one cheap read).
- ${VAULT}/.plugin_data/vicinity_graph/per_file/<docid>.json: per-docid, BOTH roles -
  subject (sizePx/content override) AND main-context (localPins as main + reserved
  localControls slot for the local-overrides feature).
Owner additions:
- Every .plugin_data file uses a version ENVELOPE { "v1": {...} } (dispatch on version key;
  enables non-additive migrations later).
- Merge-conflict resilience: a file that won't parse (git/Syncthing conflict markers, etc.)
  is QUARANTINED -> renamed <base>_malformed_<YYYY-MM-DDTHH-mm-ss><ext>, treated as absent,
  one UserNotice. Never delete user bytes.
- Clean break, no migration (pre-release): old data.json pins/overrides/localPins reset once.

Split into 2 implementation tickets (linked, deps wired):
- nid_cdoymzgq5kjh5d10q1tkavnsy_e - VaultFileStore primitive (adapter-backed, versioned,
  atomic write, per-key serial chain, malformed quarantine, Fake + tests). No user-visible
  change alone.
- nid_8f8ey41extajt08zphwwxhnwq_e - move pins/nodeOverrides/localPins onto it; rewire
  PluginDataStore/PersistenceServices/DocIdMapWarmer read path/OrphanSweeper/forgetDocs +
  localPins target reverse-index; clean-break data.json; docs + e2e. DEPENDS ON the primitive.
Also wired: nid_rnghlzs0uejjlbd5a4bjkq7eg_e (local control overrides) now DEPENDS ON the
migration ticket (it fills the reserved localControls slot).

Decision record: .out/current_decision.md (git-ignored).

**2026-08-10T15:51:22Z**

REFINEMENT (2026-08-10, owner): drop global.json. Keep the global pinned SET (pins) in
data.json under Obsidian's management (one cheap in-memory read, no per-file scanning).
So only nodeOverrides + localPins (+ future localControls) move to
.plugin_data/vicinity_graph/per_file/<docid>.json; `pins` does NOT move. Tradeoff accepted:
global pins, like the config dials, don't sync when .obsidian is excluded.
Ticket nid_8f8ey41extajt08zphwwxhnwq_e (and the global.json mention in
nid_cdoymzgq5kjh5d10q1tkavnsy_e) updated accordingly.
