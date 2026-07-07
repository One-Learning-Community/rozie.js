<script lang="ts">
import { applyListeners, rozieDisplay } from '@rozie/runtime-svelte';

interface Props {
  raw?: string;
  [key: string]: unknown;
}

let { raw = '', ...__rozieAttrs }: Props = $props();

const label = ($derived(raw + '!')) as string;
</script>

<div {...__rozieAttrs} class={["r", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-6ad03933>{rozieDisplay(label)}</div>
