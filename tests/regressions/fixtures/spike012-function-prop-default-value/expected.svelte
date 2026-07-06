<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

interface Props {
  onPick?: (...args: any[]) => any;
  [key: string]: unknown;
}

let { onPick = () => {}, ...__rozieAttrs }: Props = $props();

let n = $state(0);

function bump(): void {
  n += 1;
}

const debouncedHandler0 = (() => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: any[]) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => (onPick as (...a: any[]) => any)(...args), 300);
  };
})();
</script>

<div {...__rozieAttrs} class={["r", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-8a79dce7><input oninput={debouncedHandler0} data-rozie-s-8a79dce7 /></div>
