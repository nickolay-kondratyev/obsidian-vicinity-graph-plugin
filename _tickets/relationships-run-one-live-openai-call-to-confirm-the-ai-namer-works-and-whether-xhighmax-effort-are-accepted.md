---
id: nid_g0inqme2ol16xsrcg89g3kks4_e
title: "Relationships: run one live OpenAI call to confirm the AI namer works (and whether xhigh/max effort are accepted)"
status: open
deps: []
links: []
created_iso: 2026-10-07T00:40:30Z
status_updated_iso: 2026-10-07T00:40:30Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
parent: nid_fc47gtxej6z7fqc53bflme8p5_e
tags: [relationships, decide, need-human]
---

Plain version: ticket 3/4 (nid_cbnhpdfn4myqfzqr8weyg7kq5_e) asks for ONE real call to OpenAI, with its cost written down. The agent sandbox has no OPENAI_API_KEY, so nobody has made that call yet. All 3/4 code is tested against fakes only.

What we need from you (human):
1. Make one live call with `gpt-6-luna` through the plugin's namer (or a curl against `POST https://api.openai.com/v1/responses` using the same request shape), on two small synthetic notes. Write the token usage and cost into this ticket.
2. Retry with `reasoning.effort` set to `xhigh` and to `max`. The model page lists them, but the generic API reference only lists low/medium/high. Record whether each one is accepted.

Decision: which effort values should the 4/4 menu offer?
- Recommendation: offer only values the live call accepted. Until then, 4/4 offers low/medium/high and leaves xhigh/max out.

Optionally: export OPENAI_API_KEY in the agent sandbox, then hand this ticket back to an agent.

