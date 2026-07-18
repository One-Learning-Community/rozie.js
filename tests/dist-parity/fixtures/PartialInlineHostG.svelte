<script lang="ts">
import { applyListeners, rozieDisplay } from '@rozie/runtime-svelte';

interface Props {
  base?: number;
  [key: string]: unknown;
}

let { base = 1, ...__rozieAttrs }: Props = $props();

const headG = (n: number): number => n + 1;
let selectAllBoxG = headG(1);
const afterDeclG = (k: number): number => k * 2;
const midDeclG = (k: number): number => k + 3;
// before-side: the sandwiched host let trails the spliced midDeclG above
let rangeTransitionG = midDeclG(1);
const beforeDeclG = (k: number): number => k * 5;
// before-side: the sandwiched host let trails the spliced beforeDeclG above
let fillDragUpG = beforeDeclG(1);
</script>

<div {...__rozieAttrs} class={["partial-inline-host", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-298827ca><span class="echo" data-rozie-s-298827ca>{rozieDisplay(selectAllBoxG)}</span><span class="echo" data-rozie-s-298827ca>{rozieDisplay(afterDeclG(1))}</span><span class="echo" data-rozie-s-298827ca>{rozieDisplay(rangeTransitionG)}</span><span class="echo" data-rozie-s-298827ca>{rozieDisplay(beforeDeclG(1))}</span><span class="echo" data-rozie-s-298827ca>{rozieDisplay(fillDragUpG)}</span></div>
