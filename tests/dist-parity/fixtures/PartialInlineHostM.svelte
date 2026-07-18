<script lang="ts">
import { applyListeners, rozieDisplay } from '@rozie/runtime-svelte';

import { onMount } from 'svelte';

interface Props {
  base?: number;
  [key: string]: unknown;
}

let { base = 1, ...__rozieAttrs }: Props = $props();

const headM = (n: number): number => n + 1;
const gridKeydownHandlersM = (rIdx: number, cIdx: number): number => {
  const active = rIdx + cIdx;
  return active;
};
// the row-selection slice tracks which rows are checked
// across header-group and body rows alike

// inRange(rIdx, cIdx) gates the active cell within the
// current 2-D selection range before a keydown commits
let refreshRowModelM = 0;

onMount(() => {
  refreshRowModelM = gridKeydownHandlersM(1, headM(2));
});
</script>

<div {...__rozieAttrs} class={["partial-inline-host", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-5d3a593a><span class="echo" data-rozie-s-5d3a593a>{rozieDisplay(gridKeydownHandlersM(1, 2))}</span><span class="echo" data-rozie-s-5d3a593a>{rozieDisplay(refreshRowModelM)}</span></div>
