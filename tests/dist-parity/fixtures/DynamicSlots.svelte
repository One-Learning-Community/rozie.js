<script lang="ts">
import { applyListeners, rozieDisplay } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';

interface Props {
  columns?: any[];
  row?: any;
  total?: number;
  heading?: string;
  headerCell?: Snippet<[{ title: any }]>;
  snippets?: { 'cell-total'?: Snippet<[{ value: any }]>; [key: `cell-${string}`]: Snippet<[{ row: any; value: any }]>; } & Record<string, any>;
  [key: string]: unknown;
}

let __defaultColumns = (() => [])();
let __defaultRow = (() => ({}))();

let {
  columns = __defaultColumns,
  row = __defaultRow,
  total = 0,
  heading = 'Header',
  headerCell: __headerCellProp,
  snippets,
  ...__rozieAttrs
}: Props = $props();

const __rozieSlot_cellTotal = $derived(snippets?.['cell-total']);
const __rozieDynSlot1 = $derived(snippets?.[`cell-${col.key}`]);
const __rozieDynSlot2 = $derived(snippets?.[freeSlotName]);
const headerCell = $derived(__headerCellProp ?? snippets?.headerCell);

let freeSlotName = $state('freeform');
</script>

<div {...__rozieAttrs} class={["dynamic-slots", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-96693586>{#if __rozieSlot_cellTotal}{@render __rozieSlot_cellTotal({ value: total })}{:else}<strong data-rozie-s-96693586>{total}</strong>{/if}{#each columns as col (col.key)}<div data-rozie-s-96693586>{#if __rozieDynSlot1}{@render __rozieDynSlot1({ row, value: row[col.key] })}{:else}<span data-rozie-s-96693586>{rozieDisplay(row[col.key])}</span>{/if}</div>{/each}{#if __rozieDynSlot2}{@render __rozieDynSlot2({ label: freeSlotName })}{:else}<em data-rozie-s-96693586>fallback</em>{/if}{#if headerCell}{@render headerCell({ title: heading })}{:else}<h2 data-rozie-s-96693586>{heading}</h2>{/if}</div>
