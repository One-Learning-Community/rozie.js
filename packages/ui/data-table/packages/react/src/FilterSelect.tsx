import { useCallback, useState } from 'react';
import { rozieAttr, rozieDisplay } from '@rozie/runtime-react';

interface FilterSelectProps {
  columnId?: string;
  column?: (unknown) | null;
  value?: (unknown) | null;
  setFilter?: ((...args: any[]) => any) | null;
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
    <select className={"rdt-col-filter"} aria-label={props.columnId} value={selectValue()} onChange={($event) => { onChange($event); }} data-rozie-s-d75b42b2="">
      <option value="" data-rozie-s-d75b42b2="">All</option>
      {props.uniqueValues.map((opt) => <option key={opt} value={rozieAttr(opt)} data-rozie-s-d75b42b2="">{rozieDisplay(opt)}</option>)}
    </select>
    </>
  );
}
