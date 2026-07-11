<script lang="ts">
import { applyListeners, rozieDisplay } from '@rozie/runtime-svelte';

interface Props {
  items?: any[];
  [key: string]: unknown;
}

let __defaultItems = (() => [])();

let { items = __defaultItems, ...__rozieAttrs }: Props = $props();

function noop(): void {}
</script>

<div {...__rozieAttrs} class={["r", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-f892f1a3>{#each items as x}{rozieDisplay(x)}{/each}</div>
