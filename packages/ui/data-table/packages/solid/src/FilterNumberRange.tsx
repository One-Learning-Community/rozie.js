import type { JSX } from 'solid-js';
import { createSignal, mergeProps, splitProps } from 'solid-js';
import { rozieAttr } from '@rozie/runtime-solid';

interface FilterNumberRangeProps {
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
  setFilter?: ((...args: unknown[]) => unknown) | null;
  /**
   * The faceted `[min, max]` bounds for this column (`[number, number]` or null) — drives the input placeholders only.
   */
  minMax?: (unknown) | null;
}

export default function FilterNumberRange(_props: FilterNumberRangeProps): JSX.Element {
  const _merged = mergeProps({ columnId: '', column: null, value: null, setFilter: null, minMax: null }, _props);
  const [local, attrs] = splitProps(_merged, ['columnId', 'column', 'value', 'setFilter', 'minMax']);

  const [minDraft, setMinDraft] = createSignal('');
  const [maxDraft, setMaxDraft] = createSignal('');

  // Seed both drafts once at setup from the incoming [min,max] tuple (setup-once).
  setMinDraft(Array.isArray(local.value) && local.value[0] != null ? String(local.value[0]) : '');
  setMaxDraft(Array.isArray(local.value) && local.value[1] != null ? String(local.value[1]) : '');

  // Untyped handler params neutralize to `any` (the global-filter idiom).
  function onMinInput(e: any) {
    setMinDraft(e && e.target ? e.target.value : '');
  }
  function onMaxInput(e: any) {
    setMaxDraft(e && e.target ? e.target.value : '');
  }

  // Plain string-coercion functions for the placeholders (NOT $computed — the
  // EditorSelect/listbox lesson; opaque slot-scope props rejected by strict leaf tsc).
  function minPlaceholder() {
    return Array.isArray(local.minMax) && local.minMax[0] != null ? String(local.minMax[0]) : '';
  }
  function maxPlaceholder() {
    return Array.isArray(local.minMax) && local.minMax[1] != null ? String(local.minMax[1]) : '';
  }

  // Convert a draft to a Number or undefined (empty string → undefined so a
  // one-sided range works). Both undefined → clear the filter.
  function applyRange() {
    const minNum = minDraft() === '' ? undefined : Number(minDraft());
    const maxNum = maxDraft() === '' ? undefined : Number(maxDraft());
    if (minNum === undefined && maxNum === undefined) {
      local.setFilter && local.setFilter(local.columnId, '');
    } else {
      local.setFilter && local.setFilter(local.columnId, [minNum, maxNum]);
    }
  }

  return (
    <>
    <span style={{ display: "contents" }} data-rozie-s-97b2c090="">
      <input part="col-filter" type="number" aria-label={rozieAttr(local.columnId + ' min')} class={"rdt-col-filter"} placeholder={rozieAttr(minPlaceholder())} value={minDraft()} onInput={($event) => { onMinInput($event); }} onChange={($event) => { applyRange(); }} data-rozie-s-97b2c090="" />
      <input part="col-filter" type="number" aria-label={rozieAttr(local.columnId + ' max')} class={"rdt-col-filter"} placeholder={rozieAttr(maxPlaceholder())} value={maxDraft()} onInput={($event) => { onMaxInput($event); }} onChange={($event) => { applyRange(); }} data-rozie-s-97b2c090="" />
    </span>
    </>
  );
}
