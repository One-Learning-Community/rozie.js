<script lang="ts">
interface Props {
  placeholder?: string;
  minLength?: number;
  autofocus?: boolean;
  onsearch?: (...args: unknown[]) => void;
  onclear?: (...args: unknown[]) => void;
}

let {
  placeholder = 'Search…',
  minLength = 2,
  autofocus = false,
  onsearch,
  onclear,
}: Props = $props();

let query = $state('');

let inputEl = $state<HTMLInputElement | undefined>(undefined);

const onSearch = () => {
  if (isValid) onsearch?.(query);
};
const clear = () => {
  query = '';
  onclear?.();
};

const isValid = $derived(query.length >= minLength);

$effect(() => {
  if (autofocus) inputEl?.focus();

  // Returning a function from $onMount registers a teardown — equivalent to
  // a separate $onUnmount, useful when setup and teardown logic belong together.
  return () => {
    // e.g., abort an in-flight request initialized in this hook
  };
});

const debouncedOnSearch = (() => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: any[]) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => (onSearch)(...args), 300);
  };
})();
</script>


<div class="search-input">
  
  <input bind:this={inputEl} type="search" placeholder={placeholder} bind:value={query} oninput={debouncedOnSearch} onkeydown={(e) => { (() => { if (e.key !== 'Enter') return; onSearch(e); })(); (() => { if (e.key !== 'Escape') return; clear(e); })(); }} />

  {#if query.length > 0}<button class="clear-btn" aria-label="Clear" onclick={clear}>
    ×
  </button>{:else}<span class="hint">{minLength}+ chars</span>{/if}</div>


<style>
.search-input { display: inline-flex; align-items: center; gap: 0.25rem; }
input { padding: 0.25rem 0.5rem; }
.clear-btn { background: none; border: none; cursor: pointer; font-size: 1.25rem; }
.hint { color: rgba(0, 0, 0, 0.4); font-size: 0.85em; }
</style>
