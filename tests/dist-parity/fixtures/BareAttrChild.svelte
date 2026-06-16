<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

interface Props {
  combobox?: boolean;
  [key: string]: unknown;
}

let { combobox = false, ...__rozieAttrs }: Props = $props();
</script>

<div data-combobox={combobox} {...__rozieAttrs} class={["bare-attr-child", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-f0cdfe8a>
  combobox = {combobox}</div>
