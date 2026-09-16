import { useCallback, useState } from 'react';
import { rozieAttr } from '@rozie/runtime-react';

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
  /**
   * The column's human header, forwarded by the `#filter` slot scope — used as the control's accessible name in place of the internal column id.
   */
  columnLabel?: string;
}

export default function FilterText(_props: FilterTextProps): JSX.Element {
  const props: Omit<FilterTextProps, 'columnId' | 'column' | 'value' | 'setFilter' | 'columnLabel'> & { columnId: string; column: (unknown) | null; value: (unknown) | null; setFilter: ((...args: any[]) => any) | null; columnLabel: string } = {
    ..._props,
    columnId: _props.columnId ?? '',
    column: _props.column ?? null,
    value: _props.value ?? null,
    setFilter: _props.setFilter ?? null,
    columnLabel: _props.columnLabel ?? '',
  };
  const [draft, setDraft] = useState(() => props.value != null ? String(props.value) : '');

  // Untyped handler param neutralizes to `any`, so reading e.target.value typechecks
  // ×6 (the global-filter idiom). Never inline `$data.x = $event.target.value`.
  const onInput = useCallback((e: any) => {
    setDraft(e && e.target ? e.target.value : '');
  }, []);
  // setFilter is a Function prop (default null) — guard before calling.
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
  // C-11 — the accessible name must be the column's HUMAN header, not its internal id.
  // `columnId` is a lookup key (`unit_price`, `col_3`); a screen reader announcing it is
  // reading an implementation detail aloud. table-core keeps the authored header on
  // `column.columnDef.header`, which is a string for every declarative `<Column header>`;
  // a header rendered by a function has no static text, so fall back to the id rather
  // than invent one.
  function a11yLabel() {
    if (typeof props.columnLabel === 'string' && props.columnLabel !== '') return props.columnLabel;
    return props.columnId;
  }

  return (
    <>
    <input className={"rdt-col-filter"} part="col-filter" type="text" aria-label={rozieAttr(a11yLabel())} value={draft} onInput={($event) => { onInput($event); }} onKeyDown={($event) => { onKeydown($event); }} onBlur={($event) => { onBlur(); }} data-rozie-s-18cbb44e="" />
    </>
  );
}
