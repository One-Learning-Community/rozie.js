<script lang="ts">
import { applyListeners, rozieDisplay } from '@rozie/runtime-svelte';

import { getContext } from 'svelte';

interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();

const theme = getContext('theme');
</script>

<button data-theme-button="" type="button" {...__rozieAttrs} class={["theme-button", (__rozieAttrs)?.class]} onclick={($event) => { theme && theme.cycle(); }} use:applyListeners={__rozieAttrs} data-rozie-s-9f40a7ea>{rozieDisplay(theme && theme.color)}</button>

<style>
:global {
  .theme-button[data-rozie-s-9f40a7ea] {
    font-family: system-ui, -apple-system, sans-serif;
    padding: 0.375rem 0.75rem;
    border-radius: 6px;
    border: 1px solid rgba(0, 0, 0, 0.3);
    cursor: pointer;
  }
}
</style>
