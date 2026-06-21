# Changelog

All notable changes to the Rozie TextMate / VS Code extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] — 2026-06-21

### Added

- **Script-partial highlighting (`.rzts` / `.rzjs`).** Registers Rozie's script-partial extensions as first-class languages: `.rzts` tokenizes as TypeScript, `.rzjs` as JavaScript, both with the Rozie `$sigils` painted distinctly. A script partial is plain TS/JS (no SFC blocks) that uses the sigils — a slice of a component's `<script>` body lifted into its own file (`PARTIAL_EXT = /\.(rzts|rzjs)$/`, Phase 56). New languages `rozie-ts` / `rozie-js` with thin grammars (`source.rozie.ts` / `source.rozie.js`) that embed `source.ts` / `source.js`, plus companion **injection** grammars (`source.rozie.ts.injection` / `source.rozie.js.injection`, wired via `injectTo`) that paint the sigils at every nesting depth — not just the root context an `include` reaches. A TS/JS-flavored `language-configuration.partial.json` (line/block comments, bracket + auto-close pairs) replaces the HTML-comment config the `.rozie` files use. The injection's `injectionSelector` is confined to the `source.rozie.{ts,js}` scope, so it can never leak into ordinary `.ts` / `.js` files. Existing `.rozie` highlighting is unchanged.

- `$expose` magic identifier (Phase 21, 2026-06-01) — the imperative-handle sigil. `$expose({ reset, focus })` exposes consumer-callable methods on all 6 targets (React `forwardRef`/`useImperativeHandle`, Vue `defineExpose`, Svelte exported consts, Solid callback-ref prop, Angular/Lit public class/element methods). Added 2026-06-02.
- `$reconcileAfterDomMutation` magic identifier — the Lit-only `r-external` re-key escape hatch for third-party-engine DOM mutations (no-op on the other 5 targets). Shipped in the compiler 2026-05-24; added to highlighting 2026-06-02.

### Notes

- Post-0.3.0 grammar drift, now changelogged: `$restoreFocus` (Phase 16, added to the grammar 2026-05-26) and `$model` (Phase 18, added 2026-05-30) were committed to the grammar after the 0.3.0 package was cut but never recorded here.
- `$watch` behavior changed compiler-side (quick 260602-9lw, 2026-06-02): lazy by default, optional `{ immediate: true }` third argument. No grammar impact — `watch` was already in the sigil regex and the options object is a plain JS expression — but noted here because the LSP-served diagnostics (bundled in the extension's language server) reflect the new contract.
- Token regex now: `\$(props|data|refs|model|emit|event|computed|onMount|onUnmount|onUpdate|watch|slots|el|portals|classSelector|attrs|listeners|restoreFocus|expose|reconcileAfterDomMutation)\b` (20 alternations).

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
