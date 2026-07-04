<script lang="ts">
import { rozieAttr } from '@rozie/runtime-svelte';

interface Props {
  /**
   * The column id (mirrors the `#filter` slot scope) — used as the filter key and the input `aria-label` base.
   */
  columnId?: string;
  /**
   * The table-core column object (opaque passthrough from the `#filter` slot scope).
   */
  column?: (unknown) | null;
  /**
   * The current column filter value (`[min, max]` tuple or null) the two inputs seed from (setup-once).
   */
  value?: (unknown) | null;
  /**
   * `(columnId, value) => void` — apply the column filter as a `[min, max]` tuple (each side coerced to a Number or `undefined`, so a one-sided range works); both empty clears the filter. Null-guarded at call sites.
   */
  setFilter?: ((...args: any[]) => any) | null;
  /**
   * The faceted `[min, max]` bounds for this column (`[number, number]` or null) — drives the input placeholders only.
   */
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

<span style="display:contents" data-rozie-s-97b2c090><input class="rdt-col-filter" part="col-filter" type="number" aria-label={rozieAttr(columnId + ' min')} placeholder={rozieAttr(minPlaceholder())} value={minDraft} oninput={($event) => { onMinInput($event); }} onchange={($event) => { applyRange(); }} data-rozie-s-97b2c090 /><input class="rdt-col-filter" part="col-filter" type="number" aria-label={rozieAttr(columnId + ' max')} placeholder={rozieAttr(maxPlaceholder())} value={maxDraft} oninput={($event) => { onMaxInput($event); }} onchange={($event) => { applyRange(); }} data-rozie-s-97b2c090 /></span>
