<script setup>
import { ref } from 'vue';
import Card from '../../examples/Card.rozie';

const closeCount = ref(0);
function handleClose() {
  closeCount.value++;
}
</script>

# Card (with CardHeader)

A wrapper-pair. `Card.rozie` declares `CardHeader` in its `<components>` block and renders `<CardHeader title=... :on-close=... />` at the top of its template; the rest of the body comes from a default slot.

## Live demo

The X button only renders because we passed an `onClose` handler — `CardHeader` does `r-if="$props.onClose"` on its close button.

<div class="rozie-demo">
  <ClientOnly>
    <Card title="Hello from Rozie" :on-close="handleClose">
      <p>This is the body. The header bar above is rendered by <code>CardHeader.rozie</code>, resolved through Card's <code>&lt;components&gt;</code> block.</p>
      <p>Close clicked {{ closeCount }} time{{ closeCount === 1 ? '' : 's' }}.</p>
    </Card>
  </ClientOnly>
</div>

Each target picks its idiomatic import + child-tag form for the cross-component reference:
- **Vue / Svelte** — import with the target extension (`./CardHeader.vue`, `./CardHeader.svelte`).
- **React / Solid** — bare-path import (`./CardHeader`).
- **Angular** — named import + class added to `@Component({ imports: [...] })`, and the `<CardHeader>` tag rewritten to selector form `<rozie-card-header>`.

Note the auto kebab/camel conversion: the source writes `:on-close="$props.onClose"`, and each emitter reconciles that against the `onClose` prop declaration in the appropriate per-target idiom.

---

## Card — source

```rozie-src Card
```

### Card — compiled output

::: code-group

```rozie-out Card vue
```

```rozie-out Card react
```

```rozie-out Card svelte
```

```rozie-out Card angular
```

```rozie-out Card solid
```

```rozie-out Card lit
```

:::

---

## CardHeader — source

A tiny leaf component (~30 lines) — no `<components>` block, no slots, no lifecycle. Stands alone and is consumed by Card. Worth seeing because the contrast with Card highlights the cost-of-features model: leaves are cheap, only components that actually need composition/listeners/refs pay for them.

```rozie-src CardHeader
```

### CardHeader — compiled output

::: code-group

```rozie-out CardHeader vue
```

```rozie-out CardHeader react
```

```rozie-out CardHeader svelte
```

```rozie-out CardHeader angular
```

```rozie-out CardHeader solid
```

```rozie-out CardHeader lit
```

:::
