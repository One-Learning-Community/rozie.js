<script lang="ts">
import { applyListeners, rozieDisplay } from '@rozie/runtime-svelte';

import { onMount } from 'svelte';

interface Props {
  base?: number;
  [key: string]: unknown;
}

let { base = 1, ...__rozieAttrs }: Props = $props();

import { clampB } from './partial-helpers.js';
import { clampD } from './wr01-helpers.js';
const headM = (n: number): number => n + 1;
let editTransitionM = 1;
// after-side: comment trails the host let editTransitionM and leads the spliced editorBindingsM below
const editorBindingsM = (k: number): number => k * 2;
// trailing-seam: the inline host successor trails the spliced editorBindingsM
const hostTailM = (n: number): number => editorBindingsM(1) + headM(n);
const tickM = (): number => base * 2;
// gap-0 leading: stays with the extracted columnChromeM, must NOT float to the hoisted import
const columnChromeM = (k: number): number => clampB(tickM() + k);

const inner = $derived(base + 10);
const outerM = $derived(clampD(inner + base));

onMount(() => {
  editTransitionM = 2;
});
</script>

<div {...__rozieAttrs} class={["partial-inline-host", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-f6996e0e><span class="echo" data-rozie-s-f6996e0e>{rozieDisplay(editTransitionM)}</span><span class="echo" data-rozie-s-f6996e0e>{rozieDisplay(hostTailM(1))}</span><span class="echo" data-rozie-s-f6996e0e>{rozieDisplay(columnChromeM(1))}</span><span class="echo" data-rozie-s-f6996e0e>{rozieDisplay(outerM)}</span></div>
