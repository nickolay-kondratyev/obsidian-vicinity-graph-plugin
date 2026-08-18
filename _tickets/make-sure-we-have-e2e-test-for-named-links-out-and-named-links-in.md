---
closed_iso: 2026-08-18T15:06:32Z
id: nid_wecll6kqjlq3jmdkudq092xte_e
title: Make sure we have e2e test for named links out and named links in
status: closed
deps: []
links: []
created_iso: '2026-08-18T14:55:24Z'
status_updated_iso: 2026-08-18T15:06:32Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Make sure we have an e2e integration test for named links out and named links in .

--------------------------------------------------------------------------------
USE CASE:
note: A.md
```
supports::[[B]]
```

note: B.md
```
supports::[[C]]
```

C exists.

Went to A as the main note. Put links out at 2.
EXPECTED: C is visible.
ACTUAL: C is not visible.
--------------------------------------------------------------------------------

Lets make sure we have a e2e integration test that reproduces this. And THEN Root cause and fix.

--------------------------------------------------------------------------------
## Resolution (2026-08-18)

**e2e coverage added: `e2e/namedLinksDepth.e2e.ts`** (3 tests, real Obsidian, all
against the exact fixture shape from the use case — `supports::[[x]]`, no space
after `::`):

1. **Named links OUT (the reported repro, verbatim gesture):** product defaults +
   `linkDepthOut: 2`, main = chain head → both hops visible, tail included.
2. **Named links IN:** every dial 0 except `namedDepthIn: 2`, main = chain tail →
   both upstream notes visible via the named-incoming channel alone.
3. **Live-edit path:** graph already open, a NEW note minted and a named link
   appended mid-session (`vault.create` + `vault.modify`) → the depth-2 reach
   updates live (exercises the named index's `changed` freshness + rebuild fan-out,
   which a cold boot never touches).

**All three tests PASS on current HEAD — the reported ACTUAL (C not visible) does
NOT reproduce, so there was nothing to root-cause into a fix.** The engine layer
already had the chain covered (`src/engine/namedRelationships.test.ts` walks a
named chain to depth 3 over Fake providers); what was missing — and is now locked —
was the real-Obsidian half (metadata cache + eager `NamedRelationshipsIndex` +
rendered nodes).

Verified: `npm run check`, `npm test` (2415 passing), and
`npm run test:e2e -- namedLinksDepth.e2e.ts` all green.

**If the failure is still observed in the real vault**, reopen with: the exact
note contents (bullets/frontmatter/folders matter), the persisted `data.json`
depth dials (older data may carry a `namedDepthOut` ≠ today's default of 2 — but
plain links out 2 alone should still reach C: a named link also rides the plain
link channel), the vault's node-cap/exclusion settings (a big vicinity can
TRUNCATE a depth-2 node by priority — by design, shown by the toolbar count), and
the Obsidian version. Whether B itself was visible is the key bisecting fact.
