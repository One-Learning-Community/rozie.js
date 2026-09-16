import { useCallback, useState } from 'react';
import { rozieAttr } from '@rozie/runtime-react';

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
  setFilter?: ((...args: any[]) => any) | null;
  /**
   * The faceted `[min, max]` bounds for this column (`[number, number]` or null) — drives the input placeholders only.
   */
  minMax?: (unknown) | null;
  /**
   * The column's human header, forwarded by the `#filter` slot scope — used as the control's accessible name in place of the internal column id.
   */
  columnLabel?: string;
}

export default function FilterNumberRange(_props: FilterNumberRangeProps): JSX.Element {
  const props: Omit<FilterNumberRangeProps, 'columnId' | 'column' | 'value' | 'setFilter' | 'minMax' | 'columnLabel'> & { columnId: string; column: (unknown) | null; value: (unknown) | null; setFilter: ((...args: any[]) => any) | null; minMax: (unknown) | null; columnLabel: string } = {
    ..._props,
    columnId: _props.columnId ?? '',
    column: _props.column ?? null,
    value: _props.value ?? null,
    setFilter: _props.setFilter ?? null,
    minMax: _props.minMax ?? null,
    columnLabel: _props.columnLabel ?? '',
  };
  const [minDraft, setMinDraft] = useState(() => Array.isArray(props.value) && props.value[0] != null ? String(props.value[0]) : '');
  const [maxDraft, setMaxDraft] = useState(() => Array.isArray(props.value) && props.value[1] != null ? String(props.value[1]) : '');

  // Untyped handler params neutralize to `any` (the global-filter idiom).
  // C-01 — the range used to commit from `@change`, which is NOT the same event across
  // targets for a text/number input: React maps `onChange` onto the native `input`
  // event, so on React it fired on EVERY keystroke, in the same tick as the `@input`
  // handler's `$data` write. `$data` is an async `useState` write there, so the commit
  // re-read the PREVIOUS keystroke's draft and the filter ran one keystroke behind (the
  // first keystroke cleared it). The other five use the real `change` event — blur or
  // Enter — and were already correct.
  //
  // Fixed by committing on the events that mean the same thing everywhere, Enter and
  // blur, which is also the contract FilterText already uses; and by making applyRange
  // take both drafts as arguments so it can never re-read a value written in its own
  // tick. That combination is target-independent rather than a React special case.
  const onMinInput = useCallback((e: any) => {
    setMinDraft(e && e.target ? e.target.value : '');
  }, []);
  const onMaxInput = useCallback((e: any) => {
    setMaxDraft(e && e.target ? e.target.value : '');
  }, []);
  // Commit the range on Enter or blur — the same commit-on-commit contract FilterText
  // uses, NOT per keystroke. Both read the drafts in a tick where nothing has just
  // written them, so every target reads the settled value.
  const onKeydown = useCallback((e: any) => {
    if (e && e.key === 'Enter') applyRange(minDraft, maxDraft);
  }, [applyRange, maxDraft, minDraft]);
  const onBlur = useCallback(() => {
    applyRange(minDraft, maxDraft);
  }, [applyRange, maxDraft, minDraft]);
  // Plain string-coercion functions for the placeholders (NOT $computed — the
  // EditorSelect/listbox lesson; opaque slot-scope props rejected by strict leaf tsc).
  function minPlaceholder() {
    return Array.isArray(props.minMax) && props.minMax[0] != null ? String(props.minMax[0]) : '';
  }
  function maxPlaceholder() {
    return Array.isArray(props.minMax) && props.minMax[1] != null ? String(props.minMax[1]) : '';
  }

  // Convert a draft to a Number or undefined (empty string → undefined so a
  // one-sided range works). Both undefined → clear the filter.
  // Takes both drafts as ARGUMENTS — never re-reads $data — so it is correct on all six
  // targets regardless of when in the tick it runs. Callers that have just written a
  // draft pass the value they wrote.
  function applyRange(minDraft: any, maxDraft: any) {
    const minNum = minDraft === '' ? undefined : Number(minDraft);
    const maxNum = maxDraft === '' ? undefined : Number(maxDraft);
    if (minNum === undefined && maxNum === undefined) {
      props.setFilter && props.setFilter(props.columnId, '');
    } else {
      props.setFilter && props.setFilter(props.columnId, [minNum, maxNum]);
    }
  }

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
    <span style={{ display: "flex", alignItems: "center" }} data-rozie-s-97b2c090="">
      <input className={"rdt-col-filter"} part="col-filter" type="number" aria-label={rozieAttr(a11yLabel() + ' min')} placeholder={rozieAttr(minPlaceholder())} value={minDraft} onInput={($event) => { onMinInput($event); }} onKeyDown={($event) => { onKeydown($event); }} onBlur={($event) => { onBlur(); }} data-rozie-s-97b2c090="" />
      <span data-rozie-s-97b2c090=""> - </span>
      <input className={"rdt-col-filter"} part="col-filter" type="number" aria-label={rozieAttr(a11yLabel() + ' max')} placeholder={rozieAttr(maxPlaceholder())} value={maxDraft} onInput={($event) => { onMaxInput($event); }} onKeyDown={($event) => { onKeydown($event); }} onBlur={($event) => { onBlur(); }} data-rozie-s-97b2c090="" />
    </span>
    </>
  );
}
