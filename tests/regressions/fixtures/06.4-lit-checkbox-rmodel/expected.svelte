<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

interface Props {
  checked?: boolean;
  [key: string]: unknown;
}

let { checked = $bindable(false), ...__rozieAttrs }: Props = $props();
</script>


<label {...__rozieAttrs} class={["toggle", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-5898a126>
  
  <input type="checkbox" bind:checked={checked} data-rozie-s-5898a126 />
  <span data-rozie-s-5898a126>Enabled</span>
</label>


<style>
:global {
  .toggle[data-rozie-s-5898a126] { display: inline-flex; gap: 0.25rem; align-items: center; }
}
</style>
