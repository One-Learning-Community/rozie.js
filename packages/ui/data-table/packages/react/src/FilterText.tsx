import { useCallback, useState } from 'react';

interface FilterTextProps {
  columnId?: string;
  column?: (unknown) | null;
  value?: (unknown) | null;
  setFilter?: ((...args: any[]) => any) | null;
}

export default function FilterText(_props: FilterTextProps): JSX.Element {
  const props: Omit<FilterTextProps, 'columnId' | 'column' | 'value' | 'setFilter'> & { columnId: string; column: (unknown) | null; value: (unknown) | null; setFilter: ((...args: any[]) => any) | null } = {
    ..._props,
    columnId: _props.columnId ?? '',
    column: _props.column ?? null,
    value: _props.value ?? null,
    setFilter: _props.setFilter ?? null,
  };
  const [draft, setDraft] = useState(() => props.value != null ? String(props.value) : '');

  const onInput = useCallback((e: any) => {
    setDraft(e && e.target ? e.target.value : '');
  }, []);
  function applyFilter() {
    props.setFilter && props.setFilter(props.columnId, draft);
  }
  function clearFilter() {
    setDraft('');
    props.setFilter && props.setFilter(props.columnId, '');
  }
  const onKeydown = useCallback((e: any) => {
    if (e && e.key === 'Enter') {
      e.preventDefault();
      applyFilter();
    } else if (e && e.key === 'Escape') {
      e.preventDefault();
      clearFilter();
    }
  }, [applyFilter, clearFilter]);
  const onBlur = useCallback(() => {
    applyFilter();
  }, [applyFilter]);

  return (
    <>
    <input className={"rdt-col-filter"} type="text" aria-label={props.columnId} value={draft} onInput={($event) => { onInput($event); }} onKeyDown={($event) => { onKeydown($event); }} onBlur={($event) => { onBlur(); }} data-rozie-s-18cbb44e="" />
    </>
  );
}
