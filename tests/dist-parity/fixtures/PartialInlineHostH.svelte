<script lang="ts">
import { applyListeners, rozieDisplay } from '@rozie/runtime-svelte';

import { onMount } from 'svelte';

interface Props {
  base?: number;
  [key: string]: unknown;
}

let { base = 1, ...__rozieAttrs }: Props = $props();

import { clampH } from './partial-helpers.js';
let editTransitionH = 1;
// leading: stays with the extracted decl, must NOT float to the hoisted import
const editorBindingsH = (k: number): number => clampH(k * 2);

onMount(() => {
  editTransitionH = 2;
});
</script>

<div {...__rozieAttrs} class={["partial-inline-host", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-3844649a><span class="echo" data-rozie-s-3844649a>{rozieDisplay(editTransitionH)}</span><span class="echo" data-rozie-s-3844649a>{rozieDisplay(editorBindingsH(1))}</span></div>
