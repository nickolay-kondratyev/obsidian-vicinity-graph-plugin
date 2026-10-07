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

## Orchestrator decisions carried over from 3/4 (2026-10-07)
- **No AI repaint chain.** Every stored AI name repaints all views, and each repaint is a new build. Do NOT feed builds caused by AI-name writes to `AiRelationshipQueue`; only user- or vault-driven builds start AI work. WHY: the 20-requests-per-redraw cap is a cost ceiling per user action; a write → repaint → 20 more cascade would defeat it. Test it.
- **Effort values:** offer only low/medium/high until the live-call ticket nid_g0inqme2ol16xsrcg89g3kks4_e confirms xhigh/max.
- **Failure notice wording:** AI save failures currently reuse the "Relationship name" failure notice. 4/4 may give AI names their own declared label if the menu makes that clearer; it is not required.
- **Wiring left by 3/4:** in `main.ts`, build `ObsidianJsonHttp`, a `SecretOrEnvApiKeySource` over `app.secretStorage`, and the queue, plus the settings they need.

## Second question: send `store: false`? (added 2026-10-07)
Plain version: by default, OpenAI's Responses API keeps a copy of each request and response on its side. We send the FULL text of both notes. Adding `"store": false` to the request asks OpenAI not to keep it. We lose nothing, because we never chain responses.
- A (recommended): add `store: false`. It is a one-line change in `src/adapters/openAiResponses.ts` plus a test.
- B: keep the request exactly as ticket 3/4 spelled it out.
Reply A or B. If you pick A, 4/4 or whoever takes this ticket can add it.
- **Incomplete responses cost money on every redraw.** A response with `status:"incomplete"` and no message item maps to the non-fatal "unexpected-response", so that pair is asked again on every redraw. Treat it as "declined" (not asked again this session) and test it.
