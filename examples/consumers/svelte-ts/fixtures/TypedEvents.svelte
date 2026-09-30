<script module lang="ts">
export type Count = number;
export interface PingPayload {
  count: Count;
  label: string;
}
</script>
<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';

interface Props extends Omit<import('svelte/elements').SvelteHTMLElements['div'], 'tone' | 'row' | 'snippets' | 'onping' | 'onreset' | 'onselect' | 'onrowopen' | 'children'> {
  tone?: string;
  row?: Snippet<[{ count: Count; tone: string }]>;
  snippets?: Record<string, any>;
  onping?: (payload: PingPayload) => void;
  onreset?: () => void;
  onselect?: (payload: number) => void;
  onrowopen?: (payload: {
    index: number;
  }) => void;
}

let {
  tone = 'info',
  row: __rowProp,
  snippets,
  onping,
  onreset,
  onselect,
  onrowopen,
  ...__rozieAttrs
}: Props = $props();

const row = $derived(__rowProp ?? snippets?.row);

let count = $state(0);

export function bump(): void;
export function bump() {
  const next = count + 1;
  count = next;
  onping?.({
    count: next,
    label: tone
  });
}
export function clear(...args: any[]): any;
export function clear() {
  count = 0;
  onreset?.();
}
export function getCount(): number;
export function getCount() {
  return count;
}
export function jump(to: number): void;
export function jump(...a: any[]) {
  count = a.length;
}
</script>

<div {...__rozieAttrs} class={["typed-events", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-78e83372><button class="bump" onclick={($event) => { bump(); }} data-rozie-s-78e83372>+</button><button class="clear" onclick={($event) => { clear(); }} ondblclick={($event) => { onselect?.(count); }} data-rozie-s-78e83372>reset</button><button class="open" onclick={($event) => { onrowopen?.({ index: count }); }} data-rozie-s-78e83372>open</button>{@render row?.({ count, tone })}</div>
