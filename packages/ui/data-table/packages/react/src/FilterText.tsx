import { useCallback, useState } from 'react';

interface FilterTextProps {
  /**
   * The column id (mirrors the `#filter` slot scope) — used as the filter key and the input `aria-label`.
   */
  columnId?: string;
  /**
   * The table-core column object (opaque passthrough from the `#filter` slot scope).
   */
  column?: (unknown) | null;
  /**
   * The current column filter value the local draft seeds from (setup-once).
   */
  value?: (unknown) | null;
  /**
   * `(columnId, value) => void` — apply the column filter (Enter / blur applies, Escape clears). Null-guarded at call sites.
   */
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
    <input className={"rdt-col-filter"} part="col-filter" type="text" aria-label={props.columnId} value={draft} onInput={($event) => { onInput($event); }} onKeyDown={($event) => { onKeydown($event); }} onBlur={($event) => { onBlur(); }} data-rozie-s-18cbb44e="" />
    </>
  );
}
