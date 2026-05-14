<script setup>
import { ref } from 'vue';
import SearchInput from '../../examples/SearchInput.rozie';

const events = ref([]);
function logEvent(type, value) {
  events.value.unshift({ type, value, at: new Date().toLocaleTimeString() });
  if (events.value.length > 6) events.value.length = 6;
}
</script>

# SearchInput

Demonstrates `r-model` on a form input, `$emit` for custom events, `$onMount` with a teardown return, the parameterized `.debounce(300)` modifier, conditional rendering (`r-if` / `r-else`), and `$refs`.

## Live demo

Type at least 2 characters. The `.debounce(300)` modifier means `search` fires only after you stop typing for 300ms. Hit Enter to fire immediately, Escape to clear.

<div class="rozie-demo">
  <ClientOnly>
    <SearchInput :min-length="2" @search="(q) => logEvent('search', q)" @clear="() => logEvent('clear', '')" />
  </ClientOnly>

  <div v-if="events.length > 0" style="margin-top: 0.75rem;">
    <strong>Recent events:</strong>
    <ul>
      <li v-for="(e, i) in events" :key="i"><code>{{ e.type }}</code> — <code>{{ JSON.stringify(e.value) }}</code> at {{ e.at }}</li>
    </ul>
  </div>
</div>

## Source — SearchInput.rozie

```rozie-src SearchInput
```

## Vue output

```rozie-out SearchInput vue
```

## React output

```rozie-out SearchInput react
```

## Svelte output

```rozie-out SearchInput svelte
```

## Angular output

```rozie-out SearchInput angular
```

## Solid output

```rozie-out SearchInput solid
```

## Lit output

```rozie-out SearchInput lit
```
