# Rozie TextMate Grammar

Syntax highlighting for `.rozie` Single-File Component files. Consumed by JetBrains IDEs (PhpStorm, WebStorm, IDEA, RubyMine, etc.) via the built-in TextMate-bundle host, and reusable as a VSCode `contributes.grammars` entry.

## What gets highlighted

- SFC top-level blocks: `<template>`, `<script>`, `<props>`, `<data>`, `<listeners>`, `<style>`
- Block content delegated to host grammars (JavaScript for script/props/data/listeners, CSS for style, HTML for template)
- `r-*` directives (`r-for`, `r-if`, `r-else`, `r-show`, `r-model`, ...)
- Event bindings with arbitrary modifier chains and arguments: `@click.outside($refs.x).debounce(300).stop`
- Prop binding shorthand `:propName="expr"`
- Mustache interpolation `{{ expr }}` — supported in text content AND attribute values
- Special `$`-identifiers: `$props`, `$data`, `$refs`, `$emit`, `$computed`, `$onMount`, `$onUnmount`, `$watch`, `$slots`, `$el`
- `ref="…"` template-ref attribute

## Install — JetBrains (PhpStorm / WebStorm / IDEA / etc.)

1. Open **Settings** (⌘, on macOS, Ctrl+Alt+S elsewhere)
2. Navigate to **Editor → TextMate Bundles**
3. Click the **+** button
4. Select the directory containing this README — `tools/textmate/`
5. Click **OK** to apply, then **OK** to close Settings
6. Open any `.rozie` file — IDEs auto-associate the `.rozie` extension via the grammar's `fileTypes` field. If not, register the extension manually under **Settings → Editor → File Types → Files supported via TextMate bundles**.

JetBrains caches grammars; if changes don't appear after editing the JSON, **File → Invalidate Caches → Invalidate and Restart**.

## Install — VSCode

VSCode consumes the same `.tmLanguage.json` format. Either:

- Drop the file into a VSCode extension's `syntaxes/` directory and reference it from `package.json`:
  ```json
  "contributes": {
    "languages": [{ "id": "rozie", "extensions": [".rozie"] }],
    "grammars": [{
      "language": "rozie",
      "scopeName": "source.rozie",
      "path": "./syntaxes/rozie.tmLanguage.json",
      "embeddedLanguages": {
        "meta.embedded.block.script.rozie": "javascript",
        "meta.embedded.block.style.rozie": "css",
        "meta.embedded.expression.rozie": "javascript"
      }
    }]
  }
  ```
- Or use the **TextMate** extension (`Gandalf.textmate`) for ad-hoc loading.

## Verify it works

Open `tools/textmate/fixtures/Counter.rozie` and `Dropdown.rozie`. You should see:

- Each SFC block visually framed (its tags scoped distinctly from generic HTML)
- `<script>` / `<style>` content highlighted with full JS / CSS support
- `r-for`, `r-if`, `r-model`, etc. standing out from regular HTML attributes
- `@click`, `@click.outside(...)`, `@input.debounce(300)` — `@` and the event name distinct from the modifiers, parens and their JS args also highlighted
- `:disabled`, `:class`, `:placeholder` — `:` and the prop name distinct from a value attribute
- `{{ $props.value }}` — braces and the `$props` identifier both styled
- Inside `<listeners>` selector strings like `"document:click.outside($refs.triggerEl, $refs.panelEl)"` — JS-string highlighting for the selector; the modifier args participate in the JS-expression grammar

## v1 limitations

- `<script lang="ts">` and `<style lang="scss">` — the `lang` attribute is *recognised* (does not break highlighting) but content is still routed to `source.js` / `source.css` regardless. TS still highlights reasonably under `source.js` in JetBrains; full TS / SCSS routing lands when the IntelliJ-Platform plugin replaces this grammar.
- `<style scoped>` highlights identically to `<style>` — there is no visual difference for the `scoped` attribute itself yet.
- No folding rules, no indentation rules, no brace-matching, no completion, no diagnostics. This is a colorizer only.
- Modifier-arg lists tokenize their contents as a JS expression, but errors (mismatched parens, etc.) are not surfaced — the grammar is forgiving.

## Future

When the IntelliJ-Platform plugin lands (Kotlin, custom PSI, full LSP), this grammar will be retired in favor of richer language support. Until then, this is the editor story.
