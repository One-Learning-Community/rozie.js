# Rozie for VS Code (grammar + language server)

Two layers for `.rozie` Single-File Components:

- **Syntactic** — a TextMate grammar (`syntaxes/rozie.tmLanguage.json`). Consumed by JetBrains IDEs via the built-in TextMate-bundle host, by the **Shiki**-powered docs site, and by this VS Code extension's `contributes.grammars` entry.
- **Semantic** — a `vscode-languageclient` that starts the shared [`@rozie/language-server`](../../packages/language-server) (the same Option-C "brain" the IntelliJ plugin consumes via LSP4IJ). It provides diagnostics (ROZ codes), `$props`/`$data`/`$refs` member completion + go-to-definition + hover + find-references + rename, cross-file component prop/event/slot completion, component-tag and slot-fill navigation, `lang=` value completion, and the document outline. See **[Language server](#language-server-semantic-features)** below.

## Install — VS Code (marketplace)

Search **Rozie** in the Extensions view, or install from a local `.vsix` via:

```
code --install-extension rozie-textmate-0.3.0.vsix
```

The marketplace listing is pending — the bundle is publishable but has not yet been published. See **Marketplace publish** below for the package + publish workflow. Version history is in [`CHANGELOG.md`](CHANGELOG.md).

## What gets highlighted

- SFC top-level blocks: `<template>`, `<script>` / `<script lang="ts">`, `<props>`, `<data>`, `<listeners>`, `<components>`, `<style>` / `<style lang="scss">`
- Block content delegated to host grammars — JavaScript for `<script>`/`<props>`/`<data>`/`<listeners>`/`<components>`, TypeScript for `<script lang="ts">`, CSS for `<style>`, SCSS for `<style lang="scss">`, HTML for `<template>`
- `r-*` directives — `r-for`, `r-if`, `r-else-if`, `r-else`, `r-show`, `r-model`, `r-html`, `r-text`, `r-bind`, `r-on`, plus the switch-style conditionals `r-match` / `r-case` / `r-default`. The object-spread forms `r-bind="obj"` and `r-on="obj"` carry no special scope — the value is a plain JS expression and routes to the embedded JavaScript grammar.
- Directive argument-form `r-model:propName="$data.x"` — the directive name, `:`, and the propName are scoped distinctly (consumer-side two-way binding)
- `r-model` modifier chains — `r-model.lazy.number.trim`, and the `r-model:propName.lazy` argument-plus-modifier form — scoped with the same modifier-chain treatment as event-modifier chains
- Event bindings with arbitrary modifier chains and arguments: `@click.outside($refs.x).debounce(300).stop`
- Prop binding shorthand `:propName="expr"` (kebab-case prop names supported)
- Slot-fill shorthand on `<template>` tags: `#name`, `#default`, `#[$data.dynamicName]`, and the scoped-params form `#header="{ close }"`
- Mustache interpolation `{{ expr }}` — supported in text content AND attribute values
- Special `$`-identifiers: `$props`, `$data`, `$refs`, `$emit`, `$event`, `$computed`, `$onMount`, `$onUnmount`, `$onUpdate`, `$watch`, `$slots`, `$el`, `$portals`, `$classSelector`, `$attrs`, `$listeners`
- `ref="…"` template-ref attribute

## Bundle layout

JetBrains and VSCode both expect a VSCode-extension-shaped bundle directory:

```
tools/textmate/
├── package.json              ← bundle manifest (contributes.languages / .grammars)
├── language-configuration.json ← brackets, comments, auto-close pairs
├── syntaxes/
│   └── rozie.tmLanguage.json ← the actual grammar
├── fixtures/                 ← demo .rozie files for visual verification (Counter, Dropdown, ModalConsumer, CounterTS, CounterScss, RModelMatch)
└── README.md
```

The grammar lives at `syntaxes/rozie.tmLanguage.json`; **do not point JetBrains at the JSON file directly** — it loads the *directory* and reads `package.json` to discover the grammar.

## Install — JetBrains (PhpStorm / WebStorm / IDEA / etc.)

1. Open **Settings** (⌘, on macOS, Ctrl+Alt+S elsewhere)
2. Navigate to **Editor → TextMate Bundles**
3. Click the **+** button
4. Select the directory containing this README — `tools/textmate/` (the directory, not the `.tmLanguage.json` file)
5. Click **OK** to apply, then **OK** to close Settings
6. Open any `.rozie` file — IDEs auto-associate the `.rozie` extension via the manifest's `contributes.languages.extensions` entry. If not, register the extension manually under **Settings → Editor → File Types → Files supported via TextMate bundles**.

JetBrains caches grammars; if changes don't appear after editing the JSON, **File → Invalidate Caches → Invalidate and Restart**.

**Troubleshooting "Cannot read the following bundle":** This means JetBrains can't find a `package.json` (or `info.plist`) at the bundle root. Verify `tools/textmate/package.json` exists and that you selected the `tools/textmate/` directory itself, not its parent or a subdirectory.

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
        "meta.embedded.block.script.ts.rozie": "typescript",
        "meta.embedded.block.style.rozie": "css",
        "meta.embedded.block.style.scss.rozie": "scss",
        "meta.embedded.expression.rozie": "javascript"
      }
    }]
  }
  ```
- Or use the **TextMate** extension (`Gandalf.textmate`) for ad-hoc loading.

## Verify it works

Open the fixture files under `tools/textmate/fixtures/` — `Counter.rozie`, `Dropdown.rozie`, `ModalConsumer.rozie`, `CounterTS.rozie`, `CounterScss.rozie`, `RModelMatch.rozie`. You should see:

- Each SFC block visually framed (its tags scoped distinctly from generic HTML)
- `<script>` / `<style>` content highlighted with full JS / CSS support; `<script lang="ts">` routes to TypeScript and `<style lang="scss">` to SCSS (`CounterTS.rozie`, `CounterScss.rozie`)
- `r-for`, `r-if`, `r-model`, `r-match`, `r-case`, `r-default`, etc. standing out from regular HTML attributes
- `r-model:open="$data.x"` — the directive name (`r-model`), the `:` separator, and the argument propName (`open`) each scoped distinctly
- `r-model.lazy.number.trim` — the directive and each `.modifier` segment scoped distinctly, the same treatment as an event-modifier chain (`RModelMatch.rozie`)
- `@click`, `@click.outside(...)`, `@input.debounce(300)` — `@` and the event name distinct from the modifiers, parens and their JS args also highlighted
- `:disabled`, `:class`, `:placeholder` — `:` and the prop name distinct from a value attribute
- `<template #header>`, `<template #header="{ close }">`, `<template #[$data.slotName]>` — the `#`, slot name (or bracketed JS expression), and destructured params each styled
- `{{ $props.value }}` — braces and the `$props` identifier both styled
- Inside `<listeners>` selector strings like `"document:click.outside($refs.triggerEl, $refs.panelEl)"` — JS-string highlighting for the selector; the modifier args participate in the JS-expression grammar

## Limitations

- `<style scoped>` highlights identically to `<style>` — there is no visual treatment for the `scoped` attribute itself.
- The `.modifier` chain is matched on every `r-*` directive, not only `r-model` — e.g. `r-show.foo` colours `.foo` as if it were a valid modifier. This is intentional: the grammar is a colorizer, and the compiler rejects modifier misuse semantically (ROZ961 / ROZ962).
- `$event` is scoped as a magic identifier globally, not only inside `@event` handlers. The grammar is forgiving — a reference to `$event` in `<script>` outside an event handler colours as if it were valid; the compiler raises the actual diagnostic (ROZ964).
- The **grammar itself** has no folding/indentation/brace-matching rules — it is a colorizer. Completion, diagnostics, navigation, and rename are provided separately by the bundled language server (see below), not by the grammar.
- Modifier-arg lists tokenize their contents as a JS expression, but errors (mismatched parens, etc.) are not surfaced — the grammar is forgiving.
- The top-level `<template>` SFC block is matched only when `<template>` (and the closing `</template>`) appear flush-left at column 0. This is what lets nested `<template #header>` slot-fill tags inside the block coexist with the block boundaries — TextMate has no stack-aware tag matching, so indentation is the only signal. If you indent the SFC's top-level block, slot-fill highlighting will appear correct but the outer block end will be detected at the FIRST `</template>` (the inner one), losing highlighting on whatever follows.

## Language server (semantic features)

The extension activates on the first `.rozie` file and starts the Rozie language
server. The server script is resolved in this order:

1. the `rozie.languageServer.path` setting,
2. the `ROZIE_LANGUAGE_SERVER` environment variable,
3. the bundle shipped inside the `.vsix` at `server/server-standalone.cjs`.

If none resolve, the extension stays **grammar-only** — syntax highlighting
still works, semantic features are simply absent (no errors).

### Building from source

`tools/textmate/` is a standalone package (not a pnpm workspace member), so
install its deps in isolation, then build:

```
cd tools/textmate
pnpm install --ignore-workspace
pnpm bundle:server     # builds @rozie/language-server and stages it into server/
pnpm build             # esbuild-bundles src/extension.ts → dist/extension.js
pnpm typecheck         # tsc --noEmit
```

For **monorepo development**, skip `bundle:server` and point the setting at the
live build instead:

```jsonc
// .vscode/settings.json
{ "rozie.languageServer.path": "<repo>/packages/language-server/dist-standalone/server-standalone.cjs" }
```

## Marketplace publish

1. Install `@vscode/vsce` (declared as a devDependency on this bundle):

   ```
   pnpm install
   ```

   If `pnpm` does not pick up `tools/textmate/` as a workspace package, install the packager locally inside the bundle:

   ```
   cd tools/textmate && npm install --no-save @vscode/vsce@^3
   ```

2. From `tools/textmate/`:

   ```
   pnpm package          # produces rozie-textmate-0.3.0.vsix
   pnpm publish          # after `vsce login <publisher>`, publishes to the marketplace
   ```

3. **Before publishing publicly:** add an icon. The marketplace listing without an icon shows the default placeholder, which looks unprofessional. Drop a 128×128 PNG at `tools/textmate/icon.png` and add `"icon": "icon.png"` to `package.json`. This is the remaining required step before promoting the listing publicly.

## Editor coverage

The JetBrains IntelliJ-Platform plugin has shipped (Kotlin, custom PSI, JS/HTML/CSS language injection) — it is the richer story for the paid JetBrains IDEs; see [`tools/intellij-plugin`](../intellij-plugin). This TextMate grammar remains the color-only path for **VS Code**, **IDEA Community / PyCharm CE**, and the **Shiki**-powered docs site, and is maintained alongside the language — see [`CHANGELOG.md`](CHANGELOG.md).
