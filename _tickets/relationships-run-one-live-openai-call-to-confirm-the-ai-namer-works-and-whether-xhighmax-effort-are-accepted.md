---
closed_iso: 2026-10-07T16:03:34Z
id: nid_g0inqme2ol16xsrcg89g3kks4_e
title: "Relationships: run one live OpenAI call to confirm the AI namer works (and whether xhigh/max effort are accepted)"
status: closed
deps: []
links: []
created_iso: 2026-10-07T00:40:30Z
status_updated_iso: 2026-10-07T16:03:34Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
parent: nid_fc47gtxej6z7fqc53bflme8p5_e
tags: [relationships]
---

Plain version: ticket 3/4 (nid_cbnhpdfn4myqfzqr8weyg7kq5_e) asks for ONE real call to OpenAI, with its cost written down. The agent sandbox has no OPENAI_API_KEY, so nobody has made that call yet. All 3/4 code is tested against fakes only.

What we need from you (human):
1. Make one live call with `gpt-6-luna` through the plugin's namer (or a curl against `POST https://api.openai.com/v1/responses` using the same request shape), on two small synthetic notes. Write the token usage and cost into this ticket.
2. Retry with `reasoning.effort` set to `xhigh` and to `max`. The model page lists them, but the generic API reference only lists low/medium/high. Record whether each one is accepted.

Decision: which effort values should the 4/4 menu offer?
- Recommendation: offer only values the live call accepted. Until then, 4/4 offers low/medium/high and leaves xhigh/max out.

Optionally: export OPENAI_API_KEY in the agent sandbox, then hand this ticket back to an agent.

## Update 2026-10-07
The human made OPENAI_API_KEY available in the agent sandbox, so `need-human`/`decide` are dropped. The `store: false` question moved to its own decision ticket (see the parent epic). The effort rule comes from ticket 3/4: offer xhigh/max only if this live call shows they are accepted.

## Live call results (2026-10-07)
5 live calls (budget was 8), all through the REAL `OpenAiRelationshipNamer` (a throwaway Node `fetch`-based `JsonHttpPort` in git-ignored `.tmp/`, never bundled). Input: two synthetic ~300-char notes, "Morning Sunlight Exposure" → links to → "Sleep Onset Latency". Same prompt every call: 389 input tokens, 0 cached.

Price (official, https://developers.openai.com/api/docs/pricing and the gpt-6-luna model page): $0.10 / 1M input, $0.01 / 1M cached input, $0.50 / 1M output (reasoning tokens are billed as output).

| # | Model | Effort | Accepted | Input / output tokens (reasoning) | Cost (USD) | Returned name |
|---|-------|--------|----------|-----------------------------------|------------|---------------|
| 1 | gpt-6-luna | medium | yes (200) | 389 / 52 (36) | $0.0000649 | `decreases` |
| 2 | gpt-6-luna | xhigh | yes (200; response echoes `effort: "xhigh"`) | 389 / 46 (30) | $0.0000619 | `decreases` |
| 3 | gpt-6-luna | max | yes (200; response echoes `effort: "max"`) | 389 / 77 (61) | $0.0000774 | `reduces` |
| 4 | gpt-6-luna | medium + raw `"store": false` | yes (200; response echoes `store: false`) | 389 / 42 (25) | $0.0000599 | `improves` |
| 5 | gpt-6-luna | none | yes (200; no reasoning item in `output[]`) | 389 / 15 (0) | $0.0000464 | `improves` |

**Total: ≈ $0.00031** (1,945 input + 232 output tokens).

Findings:
- Parsing works on the real shape: `output[]` = `[reasoning, message]` (reasoning item first, with empty `content`/`summary`); the message's `content[0]` is `{type: "output_text", text: "{\"name\":\"…\"}"}`. `status: "completed"`. Usage is `usage.input_tokens` / `usage.output_tokens` as expected. No parsing or mapping bug found.
- `xhigh` and `max` are accepted, so per the 3/4 rule the settings now offer low / medium / high / xhigh / max. `none` is also accepted but stays unoffered on purpose.
- `store: false`: accepted by gpt-6-luna (the response echoes `store: false`; by default it echoes `store: true`). The shipped request is unchanged; the decision stays with nid_kje16wg2g49zt951lcvfcei2c_e.
- The model's names vary from run to run for the same pair (`decreases`, `reduces`, `improves`). Note: from A's point of view, "sunlight decreases sleep-onset latency" is a fair reading.
