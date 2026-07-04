import type { JSX } from 'solid-js';
import { For, mergeProps, splitProps } from 'solid-js';
import { rozieAttr, rozieDisplay } from '@rozie/runtime-solid';

interface FilterSelectProps {
  /**
   * The column id (mirrors the `#filter` slot scope) — used as the filter key and the select `aria-label`.
   */
  columnId?: string;
  /**
   * The table-core column object (opaque passthrough from the `#filter` slot scope).
   */
  column?: (unknown) | null;
  /**
   * The current column filter value the select seeds from (String-coerced).
   */
  value?: (unknown) | null;
  /**
   * `(columnId, value) => void` — apply the column filter on change; the leading empty "All" option clears it. Null-guarded at call sites.
   */
  setFilter?: ((...args: unknown[]) => unknown) | null;
  /**
   * The faceted distinct keys for this column (cross-filtered, keys only — no occurrence counts) used to build the `<option>` list.
   */
  uniqueValues?: any[];
}

export default function FilterSelect(_props: FilterSelectProps): JSX.Element {
  const _merged = mergeProps({ columnId: '', column: null, value: null, setFilter: null, uniqueValues: (() => [])() }, _props);
  const [local, attrs] = splitProps(_merged, ['columnId', 'column', 'value', 'setFilter', 'uniqueValues']);

  // The <select> value binding coerced to a string. $props.value is typed `unknown`
  // (opaque slot-scope), which the strict bundled-leaf tsc rejects against the native
  // select `value` type on React/Solid — the fix is a plain function returning a
  // string (uniform ×6, NOT a $computed; the EditorSelect/listbox value lesson).
  function selectValue() {
    return local.value != null ? String(local.value) : '';
  }

  // Immediate-apply-on-change: read the selected value the global-filter way. An
  // empty value (the leading "All" option) clears the column filter.
  function onChange(e: any) {
    const v = e && e.target ? e.target.value : '';
    if (v === '') {
      local.setFilter && local.setFilter(local.columnId, '');
    } else {
      local.setFilter && local.setFilter(local.columnId, v);
    }
  }

  return (
    <>
    <select part="col-filter" aria-label={local.columnId} class={"rdt-col-filter"} value={selectValue()} onChange={($event) => { onChange($event); }} data-rozie-s-d75b42b2="">
      <option value="" data-rozie-s-d75b42b2="">All</option>
      <For each={local.uniqueValues}>{(opt) => <option value={rozieAttr(opt)} data-rozie-s-d75b42b2="">{rozieDisplay(opt)}</option>}</For>
    </select>
    </>
  );
}
