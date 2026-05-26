<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import { onMount } from 'svelte';

interface Props {
  a?: (any) | null;
  b?: number;
  c?: string;
  d?: boolean;
  e?: any[];
  f?: any;
  [key: string]: unknown;
}

let __defaultE = (() => [])();
let __defaultF = (() => ({
  k: 1
}))();

let {
  a = null,
  b = 0,
  c = '',
  d = false,
  e = __defaultE,
  f = __defaultF,
  ...__rozieAttrs
}: Props = $props();

let observed = $state(null);

onMount(() => {
  observed = {
    a: a,
    b: b,
    c: c,
    d: d,
    e: e,
    f: f
  };
});
</script>


<div {...__rozieAttrs} class={["pdc", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-109e595c>
  <pre data-rozie-pdc-output="" data-rozie-s-109e595c>{JSON.stringify(observed)}</pre>
  
  <span data-rozie-pdc-e-identity="" data-rozie-s-109e595c>{e === e ? 'true' : 'false'}</span>
  <span data-rozie-pdc-f-identity="" data-rozie-s-109e595c>{f === f ? 'true' : 'false'}</span>
</div>


<style>
:global {
  .pdc[data-rozie-s-109e595c] {
    display: inline-flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.25rem;
    font-family: ui-monospace, monospace;
  }
  .pdc[data-rozie-s-109e595c] pre[data-rozie-s-109e595c] {
    margin: 0;
  }
}
</style>
