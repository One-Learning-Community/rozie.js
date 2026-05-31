<script setup>
import { ref } from 'vue';
import Modal from '../../examples/Modal.rozie';

const showModal = ref(false);
const closeCount = ref(0);
</script>

# Modal

The heaviest example in this set. Demonstrates the `<listeners>` block (a `<listener :target="document" @keydown.escape="close" r-if="..." />` element), the `.self` modifier on a template-level backdrop click, multiple colocated `$onMount` / `$onUnmount` hooks, `$emit` for parent-controlled close, named slots with scoped params, and `r-if` (full unmount, not just hidden — distinct from the `r-if` *conditional-attach* on the `<listener>`).

## Live demo

Click the button to open the *actual* `examples/Modal.rozie`. Press Escape, click the backdrop, or hit the × button to close. The Modal renders whatever you pass into its default slot — the demo below passes plain paragraph content.

<div class="rozie-demo">
  <button @click="showModal = true">Open Modal</button>

  <p>Closed {{ closeCount }} time{{ closeCount === 1 ? '' : 's' }}.</p>

  <ClientOnly>
    <Modal v-model:open="showModal" :lock-body-scroll="false" title="Hello from Rozie" @close="closeCount++">
      <p>This is the default slot. The header above is the named <code>header</code> slot's fallback content (since we didn't provide one); the title shown there is the <code>title</code> prop.</p>
      <p>The Modal unmounts entirely on close — <code>r-if</code> removes it from the tree rather than just hiding it.</p>
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
