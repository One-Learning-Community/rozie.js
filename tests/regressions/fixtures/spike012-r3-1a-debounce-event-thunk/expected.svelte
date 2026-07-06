<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();

let q = $state('');

function noop(): void {}

const debouncedHandler0 = (() => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: any[]) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => ((($event) => { q = $event.target.value; }) as (...a: any[]) => any)(...args), 300);
  };
})();
</script>

<div {...__rozieAttrs} class={["r", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-9b5987c7><input oninput={debouncedHandler0} data-rozie-s-9b5987c7 /></div>
