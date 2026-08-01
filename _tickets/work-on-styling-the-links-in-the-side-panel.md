---
id: nid_u877k92mv4vgcc3h3i2t2e1wi_e
title: "Work on styling the links in the side panel"
status: open
deps: []
links: []
created_iso: 2026-08-01T01:30:37Z
status_updated_iso: 2026-08-01T01:30:37Z
type: task
priority: 3
assignee: nickolaykondratyev
---

Need to improve the styling of the links in the side panel.

Use playwright to analyze how the styling/display of links looks like right now.

Problems that currently exist (may be more of them):
- There is problem around embedded notes they appear to render with too much space even when the link is in collapsed state.
  - We shouldn't render the entire note that is embedded in the link reference. Let's say when we have a link to not `![[a]]` we shouldnt render entire note `a` in the link reference in the side panel that becomes ways too noisy. 
    - One approach that comes to mind is to render as raw markdown in such cases. BUT maybe we do a mix like pre-process to render as markdown by first removing the `!` in front of the `[[` and then add the ! back after the the markdown is rendered? (For now likely the KISS approach of going raw markdown for embedded links is the way to go)
      - If you have other better approaches that come to mind I am all ears to hear about it as well.
- there is no wrapping which shows up especially for longer text, we should have wrapping and multi line rendering of markdown
- The style of the link refernce looks a bit ugly itself (the gray backgounrd right now on dark background does not looked polished.) 