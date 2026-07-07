<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();

let q = $state('');

const label = $derived('x');

const debouncedHandler0 = (() => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: any[]) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => ((($event) => { q = label; }) as (...a: any[]) => any)(...args), 300);
  };
})();
</script>

<input {...__rozieAttrs} oninput={debouncedHandler0} use:applyListeners={__rozieAttrs} data-rozie-s-e598eaaa />
