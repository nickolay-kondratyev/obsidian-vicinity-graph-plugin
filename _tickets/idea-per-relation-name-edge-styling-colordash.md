---
id: nid_adesjb4clls56623vdu773ubg_e
title: "Idea: per-relation-name edge styling (color/dash)"
status: open
deps: [nid_wnagjm2j144u0jsgixpcmmpar_e]
links: []
created_iso: 2026-08-17T16:44:24Z
status_updated_iso: 2026-08-17T16:44:24Z
type: feature
priority: 4
assignee: CC_WITH-nickolaykondratyev
tags: [named-relationships, idea]
---

Deferred idea from the named-relationships set. Read the PLAN first: `_tickets/add-ability-for-named-relationships.md` (closed plan ticket nid_fg66tanwkoyq3cqs1wdxagn21_e) — full syntax spec, signed-off decisions, architecture. Repo conventions: `CLAUDE.md` (layering view→adapters→engine, BDD tests, settings machinery).

Distinct visual styling per relation name (color/dash/weight), so e.g. `supports` vs `contradicts` edges are distinguishable at a glance without reading labels. Deliberately EXCLUDED from V1 (sign-off). Consider: user-configurable name→style mapping vs deterministic hashing; interplay with the multi-name edge UI; theme-variable-based palettes.

