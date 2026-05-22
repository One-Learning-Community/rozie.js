<script setup>
import BadgeGridStyledScss from '../../examples/BadgeGridStyledScss.rozie';
</script>

# SCSS styling

A `<style>` block can opt into SCSS with a `lang="scss"` attribute. When it is present, the compiler runs the block through dart-sass *at compile time* — before the CSS scoping pass, before any target sees it. Every target then receives the same plain, already-compiled CSS, scoped exactly the way an ordinary `<style>` block is: React and Solid get hashed CSS-Module class names, Vue/Svelte/Angular get attribute-selector rewrites, Lit gets an adopted stylesheet. SCSS is an authoring convenience that has fully evaporated by the time the output reaches a framework — there is no per-target Sass runtime, and no `lang="scss"` attribute in any emitted file.

`BadgeGridStyledScss.rozie` is the programmatic-SCSS proving fixture: a static grid of status badges whose markup exists only to give the stylesheet real selectors to target. It deliberately exercises the SCSS surface that has no plain-CSS equivalent:

- `@use 'sass:map'` — a built-in Sass module. (No filesystem `@use` — the compile configures no importer, so only Sass's own built-in modules resolve.)
- a Sass **map** (`$status-colors`), iterated with `@each` and read with `map.get`
- an `@function` with `@if` / `@else` control flow
- `@for`, generating an indexed spacing-utility scale
- a `%placeholder` pulled in with `@extend`
- `#{…}` interpolation — used in both a selector and a property value

::: tip `sass` is an optional peer dependency
SCSS support needs the `sass` package. It is an *optional* peer of `@rozie/core` — install it only if you author `<style lang="scss">` blocks (`pnpm add -D sass`). A `lang="scss"` block compiled with `sass` absent raises **ROZ085**; SCSS that dart-sass rejects raises **ROZ086** with a dart-sass code frame.
:::

## Live demo

The grid below is the actual `examples/BadgeGridStyledScss.rozie` file, compiled by `@rozie/unplugin/vite` into a Vue SFC. Its three-column layout, badge padding, and colors are all produced by the SCSS `@for`, `@function`, and `@each` constructs — yet the emitted SFC carries nothing but plain CSS.

<div class="rozie-demo">
  <ClientOnly>
    <BadgeGridStyledScss :badges="['Draft', 'In review', 'Shipped', 'Archived', 'Blocked', 'Done']" />
  </ClientOnly>
</div>

## Source — BadgeGridStyledScss.rozie

```rozie-src BadgeGridStyledScss
```

## Vue output

```rozie-out BadgeGridStyledScss vue
```

## React output

```rozie-out BadgeGridStyledScss react
```

## Svelte output

```rozie-out BadgeGridStyledScss svelte
```

## Angular output

```rozie-out BadgeGridStyledScss angular
```

## Solid output

```rozie-out BadgeGridStyledScss solid
```

## Lit output

```rozie-out BadgeGridStyledScss lit
```
