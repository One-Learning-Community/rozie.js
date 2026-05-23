<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

interface Props {
  checked?: boolean;
  [key: string]: unknown;
}

let { checked = $bindable(false), ...__rozieAttrs }: Props = $props();
</script>


<label {...__rozieAttrs} class={["toggle", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs}>
  
  <input type="checkbox" bind:checked={checked} />
  <span>Enabled</span>
</label>


<style>
.toggle { display: inline-flex; gap: 0.25rem; align-items: center; }
</style>
