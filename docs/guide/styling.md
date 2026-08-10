# Styling & scoped CSS

Scoped `<style>` blocks and their escape hatches: the `:root { }` global layer, `:deep()`, `::part()`, and SCSS support.

## `:root { }` — the global escape hatch in scoped styles

`<style>` is scoped by default. The `:root { }` selector is the escape hatch, and it carries **two distinct capabilities** depending on what you put inside it:

1. **Flat custom-property declarations** (`:root { --var: … }`) → emitted globally as a top-level `:root` rule — for CSS variables, font definitions, or anything else that legitimately belongs on the document.
2. **Nested selector rules** (`:root { .selector { … } }`) → the inner rules are emitted **bare/unscoped** (without Rozie's `[data-rozie-s-*]` scope attribute) so they can reach **engine-rendered runtime DOM** — the **engine-DOM escape hatch** (Phase 34).

### Flat custom properties — the global document layer

```rozie
<style>
/* Scoped — only applies to this component's elements. */
.dropdown { position: relative; display: inline-block; }
.dropdown-panel {
  z-index: var(--rozie-dropdown-z, 1000);
  background: white;
}

/* Unscoped — emitted as a top-level :root { } rule. */
:root {
  --rozie-dropdown-z: 1000;
}
</style>
```

Each target picks the right escape hatch: Vue gets a sibling unscoped `<style>` block, Svelte gets `:global(:root)`, Angular gets `::ng-deep :root`, React/Solid get a separate `.global.css` file imported next to the module CSS, and Lit — whose `static styles` are shadow-DOM-scoped by default — gets the `:root` rules injected into the document via an `injectGlobalStyles` runtime call.

### Nested selectors — the engine-DOM escape hatch

When you wrap a **selector rule** inside `:root { }` (rather than a flat custom property), Rozie emits that inner rule **bare and unscoped** — it does *not* get the component's `[data-rozie-s-<hash>]` scope attribute. This is the mechanism a wrapped vanilla-JS engine component needs to style the DOM the engine creates **at runtime**.

The problem it solves: when Rozie wraps an engine like CodeMirror, ProseMirror/TipTap, or flatpickr, that engine renders its own DOM nodes (`.cm-editor`/`.cm-scroller`, TipTap's `is-editor-empty` placeholder node, flatpickr's body-appended calendar). Those nodes are created by the engine *after* mount and **never carry Rozie's scope attribute** — so an ordinary scoped rule like `.cm-editor { … }` silently fails to match them on React/Solid/Lit (and is shadow-DOM-isolated on Lit). The nested-`:root` form lifts the rule out of scoping so it reaches engine DOM on **all six targets**, including through Lit's shadow boundary:

```rozie
<style>
/* Scoped to this component's own template elements. */
.editor-shell { border: 1px solid #d1d5db; border-radius: 8px; }

/* Engine-DOM escape hatch — these reach CodeMirror's runtime nodes,
   which never carry Rozie's [data-rozie-s-*] scope attribute. */
:root {
  .cm-editor { height: 100%; }
  .cm-scroller { font-family: ui-monospace, monospace; }
}
</style>
```

A real example from the TipTap wrapper styles the Placeholder extension's ghost text — the `is-editor-empty` node ProseMirror injects into an empty document:

```rozie
<style>
:root {
  .ProseMirror .is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    color: #9ca3af;
    pointer-events: none;
    height: 0;
    float: left;
  }
}
</style>
```

Per-target emission of the nested rules mirrors the flat case but for selector rules rather than custom properties: React emits a `.global.css` sidecar, Vue an unscoped second `<style>` block, Svelte a `:global { … }` wrapper, Angular bare `::ng-deep`, Solid a `__rozieInjectStyle` head-inject, and Lit a **dual-sink** — the rules land in both `static styles` (for the shadow root) and `injectGlobalStyles` (for engine DOM that escapes the shadow boundary, e.g. a body-appended calendar).

This injection is intentionally **page-wide** — the rules go in as authored, with no anchoring or containment enforcement. If you want containment, scope the inner selectors under a wrapper class yourself (e.g. `:root { .my-editor .cm-editor { … } }`).

### `:global()` is forbidden (ROZ128)

You might reach for `:global(.cm-editor)` out of Vue/Svelte habit. **Don't** — it's a hard compile error (**ROZ128**). The `:global()` pseudo works natively *only* on Vue and Svelte (whose compilers understand it); on React, Solid, and Lit the browser sees an unknown pseudo and silently discards the entire rule. Rather than ship a selector that works on two of six targets and dies invisibly on three, Rozie blocks `:global()` in `<style>` selectors loudly and points you at the `:root { … }` engine-DOM escape hatch, which lowers to the same unscoped output on every target:

```rozie
<style>
/* ❌ ROZ128 — works on Vue/Svelte, silently dead on React/Solid/Lit. */
:global(.cm-editor) { height: 100%; }

/* ✅ Canonical — bare/unscoped on all six targets. */
:root {
  .cm-editor { height: 100%; }
}
</style>
```

## `:deep()` — reaching into child components from scoped styles

`:root` is the global escape hatch; `:deep()` is the **cross-component** one. Because `<style>` is scoped per component, a parent's selector like `.board > .rozie-sortable-list` can never match the child SortableList's rendered DOM — every component has its own scope attribute and the parent's selector goes looking for the parent's marker on the child's elements. `:deep(...)` lifts the inner selector out of the scope so it reaches the child's DOM directly:

```rozie
<template>
  <div class="board">
    <SortableList :items="$data.columns">…</SortableList>
  </div>
</template>

<style>
/* Reach into SortableList to lay its outer wrapper out as a grid of columns. */
.board :deep(.rozie-sortable-list) {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}
</style>
```

The outer compound (`.board`) stays scoped to this component; only what's inside `:deep(...)` is hoisted out. Combinators inside the parentheses (`.a > .b`) and comma-separated branches (`:deep(.a, .b)`) work the way Vue's `<style scoped>` handles them.

Each target picks the right translation:

- **React**: scope attribute appended to the outer compound only, with the deep-lifted part wrapped in `:global(...)` — `.board[data-rozie-s-<hash>] :global(.rozie-sortable-list) { … }`. (The `:global()` wrap is historical: it originally opted the lifted inner selector out of CSS Modules hashing. React now emits a plain `.css` file scoped purely by `[data-rozie-s-<hash>]` attributes, so the wrap is inert-but-kept — class names *inside* `:global()` are already literal in the DOM and match the producer-rendered class directly.)
- **Solid**: scope attribute appended to the outer compound only — `.board[data-rozie-s-<hash>] .rozie-sortable-list { … }`. Solid emits CSS via a runtime style-inject (no CSS Modules pipeline), so the inner class name survives literally and needs no extra wrap.
- **Vue**: `:deep()` is passed through verbatim. Vue 3.4+ `<style scoped>` understands the selector natively and applies its `[data-v-<hash>]` lowering downstream.
- **Svelte**: same compound-scope rewrite as React, wrapped in Svelte 5's `:global { … }` so Svelte's native scoper doesn't interfere.
- **Angular**: lowered to `::ng-deep` — `.board ::ng-deep .rozie-sortable-list { … }`. Angular's view encapsulation honors `::ng-deep` as the supported pierce mechanism (marked deprecated in the docs, but still the standard idiom for this exact case).
- **Lit**: the scope attribute is lifted exactly like React/Solid, so the selector works **within one shadow root**. It does **not** cross shadow-DOM boundaries — each Lit producer renders in its own shadow root, and shadow boundaries are opaque to outside CSS. Reaching *across* a Lit child's shadow boundary is [`::part()`](#part-—-cross-shadow-styling-for-lit-children) territory (see the next section); for influencing a Lit child's appearance without exposing a part, parent-side CSS variables remain a working alternative.

## `::part()` — cross-shadow styling for Lit children

`:deep()` reaches into a child's DOM **within one shadow root**. On Lit, where each component renders inside its *own* shadow root, `:deep()` stops at the child's shadow boundary — shadow boundaries are opaque to outside CSS. `::part()` is the W3C standards-track mechanism ([CSS Shadow Parts L1](https://www.w3.org/TR/css-shadow-parts-1/)) for the one thing `:deep()` cannot do on Lit: style an element **across** a child's shadow boundary. It is the only cross-shadow-piercing selector that is not on a deprecation track (`::shadow`, `/deep/`, `>>>` were removed; `::ng-deep` is deprecated).

It is a two-sided producer/consumer contract:

- **Producer** — tag the shadow element you want to expose with the standard HTML <span v-pre>`part="<name>"`</span> attribute. Part names are a **public API**: they are emitted **literally**, never scope-hashed.
- **Consumer** — style the exposed element with `<child-selector>::part(<name>)`. The part name on the consumer side must match the producer's `part=` name byte-for-byte.

```rozie
<!-- Producer: PartCard.rozie -->
<template>
  <div class="card-body" part="body">
    <slot/>
  </div>
</template>
```

```rozie
<!-- Consumer: PartCardConsumer.rozie -->
<template>
  <PartCard>Cross-shadow styled body content.</PartCard>
</template>

<style>
/* Reaches the child's part="body" element across the Lit shadow boundary. */
PartCard::part(body) {
  background: #fde68a;
  border: 2px solid #b45309;
}
</style>
```

### Cross-target translation

`::part()` only has meaning across a shadow boundary, so it is **load-bearing on Lit and a no-op everywhere else** — the other five targets have no shadow boundary, so a cross-shadow rule would be meaningless (and emitting it unscoped would leak broken global CSS). The rule is therefore dropped on those targets, and the child renders with its own producer styles only.

| Target | Consumer `::part()` rule | Producer `part="..."` attribute |
| --- | --- | --- |
| **Lit** | Emitted as the cross-shadow rule `<child-tag>[data-rozie-s-<hash>]::part(<name>)` — e.g. `rozie-part-card[data-rozie-s-7f4fb92a]::part(body)`. The scope attribute lands on the child-tag compound **before** `::part` so the rule is confined to *this* consumer's scoped child invocation; `::part` then pierces the child's one shadow boundary. The consumer's `static styles` already reach the child (it renders inside the consumer's shadow root), so no extra runtime is needed. | Emitted verbatim into the shadow template — addressable by the consumer's `::part(<name>)`. |
| **React** | Dropped (no-op). | Benign standard HTML attribute (`part="body"`). |
| **Solid** | Dropped (no-op). | Benign standard HTML attribute. |
| **Vue** | Dropped (no-op). | Benign standard HTML attribute. |
| **Svelte** | Dropped (no-op). | Benign standard HTML attribute. |
| **Angular** | Dropped (no-op). | Benign standard HTML attribute. |

### `::part()` vs `:deep()`

They solve different problems and are **not** interchangeable:

- `:deep()` is the **intra-scope** reach. It lifts the inner selector out of the parent's scope attribute so a parent styles a child's rendered DOM *within the same shadow root* — and it matches the child element **and its descendants** like any ordinary selector. On Lit it works inside one shadow root but cannot cross a shadow boundary. `:deep()` keeps its existing six-target behavior unchanged.
- `::part()` is the **only cross-shadow-boundary** reach. On Lit it pierces the child's shadow boundary to style the exposed part — but it matches **only** the element the producer tagged with `part=`, not that element's descendants (the part name is a flat, explicit, literal contract — there is no auto-derivation from class names). It is Lit-only-visible; the other five targets strip it.

In short: use `:deep()` to reach a child's DOM that lives in the same shadow tree; use `::part()` to reach across a Lit child's shadow boundary into an element the producer has explicitly exposed.

::: warning Give a `::part()` rule its own selector
Write a `::part()` selector as its own rule — do **not** combine it with non-`::part()` selectors in a single comma-separated list (e.g. `Child::part(body), .fallback { … }`). Because the five non-Lit targets drop any rule whose selector contains `::part()` as a whole, a sibling `.fallback` branch in the same rule would be dropped along with it on those targets. Splitting them into two rules keeps the non-`::part()` branch on every target.
:::

## `<style lang="scss">` — SCSS, compiled at build time

A `<style>` block opts into SCSS with `lang="scss"`. Rozie compiles it to plain CSS at build time — nesting, `$variables`, `@mixin`/`@include`, `&` parent-refs, `@if`/`@each`/`@for`, `@function`, `%placeholder`/`@extend`, `#{}` interpolation and the built-in `sass:` modules all resolve away before emit:

```rozie
<style lang="scss">
$divider: #ededed;

@mixin reset-list {
  list-style: none;
  margin: 0;
}

.list {
  border: 1px solid $divider;

  ul { @include reset-list; }
  li + li { border-top: 1px solid $divider; }
  &:hover { background: #f5f5f5; }
}
</style>
```

The compiled CSS flows through the **same scoping pass** as a plain `<style>`: it is scoped by default, and the `:root { }` global escape hatch above still works unchanged. SCSS here is a build-time preprocessing step, not a new runtime — because everything lowers to plain CSS before emit, all six targets receive byte-identical stylesheets.

`sass` (dart-sass) is an **optional peer dependency**. A plain-CSS component library never pulls it into its dependency tree; a library that uses `lang="scss"` declares it once (`pnpm add -D sass`). Compiling a `lang="scss"` component with `sass` absent is a compile error with a source-located code frame — not a silent fallback to raw SCSS. Invalid SCSS likewise surfaces as a diagnostic pointing inside the offending `<style>` block, never an uncaught throw.

v1 supports `lang="scss"` only. `lang="less"` is a deliberate deferral — the optional-peer model and the generic block-`lang=` substrate make it a clean later addition; today an unrecognized `lang` value is itself a compile error.
