<script lang="ts">
import { applyListeners, rozieStyle } from '@rozie/runtime-svelte';

interface Props {
  colId?: string;
  [key: string]: unknown;
}

let { colId = 'a', ...__rozieAttrs }: Props = $props();

let pad = $state('padding-left:8px');

const pinStyle = (id: any) => `z-index:1;`;
</script>

<div {...__rozieAttrs} use:applyListeners={__rozieAttrs} data-rozie-s-6db87b32><span style={rozieStyle(pinStyle(colId) + ';' + pad)} data-rozie-s-6db87b32>bug element</span><span style={["color:red", 'font-weight:bold;']} data-rozie-s-6db87b32>merge-guard element</span></div>
