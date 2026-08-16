# Why Rozie?

If you ship a UI library that targets React, Vue, Svelte, Angular, and Solid today — and a set of Lit/web-component bindings on top — you're maintaining six near-identical wrapper layers around the same vanilla-JS core. Every prop, every event, every two-way binding, every imperative method — implemented six times, tested six times, kept in sync six times.

**Rozie owns the author-side API so a single component definition drops into any of the six supported targets without per-framework wrapper boilerplate.**

## What Rozie is

A compiler. You write `.rozie` files in a Vue/Alpine-flavored block-based syntax. Rozie emits React 18+, Vue 3.4+, Svelte 5+, Angular 19+, and Solid 1.8+ components plus Lit 3.2+ web components — each one using the target's native primitives (React's `useState`/`useMemo`, Vue's `defineModel`/`computed`, Svelte 5's runes, Angular's signals, Solid's `createSignal`/`createMemo`/`createEffect`, Lit's reactive properties + `@lit-labs/preact-signals`).

## What Rozie is not

A rendering framework. Rozie doesn't try to be a "better React" or own the rendering pipeline. Compiled output uses your target's own renderer — or, for the Lit target, the browser's native custom-element runtime.

Rozie is not, however, invisible at runtime. Compiled components import a small helper package (`@rozie/runtime-react` and friends) for controllable state, keyboard navigation, event modifiers, and safe interpolation. It is tree-shaken and feature-gated — Vue and Angular builds often import nothing at all, and five components together cost 2.6–4.8 KB minified and gzipped. See [Compiled output & the runtime](/guide/output-and-runtime) for what it contains and what it costs.

## Who Rozie is for

### Component-library and design-system authors (the original audience)

If you're shipping React/Vue/Svelte/Angular/Solid bindings for a vanilla-JS core (date pickers, dropdown menus, modal primitives, headless behaviors), Rozie collapses that to a single source. The Lit target widens that further — a single `.rozie` file also ships a framework-agnostic web component that drops into any HTML page.

### Also: ordinary devs stuck on a single stack

Six targets of cross-framework parity required Rozie to quietly normalize a lot of behavioral grit. The comforts that fell out (scoped CSS without CSS-in-JS, automatic attribute fallthrough, literal class names on every target, and more) fix pain points each framework's locked-in users feel every day and can't escape without leaving the stack; [Creature comforts](/guide/creature-comforts) catalogs the full set.

That makes Rozie attractive to a second audience the original positioning understated:

- An **[Angular shop](/guide/for-angular-shops)** that wants Vue-flavored SFC ergonomics but can't migrate the codebase — write your next component in Rozie, ship Angular standalone-component output.
- A **[jQuery + plugins shop](/guide/for-vanilla-js-shops)** maintaining engine glue across pages — wrap each engine (flatpickr, Sortable, Leaflet, TipTap, …) once in Rozie; the same wrapper drops into any of your apps regardless of framework.
- A **[React team](/guide/for-react-teams)** that wants Vue-style scoped CSS without paying the CSS-in-JS runtime tax.
- A **[Lit / Web Components team](/guide/for-lit-teams)** that wants slots, scoped-slot params, and consumer-CSS-bridge — Rozie's compose model fills exactly the gap Lit's Web Components leave open.
- An **[Astro / Stimulus / HTML-first shop](/guide/for-astro-and-html-first-shops)** that wants the smallest possible per-island runtime cost without giving up component authoring ergonomics.

You don't have to migrate. You write **one new component this week** in Rozie, and the compiled output drops into your existing app as a native target-framework component. [Adopt incrementally](/guide/adopt-incrementally) walks through what that looks like per stack.

See [Creature comforts](/guide/creature-comforts) for the full pain-point matrix, or [Features & design choices](/guide/features) for the complete feature-by-feature reference — every directive, sigil, and per-target lowering.

## Compatibility bar

"High percentage" cross-framework parity, not 100%. Documented edge cases — notably React's render-prop-flavored slot consumer experience, and Lit's data-attribute transport for scoped-slot params — are accepted in v1. Where targets disagree fundamentally, Rozie picks the most-idiomatic per-target rendering and documents the divergence.
