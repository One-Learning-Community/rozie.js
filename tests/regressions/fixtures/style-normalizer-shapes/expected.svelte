<script lang="ts">
import { applyListeners, rozieStyle } from '@rozie/runtime-svelte';

interface Props {
  s?: string;
  obj?: any;
  [key: string]: unknown;
}

let __defaultObj = (() => ({}))();

let {
  s = '',
  obj = __defaultObj,
  ...__rozieAttrs
}: Props = $props();
</script>

<div {...__rozieAttrs} use:applyListeners={__rozieAttrs} data-rozie-s-6d99ef35><span style:color={'red'} data-rozie-s-6d99ef35>object literal</span><span style={rozieStyle(s)} data-rozie-s-6d99ef35>string via prop</span><span style={rozieStyle(obj)} data-rozie-s-6d99ef35>object via prop</span></div>
