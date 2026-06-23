import { useCallback, useState } from 'react';
import { rozieAttr } from '@rozie/runtime-react';

interface FilterNumberRangeProps {
  columnId?: string;
  column?: (unknown) | null;
  value?: (unknown) | null;
  setFilter?: ((...args: any[]) => any) | null;
  minMax?: (unknown) | null;
}

export default function FilterNumberRange(_props: FilterNumberRangeProps): JSX.Element {
  const props: Omit<FilterNumberRangeProps, 'columnId' | 'column' | 'value' | 'setFilter' | 'minMax'> & { columnId: string; column: (unknown) | null; value: (unknown) | null; setFilter: ((...args: any[]) => any) | null; minMax: (unknown) | null } = {
    ..._props,
    columnId: _props.columnId ?? '',
    column: _props.column ?? null,
    value: _props.value ?? null,
    setFilter: _props.setFilter ?? null,
    minMax: _props.minMax ?? null,
  };
  const [minDraft, setMinDraft] = useState(() => Array.isArray(props.value) && props.value[0] != null ? String(props.value[0]) : '');
  const [maxDraft, setMaxDraft] = useState(() => Array.isArray(props.value) && props.value[1] != null ? String(props.value[1]) : '');

  const onMinInput = useCallback((e: any) => {
    setMinDraft(e && e.target ? e.target.value : '');
  }, []);
  const onMaxInput = useCallback((e: any) => {
    setMaxDraft(e && e.target ? e.target.value : '');
  }, []);
  function minPlaceholder() {
    return Array.isArray(props.minMax) && props.minMax[0] != null ? String(props.minMax[0]) : '';
  }
  function maxPlaceholder() {
    return Array.isArray(props.minMax) && props.minMax[1] != null ? String(props.minMax[1]) : '';
  }
  const { setFilter: _rozieProp_setFilter } = props;
    const applyRange = useCallback(() => {
    const minNum = minDraft === '' ? undefined : Number(minDraft);
    const maxNum = maxDraft === '' ? undefined : Number(maxDraft);
    if (minNum === undefined && maxNum === undefined) {
      _rozieProp_setFilter && _rozieProp_setFilter(props.columnId, '');
    } else {
      _rozieProp_setFilter && _rozieProp_setFilter(props.columnId, [minNum, maxNum]);
    }
  }, [_rozieProp_setFilter, maxDraft, minDraft, props.columnId]);

  return (
    <>
    <span style={{ display: "contents" }} data-rozie-s-97b2c090="">
      <input className={"rdt-col-filter"} type="number" aria-label={rozieAttr(props.columnId + ' min')} placeholder={rozieAttr(minPlaceholder())} value={minDraft} onInput={($event) => { onMinInput($event); }} onChange={($event) => { applyRange(); }} data-rozie-s-97b2c090="" />
      <input className={"rdt-col-filter"} type="number" aria-label={rozieAttr(props.columnId + ' max')} placeholder={rozieAttr(maxPlaceholder())} value={maxDraft} onInput={($event) => { onMaxInput($event); }} onChange={($event) => { applyRange(); }} data-rozie-s-97b2c090="" />
    </span>
    </>
  );
}
