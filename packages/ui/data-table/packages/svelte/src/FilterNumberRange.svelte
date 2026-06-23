<script lang="ts">
import { rozieAttr } from '@rozie/runtime-svelte';

interface Props {
  columnId?: string;
  column?: (unknown) | null;
  value?: (unknown) | null;
  setFilter?: ((...args: any[]) => any) | null;
  minMax?: (unknown) | null;
}

let {
  columnId = '',
  column = null,
  value = null,
  setFilter = null,
  minMax = null
}: Props = $props();

let minDraft = $state('');
let maxDraft = $state('');

// Seed both drafts once at setup from the incoming [min,max] tuple (setup-once).
minDraft = Array.isArray(value) && value[0] != null ? String(value[0]) : '';
maxDraft = Array.isArray(value) && value[1] != null ? String(value[1]) : '';

// Untyped handler params neutralize to `any` (the global-filter idiom).
// Untyped handler params neutralize to `any` (the global-filter idiom).
const onMinInput = (e: any) => {
  minDraft = e && e.target ? e.target.value : '';
};
const onMaxInput = (e: any) => {
  maxDraft = e && e.target ? e.target.value : '';
};

// Plain string-coercion functions for the placeholders (NOT $computed — the
// EditorSelect/listbox lesson; opaque slot-scope props rejected by strict leaf tsc).
// Plain string-coercion functions for the placeholders (NOT $computed — the
// EditorSelect/listbox lesson; opaque slot-scope props rejected by strict leaf tsc).
const minPlaceholder = () => Array.isArray(minMax) && minMax[0] != null ? String(minMax[0]) : '';
const maxPlaceholder = () => Array.isArray(minMax) && minMax[1] != null ? String(minMax[1]) : '';

// Convert a draft to a Number or undefined (empty string → undefined so a
// one-sided range works). Both undefined → clear the filter.
// Convert a draft to a Number or undefined (empty string → undefined so a
// one-sided range works). Both undefined → clear the filter.
const applyRange = () => {
  const minNum = minDraft === '' ? undefined : Number(minDraft);
  const maxNum = maxDraft === '' ? undefined : Number(maxDraft);
  if (minNum === undefined && maxNum === undefined) {
    setFilter && setFilter(columnId, '');
  } else {
    setFilter && setFilter(columnId, [minNum, maxNum]);
  }
};
</script>

<span style="display:contents" data-rozie-s-97b2c090><input class="rdt-col-filter" type="number" aria-label={rozieAttr(columnId + ' min')} placeholder={rozieAttr(minPlaceholder())} value={minDraft} oninput={($event) => { onMinInput($event); }} onchange={($event) => { applyRange(); }} data-rozie-s-97b2c090 /><input class="rdt-col-filter" type="number" aria-label={rozieAttr(columnId + ' max')} placeholder={rozieAttr(maxPlaceholder())} value={maxDraft} oninput={($event) => { onMaxInput($event); }} onchange={($event) => { applyRange(); }} data-rozie-s-97b2c090 /></span>
