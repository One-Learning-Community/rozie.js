<script setup>
import ThemeContextDemo from '../../examples/demos/ThemeContextDemo.rozie';
</script>

# ThemeContext ($provide / $inject)

The cross-component context primitive. `ThemeProvider.rozie` publishes a live theme object with `$provide('theme', …)`; `ThemeButton.rozie` reads it with `$inject('theme')`; `ThemePassthrough.rozie` sits between them and knows nothing about the theme — no `theme` prop, no forwarding. Three **separately-compiled** `.rozie` modules, nested by `ThemeContextDemo.rozie`.

`$provide` / `$inject` solve the prop-drilling problem compound components hit — `Tabs`/`Tab`, `Select`/`Option`, `Form`/`Field`: a parent has to hand a value to a deep descendant through middle components that know nothing about it. Every framework already has a context mechanism (Vue `provide`/`inject`, Svelte `setContext`/`getContext`, React/Solid `Context.Provider` + `useContext`, Angular DI, Lit `@lit/context`), but each spells it differently; Rozie gives you one pair of sigils that [lowers to each](/guide/composition#provide-key-value-inject-key-fallback-→-cross-component-context-everywhere). The ancestor provides once; a descendant at **any depth** injects; the components in between carry no contract.

Two scope rules to keep straight:

- **Resolution is per component tree, not global.** `$inject` returns the *nearest* provided value above it in the component tree — context is not a global store, and two sibling provider subtrees don't leak into each other. Only the *token identity* is shared process-wide, which is what lets separately-compiled modules find each other (see below).
- **Context does not cross a portal boundary.** A subtree relocated with [`r-portal`](/guide/engine-wrappers#r-portal-container-expr-—-teleport-an-element-s-own-subtree) (or mounted through a [portal slot](/examples/portal-list)) cannot be assumed to still reach a provider above its original position. Keep `$inject` consumers in normal child position and portal only presentation subtrees.

## Live demo

Click the button: its label cycles red → green → blue. The click calls the provider's `cycle()` through the injected handle, the provider mutates its reactive `$data.color`, and the new value arrives back at depth through the live getter — a full reactive round-trip with no prop passed at any level. Inspect the DOM: the dashed box is `ThemePassthrough`, a dumb `<div>` + `<slot />` that never sees a `theme` prop.

<div class="rozie-demo">
  <ClientOnly>
    <ThemeContextDemo />
  </ClientOnly>
</div>

## Walkthrough

### The provider — `$provide` with a live getter

```rozie
$provide('theme', {
  get color() {
    return $data.color
  },
  cycle,
})
```

`$provide(key, value)` is a top-level `<script>` **statement** whose key must be a **string literal** (a runtime-computed key is compile error `ROZ129`). The getter is the load-bearing line: it is what makes the context **reactive**. Provide a value that carries live references — a getter, a `$computed` accessor, or a signal — never a snapshotted primitive. `$provide('theme', $data.color)` would compile, but the descendant would see the color frozen at provide time; reading through `get color()` rides the reactive `$data.color` at the moment the consumer renders. See [the live-reference rule](/guide/composition#provide-a-live-reference-not-a-snapshot) in the guide.

### The unaware middle

`ThemePassthrough` renders `<slot />` and nothing else — no `$inject`, no `theme` prop. It exists to prove the point: the injected value reaches the button *through* it without it participating. Components with no `$provide`/`$inject` emit byte-for-byte unchanged — the context machinery costs nothing where it isn't used.

### The consumer — `$inject` bound to a `const`

```rozie
<script>
const theme = $inject('theme')
</script>

<template>
<button @click="theme && theme.cycle()">
  {{ theme && theme.color }}
</button>
</template>
```

`$inject(key, fallback?)` is an expression that must bind a local `const` (`ROZ132`) with a string-literal key (`ROZ130`). It returns the nearest provided value and is usable in setup, template, and reactive contexts.

The guarded reads (`theme && theme.color`) are deliberate: they cover [the Lit async edge](/guide/composition#the-lit-async-edge-—-guard-against-undefined-on-first-paint). `@lit/context`'s consumer resolves via a `context-request` event round-trip, so on the **first paint** the injected value can be `undefined` even when a provider exists higher up; the other five targets resolve context synchronously during setup, where the guard is a harmless no-op.

### How separately-compiled modules meet

The three files here are compiled independently — no shared import ties the provider to the consumer. The string key is the rendezvous: Vue and Svelte use the literal key directly; Lit uses a process-global `Symbol.for('rozie:theme')`; React, Solid, and Angular back their token in a `globalThis` registry keyed by your string, so two independently-built modules resolve the *same* `Context` object / `InjectionToken`. Each target lowers the pair to its native context idiom:

| Target | `$provide('theme', v)` | `$inject('theme')` |
| --- | --- | --- |
| Vue | `provide('theme', v)` | `inject('theme')` |
| Svelte 5 | `setContext('theme', v)` at init | `getContext('theme')` |
| React | returned JSX wrapped in `<C.Provider value={v}>`, `C = rozieContext('theme')` | `useContext(rozieContext('theme'))` |
| Solid | returned JSX wrapped in `<C.Provider value={v}>`, `C = rozieContext('theme')` | `useContext(rozieContext('theme'))` |
| Angular | `providers: [{ provide: rozieToken('theme'), useFactory: () => v }]` | `inject(rozieToken('theme'))` |
| Lit | `new ContextProvider(this, { context: C, initialValue: v })` + `setValue` on change | `new ContextConsumer(this, { context: C, subscribe: true })` |

Four compile-time diagnostics (`ROZ129`–`ROZ132`) catch malformed forms — see the [Diagnostics notes in the guide](/guide/composition#diagnostics).

### The pattern in production

The [Lexical family](/components/lexical) is built on exactly this seam: `<LexicalEditor>` `$provide`s the live editor under `'rozie-lexical-editor'`, and every plugin, the toolbar, and [any custom child you author](/components/lexical#inject-contract) `$inject`s it — the compositional plugin model on all six targets.

## Source — ThemeContextDemo.rozie

The composer. Three separately-compiled modules nested three deep:

```rozie-src ThemeContextDemo
```

## Source — ThemeProvider.rozie

```rozie-src ThemeProvider
```

### ThemeProvider — compiled output

::: code-group

```rozie-out ThemeProvider vue
```

```rozie-out ThemeProvider react
```

```rozie-out ThemeProvider svelte
```

```rozie-out ThemeProvider angular
```

```rozie-out ThemeProvider solid
```

```rozie-out ThemeProvider lit
```

:::

## Source — ThemePassthrough.rozie

The unaware middle layer. Worth compiling in your head: it uses no context, so its emitted output contains none of the context machinery above.

```rozie-src ThemePassthrough
```

## Source — ThemeButton.rozie

```rozie-src ThemeButton
```

### ThemeButton — compiled output

::: code-group

```rozie-out ThemeButton vue
```

```rozie-out ThemeButton react
```

```rozie-out ThemeButton svelte
```

```rozie-out ThemeButton angular
```

```rozie-out ThemeButton solid
```

```rozie-out ThemeButton lit
```

:::
