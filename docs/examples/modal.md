<script setup>
import { ref } from 'vue';
import Modal from '../../examples/Modal.rozie';

const showModal = ref(false);
const closeCount = ref(0);
</script>

# Modal

The heaviest example in this set. Demonstrates the `<listeners>` block, `.self` modifier on a backdrop click, multiple colocated `$onMount` / `$onUnmount` hooks, `$emit` for parent-controlled close, named slots with scoped params, `r-if` (full unmount, not just hidden), and the `<components>` block (Modal embeds Counter in its body).

## Live demo

Click the button to open the *actual* `examples/Modal.rozie`. Press Escape, click the backdrop, or hit the × button to close. The Modal's body has a `<Counter />` inside it — that nested component is `examples/Counter.rozie`, resolved by the unplugin via Modal's `<components>` block.

<div class="rozie-demo">
  <button @click="showModal = true">Open Modal</button>

  <p>Closed {{ closeCount }} time{{ closeCount === 1 ? '' : 's' }}.</p>

  <ClientOnly>
    <Modal v-model:open="showModal" :lock-body-scroll="false" title="Hello from Rozie" @close="closeCount++">
      <p>This is the default slot. The header above is the named <code>header</code> slot's fallback content (since we didn't provide one); the title shown there is the <code>title</code> prop.</p>
      <p>The Counter below is <code>examples/Counter.rozie</code>, rendered through Modal's <code>&lt;components&gt;</code> block.</p>
    </Modal>
  </ClientOnly>
</div>

## Source — Modal.rozie

```rozie-src Modal
```

## Vue output

```rozie-out Modal vue
```

## React output

```rozie-out Modal react
```

## Svelte output

```rozie-out Modal svelte
```

## Angular output

```rozie-out Modal angular
```

## Solid output

```rozie-out Modal solid
```

## Lit output

```rozie-out Modal lit
```
