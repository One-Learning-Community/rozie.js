<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();
</script>

<div class="rbind-probe" use:applyListeners={__rozieAttrs} data-rozie-s-8e2458d6><span class={['a', 'b']} {...{ id: 'x' }} data-rozie-s-8e2458d6>canonical</span><span {...{ id: 'y' }} class={['b', 'a']} data-rozie-s-8e2458d6>reordered</span></div>

<style>
:global {
  .rbind-probe[data-rozie-s-8e2458d6] {
    display: inline-flex;
    gap: 0.5rem;
    padding: 0.25rem;
  }
  .a[data-rozie-s-8e2458d6] { color: #1f2937; }
  .b[data-rozie-s-8e2458d6] { font-weight: 700; }
}
</style>
