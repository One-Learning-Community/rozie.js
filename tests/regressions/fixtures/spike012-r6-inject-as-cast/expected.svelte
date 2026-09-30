<script lang="ts">
import { applyListeners, rozieDisplay } from '@rozie/runtime-svelte';

import { getContext } from 'svelte';

interface Props extends Omit<import('svelte/elements').SvelteHTMLElements['div'], 'children'> {}

let { ...__rozieAttrs }: Props = $props();

const theme = (getContext('theme')) as {
  color: string;
  cycle: () => void;
} | undefined;
</script>

<div {...__rozieAttrs} class={["r", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-f072667f><button onclick={($event) => { theme && theme.cycle(); }} data-rozie-s-f072667f>{rozieDisplay(theme && theme.color)}</button></div>
