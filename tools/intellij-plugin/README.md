# Rozie.js IntelliJ Plugin

> Internal dogfooding build — **Not for Marketplace distribution**.

Adds `.rozie` file type recognition to JetBrains IDEs with:

- Rozie-aware syntax highlighting (block tags, `r-*` directives, `@event.modifier(args)`, `:prop`, `{{ }}`, `$props`/`$data`/`$refs`/`$slots`/`$emit`/`$el`/`$onMount`/`$onUnmount`/`$onUpdate`/`$computed`/`$watch`)
- JavaScript autocomplete + go-to-definition + rename inside `<script>` / `<props>` / `<data>` / `<listeners>` blocks (via JS language injection)
- HTML / Emmet support inside `<template>` (via HTML injection); Rozie-specific attributes (`r-*`, `@event`, `:prop`, `ref`) are carved out of HTML "Unknown attribute" inspections
- CSS / SCSS / Less support inside `<style>` (via CSS injection; auto-detected from `<style lang="...">`)

## Supported IDEs

Requires the bundled JavaScript plugin, so works on:

- **IDEA Ultimate** 2024.2+
- **WebStorm** 2024.2+
- **PhpStorm** 2024.2+
- **RubyMine** 2024.2+
- **GoLand** 2024.2+
- **PyCharm Pro** 2024.2+

Does **not** work on IDEA Community / PyCharm Community (they don't bundle the JS plugin → language injection is a no-op). Use the [TextMate grammar](../textmate/) at `tools/textmate/` for color-only support on those IDEs.

## Install

1. Download the latest `.zip` from [GitHub Releases](../../releases?q=intellij-plugin) (look for tags starting with `intellij-plugin/v`).
2. In your IDE: **Settings → Plugins → ⚙ → Install Plugin from Disk** → select the downloaded `.zip`.
3. Restart the IDE.
4. Open any `.rozie` file (e.g., `examples/Counter.rozie`) — block tags, directives, and magic identifiers should be highlighted; type `cons` inside `<script>` and JS autocomplete should fire.

**Tip:** the plugin's color settings are themable. Go to **Settings → Editor → Color Scheme → Rozie** to customize each Rozie token class independently.

## Dev Loop

Working on the plugin? Set up locally:

```bash
cd tools/intellij-plugin

# Run the plugin in a sandboxed IDE instance for live testing
./gradlew runIde

# Run the unit tests (lexer fixtures + injection smoke tests + TM↔JFlex parity + highlighter regression)
./gradlew test

# Validate plugin.xml + check structural manifest concerns
./gradlew verifyPluginStructure

# Comprehensive cross-version binary-compatibility check (slow, runs in CI)
./gradlew verifyPlugin

# Build the distributable .zip
./gradlew buildPlugin
# Output: build/distributions/Rozie.js-0.1.0.zip

# Regenerate the JFlex-driven lexer (after editing src/main/jflex/Rozie.flex)
./gradlew generateRozieLexer
# IMPORTANT: commit the regenerated src/main/gen/_RozieLexer.java —
# CI has a no-diff guard that fails if the committed file is out of sync.
```

**Prerequisites for local dev:** JDK 21 (Temurin or Zulu) on PATH. The Gradle wrapper handles everything else (Gradle 9.5, IntelliJ Platform Gradle Plugin 2.16, IDEA Ultimate 2024.2.5 SDK).

## v1 Limitations

These are intentional v1 deferrals — captured here so dogfood users don't trip over them and file dupe issues:

- **`<style lang="scss">` / `<style lang="less">` is editor-only in v1 (per [D-11](../../.planning/phases/08-intellij-platform-plugin-v1-internal-dogfooding/08-CONTEXT.md)).** The plugin will syntax-highlight SCSS/Less correctly inside `<style lang="scss">` (via the bundled SCSS/Less plugin), and authoring works fine in the IDE — but the **`.rozie` compiler does NOT yet parse SCSS/Less**. The `lang` attribute is currently treated as an editor hint only; the compiler still hands the body to PostCSS as plain CSS, and SCSS-specific syntax (variables, nesting beyond CSS-nesting-spec, mixins) will fail to compile to JS targets. Authoring SCSS in `.rozie` files is therefore not a recommended workflow until v2 ships compiler-side `<style lang>` parsing. See [`.planning/todos/pending/style-lang-compiler-followup.md`](../../.planning/todos/pending/style-lang-compiler-followup.md) for the v2 backlog item.
- **Mustache `{{ }}` interpolation is not JS-injected in v1** — autocomplete/go-to-def inside `{{ … }}` won't fire (per D-09 deferral; revisit if dogfood reveals demand).
- **No cross-block reference resolution.** `$props.foo` in `<template>` does NOT navigate back to the `<props>` declaration (v2; depends on a custom reference contributor).
- **No compiler-driven diagnostics.** Errors from `@rozie/core` (e.g., reading a non-`model: true` `$props` field) will not surface in the IDE; you'll see them at compile time only (v2 milestone).
- **IDEA Community / PyCharm CE are unsupported.** They don't bundle the JS plugin, so language injection is a no-op. Use the [TextMate grammar](../textmate/) for color-only support on those IDEs.

## Architecture

See [`.planning/notes/intellij-plugin-architecture.md`](../../.planning/notes/intellij-plugin-architecture.md) for the load-bearing v1 decisions:

- **Thin host + language injection** (not full PSI / no LSP)
- Built on the **Astro IntelliJ plugin pattern**, not Vue's (which is LSP-routed and several orders of magnitude larger)
- **Out of v1 scope**: cross-block reference resolution, compiler-driven diagnostics, refactoring across blocks, Marketplace listing — all v2 milestones

The plugin is a single Kotlin/Gradle subproject at `tools/intellij-plugin/`, intentionally isolated from the main pnpm/Turborepo task graph (no JVM bleed into the JS workflow). It ships a JFlex-generated lexer (`_RozieLexer.java`) that emits 41 distinct `IElementType` values, a `MultiHostInjector` that hands block bodies to bundled JS / HTML / CSS plugins, an `XmlSuppressionProvider` that carves Rozie attribute names out of HTML inspections, and a `ColorSettingsPage` exposing 15 user-themable token slots.

## Filing Dogfood Feedback

Found a bug or paper-cut while authoring `.rozie` files? Open an issue with the `intellij-plugin` label:

1. **Repro:** the smallest `.rozie` snippet that triggers the issue
2. **Expected:** what should happen (e.g., "$props.value should autocomplete")
3. **Actual:** what happens instead (e.g., "no completion offered")
4. **IDE + version:** e.g., "WebStorm 2024.2.5 on macOS 14.5"
5. **Plugin version:** Settings → Plugins → installed plugins → "Rozie.js"

The dogfood goal is observation — pile up signals, fix the worst stuff in v0.2/v0.3 patch releases, decide LSP/cross-block-resolution priority for v2 based on actual pain.

## Versioning

Tags are scope-prefixed: `intellij-plugin/v0.1.0`, `intellij-plugin/v0.2.0`, etc. (per [D-04](../../.planning/phases/08-intellij-platform-plugin-v1-internal-dogfooding/08-CONTEXT.md)) so they don't collide with `@rozie/*` npm package tags.

Current: **v0.1.0** — initial internal dogfooding release.

## Stable API

These are user-visible surface elements that future versions WILL NOT rename:

- **Plugin id:** `js.rozie` (renaming would orphan every existing user's installed plugin record)
- **Color scheme keys:** `ROZIE_BLOCK_TAG`, `ROZIE_R_DIRECTIVE`, `ROZIE_EVENT_AT`, `ROZIE_EVENT_NAME`, `ROZIE_MODIFIER`, `ROZIE_MODIFIER_PUNCTUATION`, `ROZIE_PROP_BINDING_PUNCT`, `ROZIE_PROP_BINDING_NAME`, `ROZIE_INTERPOLATION_DELIM`, `ROZIE_MAGIC_IDENT`, `ROZIE_REF_ATTR`, `ROZIE_LANG_ATTR`, `ROZIE_HTML_ATTR_NAME`, `ROZIE_HTML_COMMENT`, `ROZIE_BAD_CHARACTER` (renaming any of these would silently break users' saved color customizations).
