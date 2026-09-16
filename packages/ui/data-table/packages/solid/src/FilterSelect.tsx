import type { JSX } from 'solid-js';
import { mergeProps, splitProps } from 'solid-js';
import { Key } from '@solid-primitives/keyed';
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
  setFilter?: ((...args: any[]) => any) | null;
  /**
   * The faceted distinct keys for this column (cross-filtered, keys only — no occurrence counts) used to build the `<option>` list.
   */
  uniqueValues?: any[];
  /**
   * The column's human header, forwarded by the `#filter` slot scope — used as the control's accessible name in place of the internal column id.
   */
  columnLabel?: string;
}

export default function FilterSelect(_props: FilterSelectProps): JSX.Element {
  const _merged = mergeProps({ columnId: '', column: null, value: null, setFilter: null, uniqueValues: (() => [])() as any[], columnLabel: '' }, _props);
  const [local, attrs] = splitProps(_merged, ['columnId', 'column', 'value', 'setFilter', 'uniqueValues', 'columnLabel']);

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

  // C-11 — the accessible name must be the column's HUMAN header, not its internal id.
  // `columnId` is a lookup key (`unit_price`, `col_3`); a screen reader announcing it is
  // reading an implementation detail aloud. table-core keeps the authored header on
  // `column.columnDef.header`, which is a string for every declarative `<Column header>`;
  // a header rendered by a function has no static text, so fall back to the id rather
  // than invent one.
  function a11yLabel() {
    if (typeof local.columnLabel === 'string' && local.columnLabel !== '') return local.columnLabel;
    return local.columnId;
  }

  return (
    <>
    <select part="col-filter" aria-label={rozieAttr(a11yLabel())} class={"rdt-col-filter"} value={selectValue()} onChange={($event: Event & { currentTarget: HTMLSelectElement; target: Element }) => { onChange($event); }} data-rozie-s-d75b42b2="">
      <option value="" data-rozie-s-d75b42b2="">All</option>
      <Key each={local.uniqueValues as readonly any[]} by={(opt) => opt}>{(opt) => <option value={rozieAttr(opt())} data-rozie-s-d75b42b2="">{rozieDisplay(opt())}</option>}</Key>
    </select>
    </>
  );
}
