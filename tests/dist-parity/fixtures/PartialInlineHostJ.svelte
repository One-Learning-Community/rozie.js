<script lang="ts">
import { applyListeners, rozieDisplay } from '@rozie/runtime-svelte';

import { onMount } from 'svelte';

interface Props {
  base?: number;
  [key: string]: unknown;
}

let { base = 1, ...__rozieAttrs }: Props = $props();

const headJ = (n: number): number => n + 1;
const setColumnFilterJ = (colId: number, value: number): number => {
  const next = colId + value;
  return next;
};
// Re-read the row model + header groups into $data
let refreshRowModelJ = 0;

onMount(() => {
  refreshRowModelJ = setColumnFilterJ(1, headJ(2));
});
</script>

<div {...__rozieAttrs} class={["partial-inline-host", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-31bf38e2><span class="echo" data-rozie-s-31bf38e2>{rozieDisplay(setColumnFilterJ(1, 2))}</span><span class="echo" data-rozie-s-31bf38e2>{rozieDisplay(refreshRowModelJ)}</span></div>
