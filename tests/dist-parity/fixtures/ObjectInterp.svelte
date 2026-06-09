<script lang="ts">
import { applyListeners, rozieAttr, rozieDisplay } from '@rozie/runtime-svelte';

interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();

let obj = $state({
  a: 1,
  b: [2, 3]
});
</script>

<div {...__rozieAttrs} class={["object-interp", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-aca60b6e><p class={`card--${rozieDisplay(obj)}`} data-x={rozieAttr(obj)} data-rozie-s-aca60b6e>{rozieDisplay(obj)}</p></div>
