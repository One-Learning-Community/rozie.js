---
name: spike-findings-rozie
description: Implementation blueprint from Rozie spike experiments. Requirements, proven patterns, landmines, and verified knowledge for building Rozie — IDE language tooling (Volar virtual TypeScript), portal slots, Angular CVA forms, the context primitive, engine-wrapper ports, and emitter test infrastructure. Auto-loaded during implementation work.
---

<context>
## Project: rozie

Two idea lineages are represented here.

**`volar-language-tooling`** (spikes 017–019, Aug 2026) — retire the ~4,821-line Kotlin semantic
layer in `tools/intellij-plugin` and serve BOTH VS Code and JetBrains from one Volar-based `.rozie`
language server that maps `.rozie` into virtual TypeScript. Motivated by JetBrains 2026.1 shipping a
service-powered (tsserver-backed) type engine and bundling `@vue/typescript-plugin`,
`svelte-language-server`, and the Astro LS — every SFC-shaped language in that ecosystem now gets its
intelligence from a Volar-style virtual-TS server rather than bespoke IDE-native code. Secondary
prize, and arguably the real one: **Rozie has no type intelligence today in any editor** — `$props.foo`
navigates but is not typed. This adds a capability class the project has never had, to both editors,
from one implementation. The Rozie thesis applied to Rozie's own tooling. **Feasibility fully proven;
not yet built.**

**`killer-component-ports`** (spikes 001–016, May–Jul 2026) — post-v1.0 killer-component port seed
list. Each port wraps a framework-agnostic vanilla-JS engine (SortableJS, flatpickr, TipTap, Lexical,
…) in a single `.rozie` source so one authored file ships idiomatic drop-ins for all 6 targets. **These
findings have largely shipped into the compiler**; the references preserve the durable design
decisions and landmines.

Spike sessions wrapped: 2026-05 through 2026-08-26.
</context>

<requirements>
## Requirements

Non-negotiable design decisions, grouped by the idea that produced them.

### volar-language-tooling

- **REQ-V1** — platform floor 2026.1+; bumping `pluginSinceBuild` off 2024.2.5 is authorized.
- **REQ-V2** — migrate LSP4IJ → native platform LSP API. LSP4IJ has **zero** injected-language
  awareness anywhere in its repo and can never serve an injected caret. Architectural, not a version gap.
- **REQ-V3** — KEEP the injection layer (993 LOC). It was never the obstacle; the LSP client was.
- **REQ-V4** — drop IntelliJ IDEA Community / Android Studio (decided by Dan). Single native-LSP path;
  CE users are served by the VS Code extension consuming the same server.
- **REQ-V5** — prefer a static source verdict over a GUI probe when the question is structural.
- **REQ-V6** — generated virtual code MUST end with `export {};` or multi-file projects collide in
  global scope. Reproduces only with ≥2 files.
- **REQ-V7** — use `createLanguageServiceHost`, not the tsserver-plugin path (which drops files silently).
- **REQ-V8** — export `RESERVED_SIGILS` from the `@rozie/core` barrel.
- **REQ-V9** — unify core's two sigil lists; `RESERVED_SIGILS` is incomplete (`$snapshot`,
  `$classSelector` are real, shipped, and missing from it).
- **REQ-V10** — read the consumer's own `tsconfig`; never impose `strict` (7.3× diagnostic difference).
- **REQ-V11** — slot-scope params are the remaining generator work; `r-for` scoping is proven.
- **REQ-V12** — report failure CLASSES, never headline totals.
- **REQ-V13** — `parseTemplate` needs error recovery for an unterminated `{{` (currently yields NO
  interpolation node, which is why completion needs closed braces).
- **REQ-V14** — IntelliJ live-template entries merge into the LSP completion popup; polish, tunable.
- **REQ-V15** — do NOT declare `bundledModule("intellij.platform.lsp")` in Gradle; it is rejected and
  unnecessary.
- **REQ-V16** — two VS-Code-shaped assumptions break silently under IntelliJ: the server must
  self-resolve TypeScript, and `scriptId` is a `URI`, not a string.
- **REQ-V17** — IDEA is one unified distribution since 2025.3 (`idea:idea`, not `ideaIU`); check
  `productCode` before concluding an API is absent, and note platform APIs can be invisible to a
  class-entry scan.

### killer-component-ports

Full lists live in the per-area references. Headlines:

- **REQ-3** — engine-wrapper `<props>` = one `options: Object` pass-through + 1–2 convenience props.
  Never enumerate the engine's option surface.
- **REQ-13/14** — Angular auto-CVA for exactly one `model: true` prop, default ON; hook view→model at
  the model-prop **write site**, never an `effect()`.
- **REQ-23** — the contentDOM graft splits the 6 by ref-timing; Vue/Svelte/Angular MUST query-after-render.
- **REQ-28** — cross-FILE context token identity splits the 6 three ways (native key / `Symbol.for` /
  global registry).
- **REQ-33/34** — emitter harnesses assert INVARIANTS, never golden strings; never conflate a compile
  THROW with an error DIAGNOSTIC.
- **REQ-37** — `$`-prefixed engine APIs MUST use namespace imports (the Svelte compiler rejects
  `$`-prefixed named imports).
- **REQ-25/26** — Angular is the first-class runtime-verification target; it is repeatedly the one
  proven only by compile-check and prior art.
</requirements>

<findings_index>
## Feature Areas

| Area | Reference | Key Finding |
|------|-----------|-------------|
| IDE language tooling | `references/ide-language-tooling.md` | Volar virtual TS gives `.rozie` real type intelligence (11/11 headless, 7/8 in-IDE); LSP4IJ is structurally incapable, the native platform LSP API is not |
| Portal slots | `references/portal-slots.md` | `$portals.NAME(container, scope)`; contentDOM grafting splits the 6 targets by ref-timing |
| Angular CVA forms | `references/angular-cva-forms.md` | Auto-CVA for one `model:true` prop; hook at the write site, never an `effect()` |
| Context primitive | `references/context-primitive.md` | `$provide`/`$inject`; cross-FILE token identity splits the 6 three ways |
| Engine-wrapper ports | `references/engine-wrapper-ports.md` | Minimal `options` prop surface; `$`-APIs need namespace imports; per-target bridges ~33 LOC |
| Emitter test infrastructure | `references/emitter-test-infrastructure.md` | Assert invariants, never golden strings; snapshots cement bugs |

## Source Files

Original spike sources are preserved in `sources/`. Every spike's README is included. The three
**un-shipped** Volar spikes (017/018/019) carry their full working sources — virtual-code generator,
LSP server, probe harnesses, the IntelliJ plugin patch, and the retired LSP4IJ files.

Note: `.planning/` is gitignored on this repo, so this skill is the durable home for spike knowledge.
</findings_index>

<metadata>
## Processed Spikes

- 001-sortablejs-port
- 002-portal-target-feasibility
- 003-portal-compiler-implementation
- 004-engine-mounted-styling
- 005-flatpickr-cva-baseline-gap
- 006-flatpickr-cva-directive
- 007-reactive-portal-update
- 008-contentdom-editable-hole
- 009-tiptap-nodeview-integration
- 010-cross-component-context
- 011-portal-registry-runtime-helper
- 012-emitter-shape-matrix
- 013-lexical-sigil-collision
- 015-lexical-decorator-lit-shadow
- 016-reactive-portal-bubble-menu-host
- 017-lsp-caret-gate
- 018-volar-virtual-ts-rozie
- 019-jetbrains-volar-integration

(014 was folded into 015 and has no directory.)
</metadata>
