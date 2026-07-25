---
id: nid_se3h2v45c10x9j42utbm8v2sn_e
title: "e2e: allow pointing the Obsidian harness at an arbitrary vault (VICINITY_E2E_VAULT)"
status: open
deps: []
links: []
created_iso: 2026-07-25T03:33:44Z
status_updated_iso: 2026-07-25T03:33:44Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [e2e, tooling]
---

Two edge-routing tickets have now hit the same wall: a symptom reported from a real personal vault cannot be reproduced under e2e, because `ObsidianHarness` can only ever drive `.dev-vault`.

Specifics (`e2e/obsidianHarness.ts`):
- `DEV_VAULT_DIR` is hardcoded to `<repo>/.dev-vault`, with no env var or constructor override.
- `prepareVaultCopy` `rm -rf`s the destination and full-copies the source into `.tmp/e2e/vault`. Pointing that at a real 457MB personal vault would be slow and destructive-adjacent, so it is not a matter of just swapping the path.

Consequence today: the edge-routing__06 acceptance criterion "screenshot smoke recorded from the real .out/public vault opened on clear-goals.md" could not be automated. It was resolved by recreating an equivalent scenario as a dev-vault fixture instead (the better outcome for that ticket), but the general capability is still missing: when a user reports a graph that looks wrong, there is no way to drive THEIR vault under the harness to see it.

Prior mention: `.ai_out/edge-routing__05/main/DETAILED_PLANNING__PUBLIC.md` proposed exactly this override and it was never built.

## Design

Add an opt-in `VICINITY_E2E_VAULT` env var read by `ObsidianHarness`.

Safety is the whole design, since the target may be a real vault the user cares about:
- NEVER copy or mutate the source vault when the override is set. Either open it READ-ONLY in place, or refuse and require an explicit second opt-in for the copy path.
- The existing `rm -rf` + full-copy behaviour must remain reachable ONLY for `.dev-vault`.
- The plugin still has to be installed into the target vault, which IS a write. Decide deliberately how that is handled (a symlinked plugin dir is a candidate) and document it.
- Fail loudly with an actionable message when the path does not exist or is not a vault.

Keep the default path completely unchanged: with the env var unset, behaviour must be byte-identical to today.

## Acceptance Criteria

- With `VICINITY_E2E_VAULT` unset, e2e behaviour is unchanged and the full suite is green.
- With it set to a scratch vault, a spec can open a note in that vault and screenshot the graph.
- A test or explicit guard proves the source vault is never `rm -rf`ed or otherwise mutated when the override is used.
- README e2e section documents the variable, including the safety caveat about pointing it at a real vault.

