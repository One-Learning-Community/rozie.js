# Changelog

All notable changes to the Rozie TextMate / VS Code extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-05-17

### Added

- Initial VS Code marketplace release. Syntax highlighting for `.rozie` Single-File Component files: block-level scopes, `r-*` directives, event-modifier chains with arguments, slot-fill shorthand, mustache interpolation, `$`-prefixed magic identifiers.

### Known limitations / next steps

- **Extension icon not yet supplied** — the marketplace listing will use the default placeholder until an icon is added. This is the remaining required step before promoting the listing publicly. Drop a 128×128 PNG at `tools/textmate/icon.png` and add `"icon": "icon.png"` to `package.json` before running `vsce publish`.
- `<style lang="scss">` — the `lang` attribute is recognised but content is still routed to `source.css` regardless. Full SCSS routing lands when the IntelliJ-Platform plugin replaces this grammar.
- `<style scoped>` highlights identically to `<style>` — there is no visual difference for the `scoped` attribute itself yet.
- No folding rules, no indentation rules, no brace-matching, no completion, no diagnostics. This is a colorizer only.
- The top-level `<template>` SFC block is matched only when `<template>` (and the closing `</template>`) appear flush-left at column 0. If you indent the SFC's top-level block, slot-fill highlighting will appear correct but the outer block end will be detected at the FIRST `</template>` (the inner one), losing highlighting on whatever follows.
