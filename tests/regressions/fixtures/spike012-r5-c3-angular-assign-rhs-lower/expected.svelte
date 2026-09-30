<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

interface Props extends Omit<import('svelte/elements').SvelteHTMLElements['div'], 'value' | 'children'> {
  value?: string;
}

let { value = $bindable(''), ...__rozieAttrs }: Props = $props();

let n = $state(0);
let q = $state('');

function noop(): void {}

const debouncedHandler0 = (() => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: any[]) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => ((($event) => { value = ($event.currentTarget as HTMLInputElement).value; }) as (...a: any[]) => any)(...args), 300);
  };
})();
</script>

<div {...__rozieAttrs} class={["r", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-d6f96745><button onclick={($event) => { q = n > 0 ? 'a' : 'b'; }} data-rozie-s-d6f96745>go</button><input oninput={debouncedHandler0} data-rozie-s-d6f96745 /></div>
