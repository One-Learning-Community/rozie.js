<script lang="ts">
import { applyListeners, rozieAttr } from '@rozie/runtime-svelte';

import { onMount } from 'svelte';

interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();

let ready = $state(false);

// script-position class-selector helper call — exercises the rewriteScript.ts
// hook. Lowers per-target: ".grip" literal (Vue/Svelte/Solid/Angular/Lit) or
// "." + styles.grip (React).
const gripSelector = ".grip";

onMount(() => {
  ready = true;
});
</script>

<div data-handle={rozieAttr(".panel")} data-grip={rozieAttr(gripSelector)} {...__rozieAttrs} class={["panel", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-899140be><span class="grip" aria-hidden="true" data-rozie-s-899140be>⋮⋮</span>{#if ready}<span data-rozie-s-899140be>ready</span>{/if}</div>

<style>
:global {
  .panel[data-rozie-s-899140be] {
    display: block;
    padding: 0.5rem;
    font-family: system-ui, -apple-system, sans-serif;
  }
  .grip[data-rozie-s-899140be] {
    cursor: grab;
    user-select: none;
    color: rgba(0, 0, 0, 0.35);
  }
}
</style>
