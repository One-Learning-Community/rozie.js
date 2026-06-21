<script lang="ts">
import { applyListeners, rozieDisplay } from '@rozie/runtime-svelte';

interface Props {
  base?: number;
  [key: string]: unknown;
}

let { base = 1, ...__rozieAttrs }: Props = $props();

import { clamp } from './partial-helpers.js';
const tickF = base * 2;
// leading: the first used $computed export sits ZERO blank lines below the import (the gap-0 seam)

const usedFirstF = $derived(clamp(tickF + base));
const usedSecondF = $derived(clamp(usedFirstF + 1));
</script>

<div {...__rozieAttrs} class={["partial-inline-host", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-13935c1a><span class="echo" data-rozie-s-13935c1a>{rozieDisplay(usedFirstF)}</span><span class="echo" data-rozie-s-13935c1a>{rozieDisplay(usedSecondF)}</span></div>
