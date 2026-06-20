<script lang="ts">
import { applyListeners, rozieDisplay } from '@rozie/runtime-svelte';

interface Props {
  base?: number;
  [key: string]: unknown;
}

let { base = 1, ...__rozieAttrs }: Props = $props();

import { clamp } from './partial-helpers.js';

/* between-statement: a transitive non-exported helper pulled in as the closure of usedName */
/* between-statement: a transitive non-exported helper pulled in as the closure of usedName */
const double = (n: number): number => n * 2; // trailing: doubles its input

// leading: the used $computed export (comment immediately above)

const usedName = $derived(clamp(double(base)));
</script>

<div {...__rozieAttrs} class={["partial-inline-host", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-5163a222><span class="echo" data-rozie-s-5163a222>{rozieDisplay(usedName)}</span></div>
