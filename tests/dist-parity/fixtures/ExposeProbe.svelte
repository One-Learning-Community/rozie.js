<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();

let value = $state('');

let field = $state<HTMLInputElement | undefined>(undefined);

export function reset(): void {
  value = '';
}
export function focus(): void {
  field!.focus();
}
</script>

<div {...__rozieAttrs} class={["expose-probe", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-dd2b93b0><input bind:this={field} type="text" bind:value={value} placeholder="Type something" data-rozie-s-dd2b93b0 /><span class="echo" data-rozie-s-dd2b93b0>{value}</span></div>

<style>
:global {
  .expose-probe[data-rozie-s-dd2b93b0] { display: inline-flex; align-items: center; gap: 0.5rem; }
  input[data-rozie-s-dd2b93b0] { padding: 0.25rem 0.5rem; }
  .echo[data-rozie-s-dd2b93b0] { font-variant-numeric: tabular-nums; color: rgba(0, 0, 0, 0.6); }
}
</style>
