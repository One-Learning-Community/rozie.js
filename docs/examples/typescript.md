<script setup>
import TypedCard from '../../examples/typed/TypedCard.rozie';
</script>

# TypeScript authoring

A `<script>` block can opt into TypeScript with a `lang="ts"` attribute. The compiler keeps every author-written annotation intact and routes it to the right place in each target: a typed `$computed` becomes a typed `computed()` / `useMemo` / `$derived` / `signal`, a typed prop flows into `defineProps<T>()` (Vue), a React `interface`, Svelte's `$props<T>()`, Angular's `@Input()` types. Rozie does not transpile the TypeScript itself — each target's own toolchain (`vue-tsc`, `svelte-check`, `tsc`) does, exactly as it would for a hand-written component.

`TypedCard.rozie` is the type-*preservation* fixture. It is not a typed fork of an untyped example — it proves things no untyped component can:

- it declares an `interface` (`CardMeta`) and a `type` alias (`Tone`) *inside* the `<script lang="ts">` block
- it uses a type-only import — `import type { Options } from 'sortablejs'`
- those author types are consumed by typed `$computed` declarations and a typed function parameter

::: tip Statement-position type declarations are hoisted
A bare `interface` or `type` written at statement position has to reach *module* scope on the class-based targets — Angular and Lit wrap the component body in a class, and a type declaration cannot live inside a class body. The compiler hoists `interface CardMeta` and `type Tone` out to module scope for those two targets; on the function-bodied targets (React / Vue / Solid) they stay where they were authored. Compare the Angular and React outputs below to see the split.
:::

::: tip Type-only imports survive — and stay erasable
`import type { Options } from 'sortablejs'` reaches every target's module scope as an `import type`, never a value import. It is referenced by the `optionCount` parameter annotation, so the type checker genuinely *uses* it — but because it is `import type`, it is fully erased from the runtime bundle. The live demo below needs no `sortablejs` dependency at all.
:::

## Live demo

The card below is the actual `examples/typed/TypedCard.rozie` file, compiled by `@rozie/unplugin/vite` into a Vue SFC. The heading text comes from the typed `badge` computed (`meta.emphasis ? label.toUpperCase() : label`), the meta line from `optionLabel`, and the accent border from the `tone` prop.

<div class="rozie-demo">
  <ClientOnly>
    <TypedCard title="Roadmap" tone="accent">
      <p style="margin: 0;">Default-slot content. The card chrome, the uppercased title, and the accent border are all driven by typed <code>$computed</code> declarations.</p>
    </TypedCard>
  </ClientOnly>
</div>

## Source — TypedCard.rozie

```rozie-src TypedCard
```

## Compiled output

::: code-group

```rozie-out TypedCard vue
```

```rozie-out TypedCard react
```

```rozie-out TypedCard svelte
```

```rozie-out TypedCard angular
```

```rozie-out TypedCard solid
```

```rozie-out TypedCard lit
```

:::
