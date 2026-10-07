---
id: nid_kje16wg2g49zt951lcvfcei2c_e
title: "Relationships: send store:false so OpenAI does not keep copies of note text?"
status: open
deps: []
links: []
created_iso: 2026-10-07T15:56:45Z
status_updated_iso: 2026-10-07T15:56:45Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
parent: nid_fc47gtxej6z7fqc53bflme8p5_e
tags: [relationships, decide, need-human]
---

Plain version: by default, OpenAI's Responses API keeps a copy of each request and response on its side. The AI namer sends the FULL text of both notes. Adding `"store": false` to the request asks OpenAI not to keep it. We lose nothing, because we never chain responses.

- A (recommended): add `store: false`. It is a one-line change in `src/adapters/openAiResponses.ts` plus a test.
- B: keep the request as ticket 3/4 spelled it out.

Reply A or B. The live-call ticket nid_g0inqme2ol16xsrcg89g3kks4_e records whether OpenAI accepts `store: false` with gpt-6-luna.


## Fact from the live call (2026-10-07)
gpt-6-luna accepts `store: false` (the response echoed `store: false`). See nid_g0inqme2ol16xsrcg89g3kks4_e. Still waiting on the human's A/B answer.
