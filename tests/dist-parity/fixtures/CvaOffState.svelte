<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

interface Props {
  value?: string;
  [key: string]: unknown;
}

let { value = $bindable(''), ...__rozieAttrs }: Props = $props();

// Producer-side write to the `value` model prop: writing `$model.value`
// lowers to each target's two-way emit (Vue `emit('update:value', …)`,
// React `onValueChange?.(…)`, Angular `valueChange.emit(…)`, etc.). This is
// the single-model shape Phase 23's CVA auto-wires the Angular accessor onto.
function onInput(e: any) {
  value = e.target.value;
}
</script>

<div {...__rozieAttrs} class={["cva-off-state", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-a2873aa8><input type="text" value={value} placeholder="Type a value" oninput={onInput} data-rozie-s-a2873aa8 /><span class="echo" data-rozie-s-a2873aa8>{value}</span></div>

<style>
:global {
  .cva-off-state[data-rozie-s-a2873aa8] { display: inline-flex; align-items: center; gap: 0.5rem; }
  input[data-rozie-s-a2873aa8] { padding: 0.25rem 0.5rem; }
  .echo[data-rozie-s-a2873aa8] { color: rgba(0, 0, 0, 0.6); }
}
</style>
