<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

interface Props {
  quantity?: number;
  [key: string]: unknown;
}

let { quantity = $bindable(0), ...__rozieAttrs }: Props = $props();
</script>

<div {...__rozieAttrs} class={["rmodel-number-model-prop", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-ce78b2e7><input type="text" value={quantity} oninput={($event) => quantity = ((Number.isNaN(Number.parseFloat(($event.currentTarget.value))) ? ($event.currentTarget.value) : Number.parseFloat(($event.currentTarget.value))) as number)} data-rozie-s-ce78b2e7 /></div>
