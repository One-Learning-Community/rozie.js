<script lang="ts">
import { applyListeners, rozieDisplay } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';

interface Props {
  row?: any;
  total?: number;
  cellKey?: string;
  freeSlotName?: string;
  snippets?: { 'cell-total'?: Snippet<[{ value: any }]>; [key: `cell-${string}`]: Snippet<[{ row: any; value: any }]>; [key: `row-${string}`]: Snippet; } & Record<string, any>;
  [key: string]: unknown;
}

let __defaultRow = (() => ({}))();

let {
  row = __defaultRow,
  total = 0,
  cellKey = 'status',
  freeSlotName = 'freeform',
  snippets,
  ...__rozieAttrs
}: Props = $props();

const __rozieSlot_cellTotal = $derived(snippets?.['cell-total']);
const __rozieDynSlot1 = $derived(snippets?.[`cell-${cellKey}`]);
const __rozieDynSlot2 = $derived(snippets?.[`row-${freeSlotName}`]);
</script>

<div {...__rozieAttrs} class={["dynamic-slots", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-96693586>{#if __rozieSlot_cellTotal}{@render __rozieSlot_cellTotal({ value: total })}{:else}<strong data-rozie-s-96693586>{total}</strong>{/if}{#if __rozieDynSlot1}{@render __rozieDynSlot1({ row, value: row[cellKey] })}{:else}<span data-rozie-s-96693586>{rozieDisplay(row[cellKey])}</span>{/if}{#if __rozieDynSlot2}{@render __rozieDynSlot2()}{:else}<em data-rozie-s-96693586>fallback</em>{/if}</div>
