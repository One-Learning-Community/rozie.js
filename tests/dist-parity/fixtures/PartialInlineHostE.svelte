<script lang="ts">
import { applyListeners, rozieDisplay } from '@rozie/runtime-svelte';

interface Props {
  base?: number;
  [key: string]: unknown;
}

let { base = 1, ...__rozieAttrs }: Props = $props();

const headE = (n: number): number => n + 1;
const usedNameE = (k: number): number => k * 2;
// leading: the inline host successor trails the spliced partial decl
const hostTailE = (n: number): number => usedNameE(n) + headE(n);
</script>

<div {...__rozieAttrs} class={["partial-inline-host", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-7214c3ba><span class="echo" data-rozie-s-7214c3ba>{rozieDisplay(usedNameE(1))}</span><span class="echo" data-rozie-s-7214c3ba>{rozieDisplay(hostTailE(1))}</span></div>
