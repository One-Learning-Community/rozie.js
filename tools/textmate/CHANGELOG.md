# Changelog

All notable changes to the Rozie TextMate / VS Code extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] — 2026-05-23

### Added

- `$attrs` magic identifier (Phase 14) — the consumer-passed attribute cluster minus declared props, used by the object-spread `r-bind` directive and root-element attribute fallthrough. Scoped alongside the existing `$props` / `$data` / `$refs` / `$slots` / `$portals` / `$classSelector` set.
- `$listeners` magic identifier (Phase 15) — the consumer-passed event-listener cluster minus declared events, used by the object-spread `r-on` directive and root-element listener fallthrough. Scoped alongside `$attrs`.
- `$event` magic identifier — the reserved event-handler closure parameter. Highlighted in `@event` handler expressions and `<listeners>` block bodies (added 2026-05-22 as WR-06).

### Notes

- The `r-bind` and `r-on` directives themselves were already in the `r-*` directive regex from 0.2.0; the object-spread form (`r-bind="obj"` / `r-on="obj"`) needs no additional grammar work — the value is a plain JS expression and routes to the embedded JavaScript grammar like every other attribute value.
- The `inherit-attrs` and `inherit-listeners` boolean attributes on the `<rozie>` opening tag carry no special scope — they highlight as ordinary HTML attribute name / value pairs. The behavior is compiler-side.
- Token regex now: `\$(props|data|refs|emit|event|computed|onMount|onUnmount|onUpdate|watch|slots|el|portals|classSelector|attrs|listeners)\b` (16 alternations).

## [0.2.0] — 2026-05-22

### Added

- `<style lang="scss">` block bodies now route to the embedded `source.css.scss` grammar — SCSS variables, nesting, and `&` parent-references highlight correctly. Plain `<style>` and `<style lang="css">` continue to route to `source.css`.
- `r-match` / `r-case` / `r-default` are recognised as `r-*` directives — the switch-style conditional construct (comma-alternative `r-case`, literal-`true` predicate mode).
- `r-model` modifier chains — `r-model.lazy.number.trim`, and the consumer-side `r-model:propName.lazy` form — highlight with the same modifier-chain scoping as event-modifier chains (`.modifier` and `.modifier(args)`).
- `$portals` (portal-slot disposer) and `$classSelector` (class-name → selector helper) added to the `$`-prefixed magic-identifier set.

### Known limitations / next steps

- **Extension icon not yet supplied** — the marketplace listing will use the default placeholder until an icon is added. Drop a 128×128 PNG at `tools/textmate/icon.png` and add `"icon": "icon.png"` to `package.json` before running `vsce publish`.
- `<style scoped>` highlights identically to `<style>` — there is no visual treatment for the `scoped` attribute itself.
- The `.modifier` chain is matched on every `r-*` directive, not only `r-model` — e.g. `r-show.foo` colours `.foo` as if it were a valid modifier. This is intentional: the grammar is a colorizer, and the compiler rejects modifier misuse semantically (ROZ961 / ROZ962).
- `$event` — the reserved event-handler closure parameter — is not yet highlighted. It is meaningful only inside `@event` handler expressions and would need a context-scoped rule rather than the global magic-identifier match.
- No folding rules, no indentation rules, no brace-matching, no completion, no diagnostics. This is a colorizer only.
- The top-level `<template>` SFC block is matched only when `<template>` (and the closing `</template>`) appear flush-left at column 0.

## [0.1.0] — 2026-05-17

### Added

- Initial VS Code marketplace release. Syntax highlighting for `.rozie` Single-File Component files: block-level scopes, `r-*` directives, event-modifier chains with arguments, slot-fill shorthand, mustache interpolation, `$`-prefixed magic identifiers.
- `<script lang="ts">` content now routes to `source.ts` for proper TypeScript highlighting (interfaces, type-only imports, `satisfies`, etc.). Plain `<script>` openers continue to route to `source.js` unchanged.

### Known limitations / next steps

- **Extension icon not yet supplied** — the marketplace listing will use the default placeholder until an icon is added. This is the remaining required step before promoting the listing publicly. Drop a 128×128 PNG at `tools/textmate/icon.png` and add `"icon": "icon.png"` to `package.json` before running `vsce publish`.
- `<style lang="scss">` — the `lang` attribute is recognised but content is still routed to `source.css` regardless. Full SCSS routing lands when the IntelliJ-Platform plugin replaces this grammar.
- `<style scoped>` highlights identically to `<style>` — there is no visual difference for the `scoped` attribute itself yet.
- No folding rules, no indentation rules, no brace-matching, no completion, no diagnostics. This is a colorizer only.
- The top-level `<template>` SFC block is matched only when `<template>` (and the closing `</template>`) appear flush-left at column 0. If you indent the SFC's top-level block, slot-fill highlighting will appear correct but the outer block end will be detected at the FIRST `</template>` (the inner one), losing highlighting on whatever follows.
