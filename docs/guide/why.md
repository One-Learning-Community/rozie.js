# Why Rozie?

If you ship a UI library that targets React, Vue, Svelte, and Angular today, you're maintaining four near-identical wrapper layers around the same vanilla-JS core. Every prop, every event, every two-way binding, every imperative method — implemented four times, tested four times, kept in sync four times.

**Rozie owns the author-side API so a single component definition drops into any of the four major frameworks without per-framework wrapper boilerplate.**

## What Rozie is

A compiler. You write `.rozie` files in a Vue/Alpine-flavored block-based syntax. Rozie emits idiomatic React 18+, Vue 3.4+, Svelte 5+, and Angular 17+ components — each one using the target framework's native primitives (React's `useState`/`useMemo`, Vue's `defineModel`/`computed`, Svelte 5's runes, Angular's signals).

## What Rozie is not

A runtime framework. Rozie doesn't try to be a "better React" or own the rendering pipeline. Compiled output uses your target framework's own renderer. Rozie is invisible at runtime.

## Who Rozie is for

Component-library and design-system authors. If you're shipping React/Vue/Svelte/Angular bindings for a vanilla-JS core (date pickers, dropdown menus, modal primitives, headless behaviors), Rozie collapses that to a single source.

## Compatibility bar

"High percentage" cross-framework parity, not 100%. Documented edge cases — notably React's render-prop-flavored slot consumer experience — are accepted in v1. Where target frameworks disagree fundamentally, Rozie picks the most-idiomatic per-target rendering and documents the divergence.
