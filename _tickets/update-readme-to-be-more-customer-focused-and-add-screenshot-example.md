---
closed_iso: 2026-08-12T01:30:57Z
session_ids: [{"a": "claude", "type": "execution", "id": "d677cbc1-705f-43cc-88e6-c9b6d26b1a14"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_ik7imr6294wnbvj633ccgqi2e_e
title: "update readme to be more customer focused and add screenshot example"
status: closed
deps: []
links: []
created_iso: 2026-08-12T01:26:04Z
status_updated_iso: 2026-08-12T01:30:57Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
---

Update the readme to be more customer focused.
Make it more concise.
Also we should mention that we have functionality of pinning per note instead of only global. 
--------------------------------------------------------------------------------
Add this screnshots to ./assets/images/for_readme/vicinity-graph-example-2026-Aug-11.png to readme as well to be shown as example of vicinity graph.
--------------------------------------------------------------------------------
We shouldnt mention implementation libraries much in readme, we should mention that we are able to click on the relationships, and that edges render in "clash avoidance" (word it better) with nodes.

## Resolution

`README.md` was rewritten to be shorter and customer-focused (roughly ~400 →
~180 lines). What changed:

- **Screenshot added** near the top, right under the intro, referencing the
  already-tracked `./assets/images/for_readme/vicinity-graph-example-2026-Aug-11.png`
  (confirmed committed via `git ls-files`; not gitignored). Replaced the old
  `> Screenshots: TBD.` placeholder.
- **Per-note (local) pinning** is now surfaced both in the "Why you'd want it"
  bullets ("Pinning — globally or per note") and given equal billing with the
  global pin in the condensed **Pinning** section.
- **Clicking relationships** is called out in "Interacting with the graph"
  ("Click a connector — opens a preview of that relationship…") and in the intro
  bullets ("every connector is clickable").
- **"Clash avoidance" reworded** — described as connectors that "route *around*
  your notes instead of cutting across them, so a busy graph stays readable."
- **Implementation-library detail removed.** The long "Bundled WebAssembly"
  section, React Flow / esbuild mentions, and the WASM-scanner notes were cut.
  Kept ONE concise **Third-party notice** paragraph naming libavoid-js only for
  LGPL-2.1 attribution — this is a legal requirement (the attribution lived
  ONLY in the README; `LICENSE.md` does not carry it), so it was preserved
  rather than dropped. This is the one judgment call made; if a NOTICE file is
  later added, this paragraph can shrink further.
- The exhaustive per-setting reference and the WASM safety breakdown were
  collapsed into a scannable **Settings** summary and a short **Scope & limits**
  list. No behavior claims were changed; detail lives in `docs-internal/`.