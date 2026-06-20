<script lang="ts">
import { applyListeners, rozieDisplay } from '@rozie/runtime-svelte';

interface Props {
  base?: number;
  [key: string]: unknown;
}

let { base = 1, ...__rozieAttrs }: Props = $props();

import { clampD } from './wr01-helpers.js';

const inner = $derived(base + 10);
const outer = $derived(clampD(inner + base));
</script>

<div {...__rozieAttrs} class={["partial-inline-host", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-bf28abea><span class="echo" data-rozie-s-bf28abea>{rozieDisplay(outer)}</span></div>
