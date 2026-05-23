<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();
</script>


<div class="rbind-probe" use:applyListeners={__rozieAttrs}>
  <span class={['a', 'b']} {...{ id: 'x' }}>canonical</span>
  <span {...{ id: 'y' }} class={['b', 'a']}>reordered</span>
</div>


<style>
.rbind-probe {
  display: inline-flex;
  gap: 0.5rem;
  padding: 0.25rem;
}
.a { color: #1f2937; }
.b { font-weight: 700; }
</style>
