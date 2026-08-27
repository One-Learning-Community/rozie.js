# Spike 019 — what to try in the sandbox IDE

Open **this `testbed` folder** as the project (File > Open).

## The gate: do caret features work INSIDE injected fragments?

`<template>` is injected HTML and `<script>` is injected JS. Every check below puts
the caret inside one of those injected regions. That is exactly where LSP4IJ
returned nothing.

### In `Probe.rozie`

1. **Hover inside `{{ }}`** — put the caret on `label` in `{{ $props.label }}`
   → expect: `(property) __RozieProps.label: string`

2. **Hover on an attribute expression** — caret on `disabled` in `:disabled="$props.disabled"`
   → expect: `(property) __RozieProps.disabled: boolean`

3. **Completion inside `{{ }}`** — type `{{ $props.` on a new line in the template
   → expect: `count`, `disabled`, `label` — and nothing else

4. **Go-to-definition across blocks** — Cmd+B / Cmd+Click on `label` in `{{ $props.label }}`
   → expect: jumps to the `label:` key in the `<props>` block

5. **Hover inside `<script>`** — caret on `clicks` in `$data.clicks`
   → expect: `(property) clicks: number`

6. **No false errors** — the file should have a clean gutter.

### In `ProbeBad.rozie` (deliberately broken)

7. **`$props.bogus`** in `<script>` → red squiggle: *Property 'bogus' does not exist on type '__RozieProps'*
8. **`$props.label.toFixed(2)`** inside `{{ }}` → red squiggle on `toFixed`
   — this one is the prize: **template type-checking**

## If nothing happens

- The LSP status widget is in the bottom-right status bar — it should list **Rozie**.
- Help > Diagnostic Tools > Debug Log Settings… → add `#com.intellij.platform.lsp`
  then Help > Show Log in Finder for the wire trace.
