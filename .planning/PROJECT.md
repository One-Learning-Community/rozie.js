# Rozie.js

## What This Is

Rozie.js is a cross-framework component definition language and compiler. Authors write components once in a Vue/Alpine-flavored block-based syntax (`.rozie` files), and Rozie compiles them to idiomatic React, Vue, Svelte, and Angular components. The name derives from the Rosetta Stone — one source, many target languages.

It is **not** a runtime framework. Rozie deliberately does not try to be a "better React" or own the rendering pipeline; the heavy lifting still happens in whichever target framework the consumer chose. Rozie owns the **author-side API** so a single component definition can drop into any of the four major frameworks without per-framework wrapper boilerplate.

The audience is **component-library and design-system authors** who today maintain manual bindings/wrappers across React, Vue, Svelte, and Angular for libraries that ultimately do their real work in vanilla JS.

## Core Value

A component-library author can write one `.rozie` file and ship working, idiomatic React + Vue + Svelte + Angular consumers from it — eliminating the manual cross-framework wrapper work that today dominates the maintenance budget of cross-framework UI libraries.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] **Parser:** Parse `.rozie` files into a normalized AST covering all defined blocks (`<props>`, `<data>`, `<script>`, `<listeners>`, `<template>`, `<style>`).
- [ ] **Block: `<props>`** with JSON5 grammar, type system, defaults, and `model: true` two-way binding flag.
- [ ] **Block: `<data>`** with JSON5 grammar producing reactive signal-backed state.
- [ ] **Block: `<script>`** with full JS, NO `this`, accessed via `$`-prefixed magic accessors (`$props`, `$data`, `$refs`, `$slots`, `$emit`, `$el`, `$onMount`/`$onUnmount`/`$onUpdate`, `$computed`).
- [ ] **Multiple lifecycle calls** run in source order; `$onMount` may return a cleanup function alongside (not in place of) `$onUnmount`.
- [ ] **Static compile error** on writes to non-`model` props.
- [ ] **Block: `<listeners>`** for declarative `target:event` bindings on global targets (`document`, `window`) with reactive `when` conditions and auto-attach/detach lifecycle.
- [ ] **Modifier system:** parameterized dotted modifiers usable in BOTH `<listeners>` and template `@event` bindings. Built-ins: key/button filters, `.outside(...refs)`, `.self`, `.stop`, `.prevent`, `.once`, `.capture`, `.passive`, `.debounce(ms)`, `.throttle(ms)`.
- [ ] **`.outside(...refs)` marquee modifier** — fires only when event target is outside ALL listed refs; no-arg defaults to `$el`. Eliminates hand-rolled `isOutside` checks.
- [ ] **Block: `<template>`** with `r-*` directive prefix (NOT `v-*`): `r-if`/`r-else-if`/`r-else`, `r-show`, `r-for` (with required `:key`), `r-model`, `r-html`, `r-text`. Bindings via `:prop` / `@event` shorthand.
- [ ] **Slots:** `<slot name="x" :data="...">` declaration with consumer-side `#name="{ data }"` shorthand. `$slots.name` reactive boolean for conditional rendering.
- [ ] **Refs derived from template** — `ref="..."` populates `$refs.name` automatically; auto-typed from the bound element/component.
- [ ] **Mustache interpolation in plain attribute values** — `class="card card--{{ variant }}"`, `aria-label="Close {{ $props.title }}"`. (Vue forbids this; Rozie permits it.)
- [ ] **Inline expressions in handlers** — `@click="$props.closeOnBackdrop && close()"`.
- [ ] **Block: `<style>`** always scoped; `:root { ... }` is the unscoped escape hatch.
- [ ] **React compiler target:** emit functional components with `useState` + statically-computed `useEffect` dependency arrays from auto-tracked signal reads. Slots compile to `renderX` function props (or `children`). Listeners compile to `useEffect` with cleanup.
- [ ] **Vue 3 compiler target:** emit `<script setup>` SFCs with `ref`/`reactive`/`watchEffect`/`computed`. Slots map 1:1 to scoped slots. Listeners compile to `watchEffect` with cleanup.
- [ ] **Svelte 5 compiler target:** emit `.svelte` files using runes (`$state`, `$derived`, `$effect`). Slots compile to snippets. Listeners compile to `$effect` with cleanup.
- [ ] **Angular compiler target:** emit standalone components using signals (`signal()`, `computed()`, `effect()`). Slots compile to `<ng-template>` + `*ngTemplateOutlet` with context. Listeners use `Renderer2` + `DestroyRef`.
- [ ] **Reactivity model: signals + setup-runs-once** — auto-tracked signal reads are the user-facing model; explicit React dep arrays are a compiler implementation detail for the React target only.
- [ ] **Vite plugin:** consumers can `import Foo from './Foo.rozie'` and get a target-framework component transparently — the plugin compiles per host framework based on the build context.
- [ ] **Babel plugin:** functional parity with Vite plugin for non-Vite build pipelines.
- [ ] **CLI codegen tool:** `rozie build src/components/ --target react,vue,svelte,angular` to emit per-framework source artifacts (for libraries that ship pre-compiled per framework rather than relying on consumer build plugins).
- [ ] **TypeScript type generation** — `.d.ts` emitted alongside compiled artifacts so consumers in each framework see real types for props, slots, and emitted events.
- [ ] **Reference component examples** validated to compile correctly to all four targets: Counter, SearchInput, Dropdown, TodoList, Modal.

### Out of Scope

- **Full app frameworks (router / store / SSR / hydration / data fetching)** — Rozie targets component-library authors, not app developers. Host apps own these concerns through their own framework's mechanisms.
- **SSR support in v1** — components are client-only by default; setup-runs-once means "once on the client." Server/client boundary will be formalized in v2 if SSR demand emerges. Avoid actively hostile patterns now so the door stays open.
- **Backwards-compatible support for the `v-*` directive prefix** — Rozie deliberately uses `r-*` to be visually distinct from real Vue and to avoid silent confusion when compiled output lands in a Vue codebase.
- **JSX as an input syntax** — explicit positioning vs Mitosis ("JSX for people who like JSX"). Rozie's wedge is the non-React aesthetic.
- **The `this` keyword in `<script>`** — `$`-prefixed magic accessors replace it. No two ways to access state.
- **Solid / Qwik / Lit / web-component compile targets** — focus on the four dominant frameworks for v1. Additional targets are post-MVP.
- **Compile-target output optimization (idiomatic vs transpiled-looking)** — v1 bar is "just has to work." Output prettiness is a v2 concern.
- **Custom reactivity primitives beyond signals** — signals are the only first-class reactivity model. No `ref`/`reactive`/`writable`/etc. variants exposed at the Rozie level.
- **Cross-component state management / dependency injection / context** — out of scope for v1's presentational-component focus.

## Context

**Prior art:** Mitosis (Builder.io) is the closest existing tool — JSX-input compiler that targets ~6 frameworks. Mitosis's positioning is React-flavored and is unmistakably "JSX for people who like JSX." Rozie's wedge is the half of the developer market that actively dislikes JSX (Vue/Svelte/Alpine sympathizers). Same target audience (component-library authors), explicitly different aesthetic.

**Reactivity convergence:** All four target frameworks have either adopted or are adopting **signals** as their primary reactivity primitive (Vue 3, Svelte 5 runes, Angular 16+, Solid). React is the holdout but the React Forget compiler and TC39 signals proposal point in the same direction. This convergence is what makes a unified author-side API tractable today in a way that was much harder five years ago.

**The `<listeners>` primitive** was identified during design discussion as the marquee component-library feature: cross-framework lifecycle wiring of `document` / `window` event listeners (with cleanup correctness) is exactly the boilerplate that a four-framework component library has to write four times today. The `.outside(...refs)` modifier is a closely related win for dropdown/popover/modal authors.

**Distribution model:** Vite plugin is the primary developer experience — `import Foo from './Foo.rozie'` should "just work" with zero codegen ceremony. CLI codegen exists as the secondary path for libraries that prefer to ship pre-compiled artifacts per framework.

**Five reference example `.rozie` files** were sketched during design discussion and live in `examples/`: Counter (basics), SearchInput (form input + debounced events + `r-model`), Dropdown (`<listeners>` + `.outside` + slots with params), TodoList (`r-for` + `$emit` + scoped slots), Modal (multiple lifecycle hooks + `$slots` conditional rendering). These serve as both design pressure-tests and acceptance fixtures for the compilers.

## Constraints

- **Language:** Project source is JavaScript (Node) for the toolchain; emitted code is JS/TS for each target framework.
- **Tech stack:** Vite plugin must support Vite 5+. Babel plugin must support Babel 7+. CLI must work on Node 20+.
- **Compatibility:** Target framework versions are React 18+, Vue 3.4+, Svelte 5+, Angular 17+ (signals era). Older versions are out of scope.
- **Compatibility bar:** "High percentage" cross-framework parity, not 100%. Documented edge cases (notably React's render-prop-flavored slot consumer experience) are acceptable.
- **Audience constraint:** Every feature must answer "does a component-library author actually need this?" — if not, defer.
- **Aesthetic constraint:** When designing new features, default to "what would feel natural to a Vue developer?" Push back on JSX-isms or React-isms.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Block-based syntax (Vue SFC / Astro flavored) over JSX | JSX is the explicit non-target aesthetic; Mitosis already owns the JSX-input segment | — Pending |
| Signals + setup-runs-once reactivity model | Aligns with where 3/4 frameworks already are and where React is heading; makes cross-framework story tractable | — Pending |
| `r-*` directive prefix (not `v-*`) | Visual signal Rozie templates aren't Vue; avoids confusion when compiled output lands in a Vue codebase | — Pending |
| `$`-prefixed magic accessors; no `this` | One unambiguous way to access reactive surfaces; avoids `this`-binding footguns | — Pending |
| `<listeners>` block as a Rozie-specific primitive | Cross-framework `document`/`window` listener wiring with cleanup is exactly the boilerplate component libraries write 4× today | — Pending |
| Parameterized dotted modifiers (`.debounce(300)`, `.outside($refs.x)`) | Vue's modifier system extended to fix Vue's biggest modifier limitation (no parameters) | — Pending |
| Scoped styles always; `:root { }` as unscoped escape hatch | Component libraries should be scope-safe by default; one consistent rule | — Pending |
| Client-only-by-default in v1; SSR deferred | Component-library authors test client-side; host apps handle SSR via their own framework | — Pending |
| Static compile error on writes to non-`model` props | Catches one of the most common React/Vue prop-mutation bugs at compile time | — Pending |
| Vite plugin as primary distribution; CLI codegen secondary | "Import a .rozie file and it works" is the DX bar; CLI is the pre-compiled escape hatch | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-30 after initialization*
