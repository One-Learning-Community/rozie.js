<script lang="ts">
import DynamicSlots from './DynamicSlots.svelte';
import { applyListeners, rozieDisplay } from '@rozie/runtime-svelte';

interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();

let dynamicFillKey = $state('freeform');
</script>

<div {...__rozieAttrs} class={["dynamic-slots-consumer", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-e638f506><DynamicSlots columns={[{ key: 'status' }, { key: 'score' }]} row={{ status: 'Active', score: 42 }} total={7} data-rozie-s-e638f506 snippets={{ ['cell-status']: __rozieDynSlot_0, ['cell-score']: __rozieDynSlot_1, ['cell-total']: __rozieDynSlot_2, [dynamicFillKey]: __rozieDynSlot_3 }}>{#snippet headerCell({ title })}<h2 data-rozie-s-e638f506>{rozieDisplay(title)}</h2>{/snippet}{#snippet __rozieDynSlot_0({ row, value })}<span class="status" data-rozie-s-e638f506>{rozieDisplay(value)}</span>{/snippet}{#snippet __rozieDynSlot_1({ row, value })}<span class="score" data-rozie-s-e638f506>{rozieDisplay(value)}</span>{/snippet}{#snippet __rozieDynSlot_2({ value })}<strong data-rozie-s-e638f506>{rozieDisplay(value)}</strong>{/snippet}{#snippet __rozieDynSlot_3({ label })}<em data-rozie-s-e638f506>{rozieDisplay(label)}</em>{/snippet}</DynamicSlots></div>
