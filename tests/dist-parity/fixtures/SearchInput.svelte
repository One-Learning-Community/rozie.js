<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import { onMount } from 'svelte';

interface Props {
  placeholder?: string;
  minLength?: number;
  autofocus?: boolean;
  onsearch?: (...args: unknown[]) => void;
  onclear?: (...args: unknown[]) => void;
  [key: string]: unknown;
}

let {
  placeholder = 'Search…',
  minLength = 2,
  autofocus = false,
  onsearch,
  onclear,
  ...__rozieAttrs
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

onMount(() => {
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
    timer = setTimeout(() => (onSearch as (...a: any[]) => any)(...args), 300);
  };
})();
</script>

<div {...__rozieAttrs} class={["search-input", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-8bbc4a60><input bind:this={inputEl} type="search" placeholder={placeholder} bind:value={query} oninput={debouncedOnSearch} onkeydown={($event) => { (() => { (($event) => { if ($event.key !== 'Enter') return; (onSearch as (...a: any[]) => any)($event); })($event); })(); (() => { (($event) => { if ($event.key !== 'Escape') return; (clear as (...a: any[]) => any)($event); })($event); })(); }} data-rozie-s-8bbc4a60 />{#if query.length > 0}<button class="clear-btn" aria-label="Clear" onclick={clear} data-rozie-s-8bbc4a60>
    ×
  </button>{:else}<span class="hint" data-rozie-s-8bbc4a60>{minLength}+ chars</span>{/if}</div>

<style>
:global {
  .search-input[data-rozie-s-8bbc4a60] { display: inline-flex; align-items: center; gap: 0.25rem; }
  input[data-rozie-s-8bbc4a60] { padding: 0.25rem 0.5rem; }
  .clear-btn[data-rozie-s-8bbc4a60] { background: none; border: none; cursor: pointer; font-size: 1.25rem; }
  .hint[data-rozie-s-8bbc4a60] { color: rgba(0, 0, 0, 0.4); font-size: 0.85em; }
}
</style>
