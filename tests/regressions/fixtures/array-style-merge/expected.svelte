<script lang="ts">
import { applyListeners, rozieStyle } from '@rozie/runtime-svelte';

interface Props {
  base?: any;
  s?: string;
  [key: string]: unknown;
}

let __defaultBase = (() => ({}))();

let {
  base = __defaultBase,
  s = '',
  ...__rozieAttrs
}: Props = $props();
</script>

<div {...__rozieAttrs} use:applyListeners={__rozieAttrs} data-rozie-s-c967fd9e><span style={rozieStyle([{ color: 'red' }, { color: 'blue' }])} data-rozie-s-c967fd9e>object+object override (later wins → blue)</span><span style={rozieStyle([s, { fontSize: '12px' }])} data-rozie-s-c967fd9e>string+object</span><span style={rozieStyle([base, s])} data-rozie-s-c967fd9e>dynamic+dynamic</span></div>
