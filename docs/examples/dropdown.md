<script setup>
import { ref } from 'vue';
import Dropdown from '../../examples/Dropdown.rozie';

const dropdownOpen = ref(false);
</script>

# Dropdown

The marquee `<listeners>` example. Shows the `.outside(...$refs)` modifier eliminating hand-rolled outside-click detection, `.throttle(100).passive` on a window resize, reactive `when` predicates that auto-attach/detach listeners, `$watch(() => $props.open, ...)` re-firing reposition when the panel mounts (the panel is `r-if`-gated, so `$refs.panelEl` is undefined at initial `$onMount`), multiple `$onMount` hooks colocated with their setup, named slots with scoped params (`#trigger="{ open, toggle }"`), and `$props` writes flowing through to each target's two-way pattern because `open` is declared `model: true`.

## Live demo

Click the trigger to open. Then try: clicking outside the panel (closes via `.outside($refs.triggerEl, $refs.panelEl)`), pressing Escape (closes via `document:keydown.escape`), or resizing the window with the panel open (the panel's position updates, throttled to 100ms via `.throttle(100).passive`).

<div class="rozie-demo">
  <ClientOnly>
    <Dropdown v-model:open="dropdownOpen">
      <!--
        Note: do NOT bind @click="toggle" on the trigger button. Dropdown.rozie's
        wrapper div already calls toggle on click and the event bubbles up — adding
        an inner @click handler would double-fire and immediately re-close. The
        slot's `:toggle` param is exposed for programmatic use (e.g. closing from
        a different in-panel action), not for wiring the trigger click itself.
      -->
      <template #trigger="{ open }">
        <button>{{ open ? 'Close' : 'Open' }} dropdown</button>
      </template>
      <ul style="margin: 0; padding: 0.25rem; list-style: none; min-width: 12rem;">
        <li style="padding: 0.25rem 0.75rem; cursor: pointer;">First menu item</li>
        <li style="padding: 0.25rem 0.75rem; cursor: pointer;">Second menu item</li>
        <li style="padding: 0.25rem 0.75rem; cursor: pointer;">Third menu item</li>
      </ul>
    </Dropdown>
  </ClientOnly>
</div>

## Source — Dropdown.rozie

```rozie-src Dropdown
```

## Vue output

```rozie-out Dropdown vue
```

## React output

```rozie-out Dropdown react
```

## Svelte output

```rozie-out Dropdown svelte
```

## Angular output

```rozie-out Dropdown angular
```

## Solid output

```rozie-out Dropdown solid
```

## Lit output

```rozie-out Dropdown lit
```
