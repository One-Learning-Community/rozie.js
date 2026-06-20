<script lang="ts">
import { applyListeners, rozieClass } from '@rozie/runtime-svelte';

interface Props {
  variant?: string;
  arr?: any[];
  flags?: any;
  [key: string]: unknown;
}

let __defaultArr = (() => [])();
let __defaultFlags = (() => ({}))();

let {
  variant = 'primary',
  arr = __defaultArr,
  flags = __defaultFlags,
  ...__rozieAttrs
}: Props = $props();

let cond = $state(true);
</script>

<div {...__rozieAttrs} use:applyListeners={__rozieAttrs} data-rozie-s-8915b51f><span class={["static-a static-b", 'lit-a lit-b']} data-rozie-s-8915b51f>string literal</span><span class={variant} data-rozie-s-8915b51f>string-typed prop</span><span class={rozieClass(['arr-a', variant])} data-rozie-s-8915b51f>array literal</span><span class={{ active: cond }} data-rozie-s-8915b51f>object literal</span><span class={rozieClass(arr)} data-rozie-s-8915b51f>array via prop</span><span class={rozieClass(flags)} data-rozie-s-8915b51f>object via prop</span><span class={["base", rozieClass(arr)]} data-rozie-s-8915b51f>static + dynamic merge</span></div>
