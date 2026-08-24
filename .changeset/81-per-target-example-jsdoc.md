---
"@rozie/core": minor
---

A prop's `docs.example` is now parsed as markup and re-rendered per compile target, instead of
being copied verbatim into the emitted JSDoc. Previously every target's `@example` block showed
the exact `.rozie` authoring notation the component was written in — `r-model:`, `:prop=`,
kebab-case attribute names, `@evt=` handlers — regardless of who was reading it. A React consumer
of `@rozie-ui/rete`, for example, saw:

```
@example
<FlowCanvas r-model:graph="graph" :validate-types="true" />
```

That same example now reads, in React's own idiom:

```
@example
<FlowCanvas graph={graph} onGraphChange={setGraph} validateTypes={true} />
```

The same source example renders six ways — Vue keeps `v-model:`/`:prop=` verbatim, React and
Solid expand a two-way `r-model:x` into `x={e}` + `onXChange={setE}` (Solid's value additionally
gets the `()` accessor-call suffix), Svelte uses `bind:x`, Angular uses the `[(x)]` banana-in-a-box
form, and Lit uses its own in-template `.x=${e}` + `@x-change=${…}` binding form. Angular and Lit
also rewrite the component tag itself to its published custom-element form (`<FlowCanvas>` becomes
`<rozie-flow-canvas>`); the other four targets keep the PascalCase tag.

Four things a toolchain consumer needs to know:

1. **`buildPropJsdoc` now requires a target parameter.** It was already a public `@experimental`
   export (`@rozie/core`'s barrel) with 10 call sites across the six in-source emitters; a
   two-argument call now fails to typecheck. This is a breaking change to an experimental export —
   pre-1.0, that is a minor bump, not a major one. `hasPropJsdoc`'s signature is unchanged.
2. **An example the renderer cannot map is now a hard compile error**, not a silent passthrough.
   A `<template #slot>` fill, `{{ }}` interpolation, an `r-*` directive other than `r-model:`, or
   malformed markup inside a `docs.example` fails the build with a new diagnostic (`ROZ097`) whose
   code frame points at the example string in the `.rozie` source and names the construct it could
   not render. The one exception: an `r-model` bound to a non-identifier expression renders its
   callback as an ellipsis placeholder (`onXChange={…}`) rather than erroring — honest about what
   the reader must fill in, without turning every dynamic example red.
3. **Prose descriptions, non-markup examples, and undocumented props are untouched.** An example
   whose content is not element markup (e.g. a `validate: (v) => …` snippet) still emits verbatim
   with no diagnostic; `docs.description` free text is unaffected; a prop with no `docs` block still
   yields an empty JSDoc contribution exactly as before.
4. **The `.rozie` authoring notation itself did not change.** `r-model:`, `:prop=`, and every other
   directive stay exactly as they are today — this phase only changes what gets rendered into the
   *published types*, not how components are written.

`@rozie/core`'s `ir/validatePropExampleMarkup` module is also newly exported through the core
barrel (the third symbol landing there this phase), so a consumer building their own tooling on top
of `@rozie/core` can run the same validation this compiler now runs internally.

As with prior releases, the six `@rozie/target-*` emitter packages are private workspace packages,
never published on their own — `@rozie/core`'s emitters are what's inlined into every public entry
point that compiles `.rozie` source: this CLI, the unplugin build-tool adapter, and the Babel
plugin. All six targets change with this release.
