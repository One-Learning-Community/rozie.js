# Why Rozie?

If you ship a UI library that targets React, Vue, Svelte, Angular, and Solid today — and a set of Lit/web-component bindings on top — you're maintaining six near-identical wrapper layers around the same vanilla-JS core. Every prop, every event, every two-way binding, every imperative method — implemented six times, tested six times, kept in sync six times.

**Rozie owns the author-side API so a single component definition drops into any of the six supported targets without per-framework wrapper boilerplate.**

## What Rozie is

A compiler. You write `.rozie` files in a Vue/Alpine-flavored block-based syntax. Rozie emits idiomatic React 18+, Vue 3.4+, Svelte 5+, Angular 17+, and Solid 1.8+ components plus Lit 3.2+ web components — each one using the target's native primitives (React's `useState`/`useMemo`, Vue's `defineModel`/`computed`, Svelte 5's runes, Angular's signals, Solid's `createSignal`/`createMemo`/`createEffect`, Lit's reactive properties + `@lit-labs/preact-signals`).

## What Rozie is not

A runtime framework. Rozie doesn't try to be a "better React" or own the rendering pipeline. Compiled output uses your target's own renderer — or, for the Lit target, the browser's native custom-element runtime. Rozie is invisible at runtime.

## Who Rozie is for

Component-library and design-system authors. If you're shipping React/Vue/Svelte/Angular/Solid bindings for a vanilla-JS core (date pickers, dropdown menus, modal primitives, headless behaviors), Rozie collapses that to a single source. The Lit target widens that further — a single `.rozie` file also ships a framework-agnostic web component that drops into any HTML page.

## Compatibility bar

"High percentage" cross-framework parity, not 100%. Documented edge cases — notably React's render-prop-flavored slot consumer experience, and Lit's data-attribute transport for scoped-slot params — are accepted in v1. Where targets disagree fundamentally, Rozie picks the most-idiomatic per-target rendering and documents the divergence.
