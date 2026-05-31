# For Lit / Web Components teams

Lit is the right answer to a lot of questions. Native custom elements that work in any framework or no framework. Standards-track shadow DOM scoping. Tiny runtime. The browser handles registration, lifecycle, and the boundary between your component and the consuming page.

It is also the framework whose compose story has the thinnest ergonomics. Slot fills with parameters. Dynamic slot names. Consumer CSS reaching into shadow roots. Reactive properties that drive declarative re-renders. Engine integration where the engine wants to mutate DOM under lit-html's feet. Each of these has a community workaround, none of them is fun to author, and the locked-in Lit user feels every one daily.

Rozie compiles Vue/Alpine-flavored `.rozie` source to **idiomatic Lit 3.2+ Web Components**, with the compose ergonomics absorbed by the compiler:

- Default and named slots, parameterized scoped slots, dynamic slot names — same authoring shape as Vue / Svelte / Solid.
- Consumer CSS reaches into shadow roots through an `adoptConsumerStyles` bridge.
- `$reconcileAfterDomMutation()` is the escape hatch when an engine mutates DOM under lit-html's `repeat` cache.
- `r-bind="$attrs"` auto-fallthrough handles consumer-passed attributes; native `addEventListener` cleanup is the compiler's job, not yours.
- `model: true` props compile to a property/attribute pair with a `*-change` `CustomEvent` — the canonical Lit two-way pattern, no boilerplate.

You write one `.rozie` component. The compiled `.ts` is a `LitElement` subclass that registers a custom element. It drops into any HTML page, any framework, any island, exactly like a hand-written Lit component — because that's what it is.

## What Lit's compose model leaves to you today

### Scoped slot params have no native API

Lit's `<slot>` element projects light-DOM children into shadow DOM by name. It does **not** project parameters back to the consumer — there's no equivalent of Vue's `<template #default="{ item }">` or React's `renderItem={(ctx) => …}`.

Community workarounds: serialize params as JSON into `data-*` attributes, hand-roll a "fillSlot" property API, or expose imperative methods the consumer queries. Each is a bespoke surface in every Lit component.

Rozie compiles a typed property-fill bridge on your behalf. The producer
declares its slot the normal way; the consumer fills it with the same
syntax used on any other target:

```rozie
<ItemList :items="$data.items">
  <template #row="{ item }"><strong>{{ item.name }}</strong></template>
</ItemList>
```

Same authoring shape as a Vue scoped slot. Same emitted compose surface as
a hand-rolled Lit fill-API. Zero boilerplate either side. Plain-HTML
consumers fill the slot via the corresponding `.row=${(scope) => html`…`}`
property splice — fully typed off the producer's `.d.ts`.

### Consumer CSS doesn't reach into shadow DOM

```html
<my-app>
  <style>
    /* Wants to theme my-button — but my-button has a shadow root */
    my-button { --btn-bg: var(--brand-blue); }
  </style>
  <my-button>OK</my-button>
</my-app>
```

CSS variables propagate across the shadow boundary because that's how custom properties work. But if `<my-button>` wants to expose *its own* classes for consumer-side overrides — `.btn--primary`, `.btn--danger` — those classes live inside the shadow root and the consumer can't target them.

The Lit community has converged on `adoptedStyleSheets` as the modern answer: the consumer constructs a `CSSStyleSheet`, the component adopts it into its shadow root. Hand-rolling that handshake is roughly fifteen lines of boilerplate per component.

Rozie ships [`adoptConsumerStyles`](https://github.com/One-Learning-Community/rozie.js/tree/main/packages/runtime/lit/src/adoptConsumerStyles.ts) as a runtime helper, and the compiler wires it automatically. Consumer-side scoped CSS targeting child-component roots works the same way it does on every other target, including Lit.

### lit-html's `repeat` cache vs. engine DOM mutation

Vanilla-JS engines (SortableJS, FullCalendar, TipTap, Uppy) mutate the DOM directly. On React / Vue / Svelte / Solid / Angular, each framework's reconciler diffs against live `parent.children` at patch time, sees the engine-induced shuffle, and reconciles cleanly.

On Lit, lit-html's [`repeat()`](https://lit.dev/docs/templates/directives/#repeat) directive caches its `oldParts` array by sentinel-comment node identity. When the engine physically relocates `<li>` elements relative to those sentinel markers, the cache desyncs — and subsequent renders garble the output. This is a real Lit-specific landmine; community-maintained sortable wrappers either accept it as a known issue or hand-roll lifecycle hooks to tear down + rebuild the part tree.

Rozie's `$reconcileAfterDomMutation()` sigil is the escape hatch:

```rozie
<script>
$onMount(() => {
  instance = new SortableJS($el, {
    onUpdate: (e) => {
      // Restore pre-drag DOM order, update bound state…
      $model.items = next
      $reconcileAfterDomMutation()  // ← here
      $emit('change', e)
    },
  })
  return () => instance?.destroy()
})
</script>
```

On Lit it lowers to `__rozieReconcileAfterDomMutation(this)`, which calls `render(nothing, host.renderRoot) + host.requestUpdate()` — a clean tear-down and rebuild of the part tree. On every other target it lowers to `void 0` (no-op). Engine wrappers are framework-agnostic again.

### Dynamic slot names

Lit's `<slot name="X">` accepts a static name in the template. If you want to fill a slot whose name is computed at runtime — `<slot :name="$data.activeTab">` — the canonical Lit approach is shadow-DOM slotting against light-DOM children, which works but requires careful authoring of both sides.

Rozie's compile-time dispatch handles dynamic slot names on every target including Lit. The producer emits the slot-name-as-binding correctly; consumers use the same `<template #${name}="…">` shape as on any other target.

## What you write vs. what Lit sees

The canonical `examples/SearchInput.rozie` compiles to a working Lit Web Component:

```rozie-src SearchInput
```

The compiled output is a canonical `LitElement` subclass — `@customElement`
decorator, `@property`-declared reactive properties, `render()` returning a
lit-html template, paired `disconnectedCallback()` cleanup. See the
[SearchInput example page](/examples/search-input) for the full Lit emit.

The compiled file is a valid, ready-to-`customElements.define`, fully-typed Lit component. You import it like any Web Component:

```html
<!-- Plain HTML page -->
<script type="module" src="./SearchInput.rozie.js"></script>
<rozie-search-input placeholder="Find…"></rozie-search-input>
```

```ts
// Or, in a TS bundle:
import './SearchInput.rozie';

// Then anywhere in your markup:
// <rozie-search-input .min-length=${2}></rozie-search-input>
```

The `lit-vanilla-demo` at [`examples/consumers/lit-vanilla-demo/`](https://github.com/One-Learning-Community/rozie.js/tree/main/examples/consumers/lit-vanilla-demo/) is a real Vite + Lit consumer importing the same example components — proof the emit is production-ready, not illustrative.

## Incremental adoption

### Step 1: Install the unplugin

```bash
pnpm add -D @rozie/unplugin @rozie/runtime-lit lit
```

The Lit target has **no host Vite plugin** — Lit components are plain ES modules that self-register via `customElements.define()`, so Rozie's unplugin handles the `.rozie` → custom-element transform directly and Vite's standard `.ts` pipeline takes it from there.

### Step 2: Add to your Vite / Webpack / esbuild config

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import Rozie from '@rozie/unplugin/vite';

export default defineConfig({
  plugins: [Rozie({ target: 'lit' })],
});
```

Astro is a particularly natural fit — Web Components run inside Astro's static islands without an island-bridge runtime. See the [adopt-incrementally guide § Astro](/guide/adopt-incrementally#astro) for the config.

### Step 3: Write one `.rozie` component

Start with a small leaf component. The [Quick Start](/guide/quick-start) Counter is a 30-line example.

### Step 4: Use it as a Web Component anywhere

```html
<script type="module" src="./Counter.rozie"></script>

<rozie-counter></rozie-counter>
<rozie-counter value="42" step="5"></rozie-counter>
```

Or import + render from any framework — React, Vue, Svelte, Angular, Solid, plain JS. Web Components compose with any framework's renderer; that's the whole point of the standard.

### Step 5: Decide

If the team likes the authoring ergonomics, expand. If not, the compiled `.ts` is a normal Lit element — you can keep using it, delete the `.rozie` source, and the `.ts` runs on its own. Zero lock-in.

## Where Rozie is the Lit story you've been waiting for

Three audiences in particular:

1. **Design-system teams shipping a framework-agnostic component library.** Lit is the canonical "ships to everyone" target. Rozie absorbs the slot / scoped-CSS / engine-integration ergonomics gap that today forces design-system teams to maintain bespoke fill APIs and `adoptedStyleSheets` boilerplate.

2. **Astro / MPA / island-architecture shops.** Astro's island bridge accepts Web Components natively; no per-framework runtime per island. Rozie + the Lit target = author once, ship as a native island that runs anywhere.

3. **Internal-tools teams in a fragmented stack.** A company-internal admin tool stack with three apps on three frameworks doesn't need a fourth framework. Rozie + Lit gives you a single component library that drops into all three without per-framework wrappers.

## Documented edges

A few small Lit-target edges (scoped-slot params travel via a property-fill
bridge rather than native template slots; `$onMount` / `$onUnmount` timing
on always-rendered components differs slightly from React; engine DOM
mutation needs the `$reconcileAfterDomMutation()` escape hatch) are
described in [Cross-Framework Parity](/parity).

## Next steps

- [Quick Start](/guide/quick-start) — write your first `.rozie` file.
- [Adopt incrementally](/guide/adopt-incrementally#astro) — Astro / Vite / Webpack install paths.
- [Creature comforts](/guide/creature-comforts) — full matrix of Lit-specific pain points Rozie hides.
- [SortableList example](/examples/sortable-list) — engine-wrapper template, full Lit emit.
- [Lit consumer demo](https://github.com/One-Learning-Community/rozie.js/tree/main/examples/consumers/lit-vanilla-demo) — working Vite + Lit project consuming Rozie-compiled custom elements.
