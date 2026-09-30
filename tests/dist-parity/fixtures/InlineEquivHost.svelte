<script lang="ts">
import { applyListeners, rozieDisplay } from '@rozie/runtime-svelte';

interface Props extends Omit<import('svelte/elements').SvelteHTMLElements['div'], 'base' | 'children'> {
  base?: number;
}

let { base = 1, ...__rozieAttrs }: Props = $props();

import { clamp } from './partial-helpers.js';
const double = (n: number): number => n * 2;

const usedName = $derived(clamp(double(base)));
</script>

<div {...__rozieAttrs} class={["partial-inline-host", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-c60d9dd6><span class="echo" data-rozie-s-c60d9dd6>{rozieDisplay(usedName)}</span></div>
