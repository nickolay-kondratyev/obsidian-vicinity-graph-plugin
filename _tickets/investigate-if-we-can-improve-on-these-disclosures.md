---
id: nid_zzw9tlrhewemtp1zx5yx05pp8_e
title: investigate if we can improve on these disclosures
status: in_progress
deps: []
links: []
created_iso: '2026-08-11T20:29:38Z'
status_updated_iso: '2026-08-11T20:47:43Z'
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
We have the following disclosures pop up when submitting the obsidian plugin for publishing:
```
Plugin references unrecognized WASM files
Unrecognized .wasm files contain native binary code that cannot be statically reviewed. All WASM modules should be documented.
.wasm

WASM module (inline WASM blob #1) imports WASI stdio functions. Typical of Rust/C compiled WASM.

WASI stdio imports (fd_write, proc_exit, etc.) are commonly emitted by Rust and C compilers for panic handling and are generally low risk.

WASM module (inline WASM blob #1) exports its linear memory
    Exporting WASM memory allows the JavaScript host to directly read and write the module's entire address space.
```

We do need WASM modules to be able to do edge routing. The question though can we add some documentation that will be obsidian score card friendly regarding these modules?
