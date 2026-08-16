# The compiled output and the Rozie runtime

Rozie ships a runtime. Five per-target packages plus a shared core:

```
@rozie/runtime-react     @rozie/runtime-solid
@rozie/runtime-vue       @rozie/runtime-lit
@rozie/runtime-svelte    @rozie/runtime-keynav-core
```

132 of the 174 published `@rozie-ui/*` packages carry one as a dependency. If
you install a Rozie component, you very likely install a Rozie runtime with it.

This page explains what that runtime is, what it does for you, what it costs in
bytes, and why it exists instead of being inlined into every component.

## What it is not

It is not a rendering framework. Rozie does not own the render pipeline,
schedule updates, diff a tree, or wrap your components in a provider. React
renders React, Vue renders Vue, and the browser renders the custom element. That
part of the original claim was always true, and it is the part that matters for
how the output behaves.

What the runtime *is* is closer to a standard library: a set of small helpers
the compiled component imports, the same way a compiled Svelte component imports
from `svelte/internal`.

## What it provides

The helpers fall into six groups.

| Group | Examples | What you'd write by hand without it |
|---|---|---|
| Controlled/uncontrolled state | `useControllableState`, `createControllableSignal`, `createLitControllableProperty` | The controlled-vs-uncontrolled dance for every `model: true` prop, per target |
| Keyboard navigation | `useKeynav`, `KeynavController`, `createKeynavStateMachine` | A roving-tabindex state machine with typeahead, wrap, skip-disabled, Home/End |
| Event modifiers | `useDebouncedCallback`, `throttle`, `attachOutsideClickListener`, key predicates | Debounce/throttle wrappers, outside-click detection, `.esc`/`.enter` key filters |
| Binding normalization | `normalizeAttrs`, `normalizeListeners`, `rozieSpread`, `mergeListeners` | Remapping spread attributes and listener objects to each target's casing rules |
| Safe interpolation | `rozieDisplay`, `rozieAttr`, `rozieClass`, `rozieStyle` | Non-primitive interpolation that renders portable JSON instead of crashing React; nullish attributes that drop rather than stringify |
| Shadow-DOM plumbing (Lit only) | `adoptConsumerStyles`, `injectGlobalStyles`, `RozieSlotDistributor`, `rozieResolvePortalledRef` | Style bridging across the shadow boundary, light-DOM slot distribution, refs that survive portalling |

None of this re-implements rendering. All of it is work that would otherwise be
copy-pasted into every compiled component.

## When it is pulled in

Emission is feature-gated. Each target has an import collector that emits
nothing when no gated feature is used, so a component that touches none of them
has no runtime import at all. That is not theoretical — the Vue and Angular
builds of most `@rozie-ui` families import nothing from the runtime.

| You write | You get |
|---|---|
| A `model: true` prop | controllable-state helper |
| `r-keynav` | the keynav state machine |
| `.debounce(300)` / `.throttle()` / `.outside()` | the matching modifier helper |
| `.esc`, `.enter`, `.up` … | key-filter predicates |
| Dynamic `:class` / string `:style` | class and style helpers |
| Dynamic `r-bind` / `r-on="obj"` | binding normalizers |
| Non-primitive <span v-pre>`{{ }}`</span> | `rozieDisplay` |
| `$provide` / `$inject` | the context registry |
| A `<style>` block (Solid) | style injection |
| Slots, portals, or scoped CSS (Lit) | the matching controller |

The gate is real, but the trigger list is broad. Assume any non-trivial
component crosses it.

## Coverage by target

| Target | Runtime package |
|---|---|
| React | `@rozie/runtime-react` |
| Vue | `@rozie/runtime-vue` |
| Svelte | `@rozie/runtime-svelte` (ships source; your build shakes it) |
| Solid | `@rozie/runtime-solid` |
| Lit | `@rozie/runtime-lit` |
| **Angular** | **none** — the emitter inlines its helpers as module-scope functions |

Angular is the exception, and the exception is instructive: it proves inlining
is possible. The one thing Angular does import is `@rozie/runtime-keynav-core`,
and only when a component uses `r-keynav` — a state machine too large to inline
into every component that needs it.

## What it costs

Measured by bundling each component's real import set with esbuild, tree-shaken
and minified, framework peers external, genuine transitive dependencies
(`clsx`, `style-to-js`, `keynav-core`) counted. **All figures gzipped.**

| Component | React | Vue | Solid | Lit | Angular |
|---|---|---|---|---|---|
| Switch | 696 B | — | 967 B | 1,594 B | — |
| Popover | 838 B | 297 B | 804 B | 1,706 B | — |
| Combobox | 1,819 B | — | 971 B | 2,169 B | — |
| DataTable | 1,855 B | — | 1,003 B | 2,167 B | — |
| DatePicker | 3,333 B | 2,573 B | 3,109 B | 4,194 B | 1,696 B |

`—` means that build imports nothing from the runtime.

The jump at DatePicker is `r-keynav` in every case. The keyboard state machine
is the single most expensive thing in the system, at roughly 2 KB.

An application installing all five components:

| Target | Sum of the per-component costs | Actually shipped |
|---|---|---|
| React | 8,473 B | **4,556 B** |
| Vue | 2,845 B | **2,649 B** |
| Solid | 6,785 B | **3,461 B** |
| Lit | 11,772 B | **4,783 B** |

Between 2.6 KB and 4.8 KB, gzipped, for five components.

::: tip Quoting these numbers
Always as *minified, gzipped*. The published `dist/` is unminified and roughly
half comments, so an unminified reading is four to five times larger and
describes bytes no production build ever ships.
:::

## Why a shared package instead of inlining

Because the cost of a helper is paid once per package, not once per component.

Look at the two columns above. Inlining is competitive for a single component —
which is exactly why the Angular emitter inlines. But a component *library* is
not one component. Across five, sharing saves 47% on React, 49% on Solid, and
60% on Lit. Across a design system with thirty, the sum column keeps growing and
the shared column does not.

Marking the packages `sideEffects: false` with named exports only is what lets
your bundler drop the rest. A component that uses three helpers pays for three.

## The honest edges

**Tree-shaking pays most when you install little.** The whole Lit runtime,
minified and gzipped, is 4.9 KB — and a five-component app already ships 4.78 KB
of it. By that point shaking has bought you almost nothing; you simply hit a low
ceiling. Do not read "tree-shakable" as "scales to zero forever."

**"Almost no runtime" is true of specific targets, not of Rozie.** Vue and
Angular components frequently import nothing. Lit imports the most, because the
custom-element target has no framework underneath it to answer shadow-boundary
styling, slot distribution, or a controlled-property protocol. Rozie answers
them instead, and that answer has a size.

**It is a `dependencies` entry, not a peer.** You do not choose it or install it
yourself; it arrives with the component. Every affected package's README now
says so.
