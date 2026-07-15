<script lang="ts">
import { applyListeners, rozieDisplay } from '@rozie/runtime-svelte';

interface Props {
  base?: number;
  [key: string]: unknown;
}

let { base = 1, ...__rozieAttrs }: Props = $props();

const headI = (n: number): number => n + 1;
let rangeTransitionI = headI(1);
// after-side: comment trails the host let rangeTransitionI and leads the spliced afterDeclI below
const afterDeclI = (k: number): number => k * 2;
let fillDragUpI = afterDeclI(1);
</script>

<div {...__rozieAttrs} class={["partial-inline-host", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-ce4a0b5a><span class="echo" data-rozie-s-ce4a0b5a>{rozieDisplay(rangeTransitionI)}</span><span class="echo" data-rozie-s-ce4a0b5a>{rozieDisplay(afterDeclI(1))}</span><span class="echo" data-rozie-s-ce4a0b5a>{rozieDisplay(fillDragUpI)}</span></div>
