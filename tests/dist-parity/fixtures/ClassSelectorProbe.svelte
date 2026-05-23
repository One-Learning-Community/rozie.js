<script lang="ts">
import { onMount } from 'svelte';

interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();

let ready = $state(false);

// script-position class-selector helper call — exercises the rewriteScript.ts
// hook. Lowers per-target: ".grip" literal (Vue/Svelte/Solid/Angular/Lit) or
// "." + styles.grip (React).
const gripSelector = ".grip";

onMount(() => {
  ready = true;
});
</script>


<div data-handle={".panel"} data-grip={gripSelector} {...__rozieAttrs} class={["panel", (__rozieAttrs)?.class]}>
  <span class="grip" aria-hidden="true">⋮⋮</span>
  {#if ready}<span>ready</span>{/if}</div>


<style>
.panel {
  display: block;
  padding: 0.5rem;
  font-family: system-ui, -apple-system, sans-serif;
}
.grip {
  cursor: grab;
  user-select: none;
  color: rgba(0, 0, 0, 0.35);
}
</style>
