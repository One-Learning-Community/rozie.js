<script lang="ts">
import { applyListeners, rozieDisplay } from '@rozie/runtime-svelte';

interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();

let q = $state('');
let n = $state(0);

function noop(): void {}
</script>

<div {...__rozieAttrs} class={["r", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-18b4a8ad><input oninput={($event) => { q = ($event.currentTarget as HTMLInputElement).value; }} data-rozie-s-18b4a8ad /><span data-rozie-s-18b4a8ad>{rozieDisplay((n as number).toFixed(0))}</span></div>
