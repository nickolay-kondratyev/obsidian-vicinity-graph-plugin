---
id: nid_80xc6z8umlpo1x6u4p1v7eb22_e
title: "Relationships 4/4: top-right Relationships menu (auto toggle, model, effort, status) + auto mode end to end"
status: open
deps: [nid_cbnhpdfn4myqfzqr8weyg7kq5_e]
links: []
created_iso: 2026-10-06T23:04:40Z
status_updated_iso: 2026-10-06T23:04:40Z
type: task
priority: 2
assignee: nickolaykondratyev
parent: nid_fc47gtxej6z7fqc53bflme8p5_e
tags: [relationships]
---

Part 4/4 of the named-relationships epic. Read the parent ticket first.

## Goal
The top-right "Relationships" menu in the graph, the API key setting, and auto mode end to end.

## Settings (declared once, per CLAUDE.md "Settings rows/values")
- New spec leaves in `SETTINGS_SPEC` + `src/engine/settingsProductDefaults.test.ts`:
  - auto toggle (default OFF, persisted);
  - model slug (default `gpt-6-luna`);
  - reasoning effort (default `medium`);
  - the API key's SECRET NAME (default empty → env fallback).
- A new "Relationships" group in `src/view/settingsRows.ts` (`SETTINGS_GROUPS`). The top-left toolbar does NOT
  show it; the group declares that the top-right menu presents it.
- API key row: the settings tab uses Obsidian's `SecretComponent` (`setting.addComponent(...)`), which lets
  the user pick or create a secret in Obsidian's keychain. Only the secret NAME goes to `data.json`;
  the key itself never does.
  - In the in-graph menu, prefer mounting the same `SecretComponent` into a ref'd element.
  - If that's impractical, show a status + an "Open settings" button and use the documented allowlist
    escape hatch in `src/view/settingsRowSpecCoverage.test.ts` / parity, with a written reason.
- Model: a typed field, committed on blur (CLAUDE.md typed-fields rule).
- Toggle description: it sends both notes' full text to OpenAI for the edges shown, and adds an `id` to
  the frontmatter of notes it names.

## Menu
- A collapsible menu in the graph's TOP-RIGHT corner (`src/view/VicinityGraphFlow.tsx`). Today that `Panel`
  only holds the hidden-orphan badge, and the settings toolbar is top-left.
- Status line:
  - "Naming 3 of 12…";
  - "Named 12 this session (≈N tokens)";
  - or task 3/4's plain-language error and how to fix it.
- One Notice per session per error kind, no spam.
- AI labels look different on the edge (e.g. italic + small marker). The drawer (task 2/4) shows the
  model and allows rename/clear.

## Wiring
- `GraphViewController`: after each build + name resolution, if the toggle is ON, hand the visible
  eligible edges to `AiRelationshipQueue`. Toggle OFF drops queued (not in-flight) work.
- README "Relationships" section covering syntax, manual, AI, the `parent` default and the key setup
  (secret or `OPENAI_API_KEY`). Include the network/data disclosure Obsidian's developer policy
  requires: what is sent, to whom, only when ON, and that the key is kept in Obsidian's keychain or the
  env, never in the vault.

## Acceptance
- Component tests for the menu (jsdom). Settings parity/coverage suites green.
- e2e with NO live calls: inject a fake namer through an existing e2e seam if one exists, otherwise a
  local stub HTTP server; pick the simpler and note why.
  - Toggle ON → an AI label appears on an eligible edge;
  - none on an empty-note edge, a grouped-note edge, or an edge with `rel:: [[x]]`;
  - toggle OFF → no new requests.
- `npm run test:all` green.
