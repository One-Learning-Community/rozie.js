# How Rozie compares to Mitosis and Stencil

Rozie is not the first project to tackle "write a component once, run it on every
framework." Two established tools solve adjacent problems extremely well —
[Builder.io's **Mitosis**](https://github.com/BuilderIO/mitosis) and
[Ionic's **Stencil**](https://stenciljs.com/) — and Rozie owes a clear
intellectual debt to both. This page explains where Rozie sits relative to each.

It is **not** a leaderboard. Mitosis and Stencil are mature, capable, and in
several dimensions broader or more battle-tested than Rozie. The three tools
optimize for different things; the goal here is to help you pick the right one,
and to be honest about where Rozie's bet is deliberately narrow.

Facts on this page were verified against the npm registry and GitHub on
**2026-06-05**: Mitosis `@builder.io/mitosis@0.13.1` (published 2026-06-03,
pre-1.0); Stencil `@stencil/core@4.43.5` (published 2026-05-28).

## At a glance

| | **Rozie** | **Mitosis** | **Stencil** |
| --- | --- | --- | --- |
| Authoring syntax | Vue/Alpine-flavored `.rozie` SFC (`<template>` + `<script>` + `<style>` + `<props>` blocks, `r-*` directives, `{{ }}`) | JSX-like components with hooks (`useStore`, `useState`, `onMount`) | TSX components (decorators + JSX) |
| Output model | **Idiomatic native** components per framework | **Idiomatic native** components per framework | Standards-based **web components** + generated framework wrappers |
| Framework targets | React, Vue, Svelte, Angular, Solid, Lit (6) | React, Vue, Svelte, Angular, Solid, Qwik + more (Lit, Alpine, React Native, web components) | One web component → React / Vue / Angular wrapper output targets |
| Runtime cost | None at runtime (the Lit target uses the browser's native custom-element runtime) | None at runtime | A small Stencil runtime ships inside the custom element |
| Maturity | New, v1-track | `0.13.x`, pre-1.0, established with a broad community | `4.x`, mature, very large production footprint (Ionic Framework) |
| Sweet spot | Component-library authors who want idiomatic native output across six frameworks, with Vue-style authoring | The widest target matrix, JSX authoring, and the Builder.io / Figma import pipeline | Shipping web components as the unit of distribution, with thin framework wrappers |

## Rozie and Mitosis — the closest peer

Mitosis and Rozie share a thesis: **a component is mostly declarative, so compile
it to each framework's native primitives rather than shipping a runtime that
re-implements rendering.** Both emit idiomatic per-framework code — a real React
function component, a real Vue SFC, real Svelte runes — and both are invisible at
runtime. If you like Rozie's premise, you owe it to yourself to look at Mitosis;
it pioneered this space and has the broadest reach in it.

Where they differ:

- **Authoring syntax.** Mitosis authors a [lightly-constrained subset of
  JSX](https://github.com/BuilderIO/mitosis) with hooks (`useStore`, `useState`,
  `onMount`) — a React-shaped mental model. Rozie authors a Vue/Alpine-flavored
  single-file component (`<template>` / `<script>` / `<style>` plus first-class
  `<props>`, `<data>`, `<listeners>`, `<components>` blocks, `r-*` directives,
  and `{{ }}` interpolation). Neither is objectively better — they suit different
  authors. Rozie's [design rationale](/guide/design-rationale) explains why it
  deliberately reads like Vue rather than JSX.

- **Breadth vs. depth of targets.** Mitosis compiles to a longer list of targets
  — React, Vue, Svelte, Angular, Solid, Qwik, and more (Lit, Alpine, React
  Native, standards-based web components). Rozie focuses on **six** (React, Vue,
  Svelte, Angular, Solid, Lit) and spends that focus on deep cross-framework
  behavioral parity and on affordances component-library authors need: scoped and
  scoped-param slots, [portal slots](/guide/features), an
  [`$expose` imperative handle](/components/fullcalendar#imperative-handle) that lands
  as a native handle on every target, consumer-side two-way binding, and
  [scoped CSS without CSS-in-JS](/guide/creature-comforts). It is a breadth-vs.-depth
  trade, made on purpose.

- **Focus.** Mitosis is general-purpose and integrates with Builder.io's visual
  editor and Figma import. Rozie is purpose-built for **wrapping vanilla-JS
  engines** (date pickers, calendars, drag-and-drop, editors) once and shipping
  idiomatic consumers for every framework — see the
  [`@rozie-ui`](/components/fullcalendar) component families.

**Choose Mitosis** when you want the widest possible target matrix, prefer JSX
authoring, or you're already in the Builder.io ecosystem. **Rozie fits** when you
want Vue-flavored SFC authoring, deep parity across the six mainstream
frameworks, and the component-library affordances above.

## Rozie and Stencil — a different model

Stencil answers the cross-framework question differently, and answers it very
well: you author TSX components and Stencil compiles them to **standards-based web
components** (custom elements). "Framework support" then means
[output targets](https://stenciljs.com/docs/overview) that generate thin React,
Vue, and Angular wrappers around that custom element. The runtime unit is the web
component; the wrappers are bindings. Stencil is mature (`4.x`), powers the Ionic
Framework, and is a proven choice for large, long-lived design systems.

Rozie emits **native** components instead. The React target is a real function
component using `useState`/`useMemo`; the Vue target is a real SFC using
`defineModel`/`computed`; Angular uses signals; Svelte uses runes. There is no
web component in the middle — only Rozie's *Lit* target produces a custom element.

The trade-off cuts both ways, honestly:

- **Stencil's web-component model** gives you one runtime artifact that works the
  same everywhere, is standards-based, and is largely framework-*version*
  agnostic — the custom element doesn't care whether the host app is on React 18
  or 19. The costs are custom-element / shadow-DOM semantics, SSR and hydration
  nuances, events surfaced as `CustomEvent`s through wrappers, and a small Stencil
  runtime shipped inside the element.

- **Rozie's native-emit model** gives you components that are indistinguishable
  from hand-written ones in each framework: framework-native SSR, framework-native
  reactivity, no custom-element registration, no shadow-DOM tax, and nothing extra
  at runtime. The costs are that you ship per-framework packages rather than one
  universal element, and that parity is ["high percentage," not
  100%](/guide/why#compatibility-bar).

**Choose Stencil** when a web component is the right unit of distribution, you
want one framework-version-agnostic artifact, or you're building on the Ionic /
PWA tooling. **Rozie fits** when you want genuinely idiomatic native components in
each framework, without a web-component runtime or shadow-DOM model in between.

## Where we're honest

- Both projects are, in important ways, ahead of Rozie. Stencil has years of
  production use behind it and an enormous install base; Mitosis has a broader
  target matrix and a larger community than Rozie has today.
- This page is positioning, not a benchmark. We respect both offerings and
  recommend them without reservation for the jobs they're built for.
- Rozie's contribution is a **deliberately narrow bet**: six mainstream targets,
  Vue-flavored authoring, and depth on the cross-framework behavioral parity and
  component-library affordances that make a single source ship as idiomatic
  native code on every one of them.

For the full statement of what Rozie is and isn't, see [Why Rozie?](/guide/why)
and [Why Rozie looks this way](/guide/design-rationale).
