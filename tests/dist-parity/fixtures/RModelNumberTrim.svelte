<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();

let quantity = $state(0);
</script>


<div {...__rozieAttrs} class={["rmodel-number-trim", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs}>
  <input type="text" value={quantity} oninput={($event) => quantity = (Number.isNaN(Number.parseFloat((($event.currentTarget.value).trim()))) ? (($event.currentTarget.value).trim()) : Number.parseFloat((($event.currentTarget.value).trim())))} placeholder="Enter a quantity" />
  <p class="echo">Quantity: {quantity}</p>
</div>


<style>
.rmodel-number-trim { display: inline-flex; flex-direction: column; gap: 0.25rem; }
.echo { color: rgba(0, 0, 0, 0.55); font-size: 0.85em; }
</style>
