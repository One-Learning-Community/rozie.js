import { useCallback, useState } from 'react';
import { rozieAttr, rozieDisplay } from '@rozie/runtime-react';

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
}

export default function FilterSelect(_props: FilterSelectProps): JSX.Element {
  const __defaultUniqueValues = useState(() => (() => [])())[0];
  const props: Omit<FilterSelectProps, 'columnId' | 'column' | 'value' | 'setFilter' | 'uniqueValues'> & { columnId: string; column: (unknown) | null; value: (unknown) | null; setFilter: ((...args: any[]) => any) | null; uniqueValues: any[] } = {
    ..._props,
    columnId: _props.columnId ?? '',
    column: _props.column ?? null,
    value: _props.value ?? null,
    setFilter: _props.setFilter ?? null,
    uniqueValues: _props.uniqueValues ?? __defaultUniqueValues,
  };

  function selectValue() {
    return props.value != null ? String(props.value) : '';
  }
  const { setFilter: _rozieProp_setFilter } = props;
    const onChange = useCallback((e: any) => {
    const v = e && e.target ? e.target.value : '';
    if (v === '') {
      _rozieProp_setFilter && _rozieProp_setFilter(props.columnId, '');
    } else {
      _rozieProp_setFilter && _rozieProp_setFilter(props.columnId, v);
    }
  }, [_rozieProp_setFilter, props.columnId]);

  return (
    <>
    <select className={"rdt-col-filter"} part="col-filter" aria-label={props.columnId} value={selectValue()} onChange={($event) => { onChange($event); }} data-rozie-s-d75b42b2="">
      <option value="" data-rozie-s-d75b42b2="">All</option>
      {props.uniqueValues.map((opt) => <option key={opt} value={rozieAttr(opt)} data-rozie-s-d75b42b2="">{rozieDisplay(opt)}</option>)}
    </select>
    </>
  );
}
