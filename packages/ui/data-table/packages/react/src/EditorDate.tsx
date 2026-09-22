import { useCallback, useEffect, useRef, useState } from 'react';
import { rozieAttr } from '@rozie/runtime-react';
// C-07: the native `<input type="date">` accepts ONLY `YYYY-MM-DD` and renders BLANK for
// anything else, silently. The seed used to be `String($props.value)`, which is not the ISO
// coercion this component's own docs: string promises — so a `Date`, an ISO datetime string,
// an epoch number or a localised string all produced an empty editor. `toIsoDateString`
// (helpers/dateValue.ts) is the real coercion, pure and unit-tested.
import { toIsoDateString } from './helpers/dateValue';

// ── N-04: the draft is DERIVED, not seeded setup-once ───────────────────────────────────
// A top-level `$data.draft = <read of $props.x>` is setup-once, and on ANGULAR the emitter
// places setup-once statements in the CONSTRUCTOR, where an `input()` signal still returns its
// DEFAULT — Angular sets inputs after construction. Measured directly: this editor opened
// EMPTY on angular for every row, including one whose value was already `YYYY-MM-DD`, while
// vue and lit seeded correctly. That is why the shape of the incoming value (C-07) could not
// be the whole story, and why the existing EditorDate coverage never saw either problem: it
// fills the input before asserting anything.
//
// Reading the prop through a derived function instead is correct on all six by construction,
// with no flash of an empty control on the fine-grained targets and no per-target branch. It
// is the pattern `FilterSelect` in this same package already uses (`selectValue()`), which is
// exactly why FilterSelect was the one drop-in unaffected. `touched` is what keeps the user's
// typing from being overwritten by the live prop read once they have started editing.

interface EditorDateProps {
  /**
   * The column id (mirrors the `#editor` slot scope). Used as the input `aria-label`.
   */
  columnId?: string;
  /**
   * The table-core column object (opaque passthrough from the `#editor` slot scope).
   */
  column?: (unknown) | null;
  /**
   * The consumer's row data object (opaque passthrough from the `#editor` slot scope).
   */
  row?: (unknown) | null;
  /**
   * The current cell value the local draft seeds from (setup-once); String-coerced to an ISO `YYYY-MM-DD` string for the native date input.
   */
  value?: (unknown) | null;
  /**
   * `(value) => void` — commit the cell with the ISO `YYYY-MM-DD` string (Enter / blur). Null-guarded at call sites.
   */
  commit?: ((...args: any[]) => any) | null;
  /**
   * `() => void` — revert the edit (Escape). Null-guarded at call sites.
   */
  cancel?: ((...args: any[]) => any) | null;
  /**
   * Focus this editor's primary control when true — the host sets it for the one editor that should hold focus; reactive.
   */
  autofocus?: boolean;
  /**
   * The column's human header, forwarded by the slot scope — used as the control's accessible name in place of the internal column id.
   */
  columnLabel?: string;
}

export default function EditorDate(_props: EditorDateProps): JSX.Element {
  const props: Omit<EditorDateProps, 'columnId' | 'column' | 'row' | 'value' | 'commit' | 'cancel' | 'autofocus' | 'columnLabel'> & { columnId: string; column: (unknown) | null; row: (unknown) | null; value: (unknown) | null; commit: ((...args: any[]) => any) | null; cancel: ((...args: any[]) => any) | null; autofocus: boolean; columnLabel: string } = {
    ..._props,
    columnId: _props.columnId ?? '',
    column: _props.column ?? null,
    row: _props.row ?? null,
    value: _props.value ?? null,
    commit: _props.commit ?? null,
    cancel: _props.cancel ?? null,
    autofocus: _props.autofocus ?? false,
    columnLabel: _props.columnLabel ?? '',
  };
  const _autofocusRef = useRef(props.autofocus);
  _autofocusRef.current = props.autofocus;
  const [draft, setDraft] = useState('');
  const [touched, setTouched] = useState(false);
  const inputEl = useRef<HTMLInputElement | null>(null);
  const _watch0First = useRef(true);

  // ── N-04: the draft is DERIVED, not seeded setup-once ───────────────────────────────────
  // A top-level `$data.draft = <read of $props.x>` is setup-once, and on ANGULAR the emitter
  // places setup-once statements in the CONSTRUCTOR, where an `input()` signal still returns its
  // DEFAULT — Angular sets inputs after construction. Measured directly: this editor opened
  // EMPTY on angular for every row, including one whose value was already `YYYY-MM-DD`, while
  // vue and lit seeded correctly. That is why the shape of the incoming value (C-07) could not
  // be the whole story, and why the existing EditorDate coverage never saw either problem: it
  // fills the input before asserting anything.
  //
  // Reading the prop through a derived function instead is correct on all six by construction,
  // with no flash of an empty control on the fine-grained targets and no per-target branch. It
  // is the pattern `FilterSelect` in this same package already uses (`selectValue()`), which is
  // exactly why FilterSelect was the one drop-in unaffected. `touched` is what keeps the user's
  // typing from being overwritten by the live prop read once they have started editing.
  function draftValue() {
    return touched ? draft : toIsoDateString(props.value);
  }
  const onInput = useCallback((e: any) => {
    setDraft(e && e.target ? e.target.value : '');
    setTouched(true);
  }, []);
  function doCommit() {
    // commit the ISO date string the native control already produced.
    props.commit && props.commit(draftValue());
  }
  function doCancel() {
    props.cancel && props.cancel();
  }
  const onChange = useCallback((e: any) => {
    setDraft(e && e.target ? e.target.value : '');
    setTouched(true);
  }, []);
  const onKeydown = useCallback((e: any) => {
    if (e && e.key === 'Enter') {
      e.preventDefault();
      doCommit();
    } else if (e && e.key === 'Escape') {
      e.preventDefault();
      doCancel();
    }
  }, [doCancel, doCommit]);
  const onBlur = useCallback(() => {
    doCommit();
  }, [doCommit]);
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

  // C-02 / editor-owns-focus: focus OUR OWN control when the host says we should hold it.
  // $onMount covers the initial open (autofocus is already true on first render); the LAZY
  // $watch (NOT { immediate: true } — an immediate watch fires PRE-mount and sees a null
  // ref on Lit/Solid) covers a REACTIVE refocus while already mounted, e.g. a row-mode
  // validation failure flipping autofocus back onto this already-open drop-in.

  useEffect(() => {
    if (_autofocusRef.current) inputEl.current?.focus();
  }, []);
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    const v = props.autofocus;
    if (v) inputEl.current?.focus();
  }, [props.autofocus]);

  return (
    <>
    <input ref={inputEl} className={"rdt-cell-editor"} type="date" data-editing-cell="" aria-label={rozieAttr(a11yLabel())} value={draftValue()} onInput={($event) => { onInput($event); }} onChange={($event) => { onChange($event); }} onKeyDown={($event) => { onKeydown($event); }} onBlur={($event) => { onBlur(); }} data-rozie-s-7abe1a56="" />
    </>
  );
}
