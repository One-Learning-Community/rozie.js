<script lang="ts">
import { applyListeners, rozieDisplay } from '@rozie/runtime-svelte';

interface Props extends Omit<import('svelte/elements').SvelteHTMLElements['div'], 'base' | 'children'> {
  base?: number;
}

let { base = 1, ...__rozieAttrs }: Props = $props();

import { clampD } from './wr01-helpers.js';

const inner = $derived(base + 10);
const outer = $derived(clampD(inner + base));
</script>

<div {...__rozieAttrs} class={["partial-inline-host", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-dd6eac9a><span class="echo" data-rozie-s-dd6eac9a>{rozieDisplay(outer)}</span></div>
