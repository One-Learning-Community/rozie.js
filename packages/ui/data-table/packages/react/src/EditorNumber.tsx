import { useCallback, useEffect, useRef, useState } from 'react';
import { rozieAttr } from '@rozie/runtime-react';

interface EditorNumberProps {
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
   * The current cell value the local draft string seeds from (setup-once).
   */
  value?: (unknown) | null;
  /**
   * `(value) => void` — commit the cell. The draft is coerced with `Number()` at commit time; an empty/whitespace or non-numeric draft commits `null` (never `NaN`). Null-guarded at call sites.
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

export default function EditorNumber(_props: EditorNumberProps): JSX.Element {
  const props: Omit<EditorNumberProps, 'columnId' | 'column' | 'row' | 'value' | 'commit' | 'cancel' | 'autofocus' | 'columnLabel'> & { columnId: string; column: (unknown) | null; row: (unknown) | null; value: (unknown) | null; commit: ((...args: any[]) => any) | null; cancel: ((...args: any[]) => any) | null; autofocus: boolean; columnLabel: string } = {
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

  // Seed the draft string once from the incoming value (setup-once).
  // ── N-04: the draft is DERIVED, not seeded setup-once ───────────────────────────────────
  // A top-level `$data.draft = <read of $props.x>` is setup-once, and on ANGULAR the emitter
  // places setup-once statements in the CONSTRUCTOR, where an `input()` signal still returns its
  // DEFAULT — Angular sets inputs after construction. Measured on the sibling EditorDate: it
  // opened EMPTY on angular for every row while vue and lit seeded correctly. Reading the prop
  // through a derived function is correct on all six by construction, with no flash of an empty
  // control on the fine-grained targets and no per-target branch — the pattern `FilterSelect`
  // already uses (`selectValue()`), which is why FilterSelect was the one drop-in unaffected.
  // `touched` keeps the live prop read from overwriting the user once they start typing.
  function draftValue() {
    return touched ? draft : props.value != null ? String(props.value) : '';
  }
  const onInput = useCallback((e: any) => {
    setDraft(e && e.target ? e.target.value : '');
    setTouched(true);
  }, []);
  // Coerce to a Number at commit time. Defensive guard: an empty/whitespace draft
  // commits null rather than NaN (Number('') === 0 is a silent footgun); a
  // non-numeric draft also commits null. Otherwise commit the coerced number.
  function doCommit() {
    if (!props.commit) return;
    const raw = draftValue();
    if (raw == null || String(raw).trim() === '') {
      props.commit(null);
      return;
    }
    const n = Number(raw);
    props.commit(Number.isNaN(n) ? null : n);
  }
  function doCancel() {
    props.cancel && props.cancel();
  }
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
    <input ref={inputEl} className={"rdt-cell-editor"} type="number" data-editing-cell="" aria-label={rozieAttr(a11yLabel())} value={draftValue()} onInput={($event) => { onInput($event); }} onKeyDown={($event) => { onKeydown($event); }} onBlur={($event) => { onBlur(); }} data-rozie-s-b2792b32="" />
    </>
  );
}
