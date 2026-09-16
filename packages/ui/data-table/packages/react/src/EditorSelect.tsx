import { useCallback, useEffect, useRef, useState } from 'react';
import { rozieAttr, rozieDisplay } from '@rozie/runtime-react';

interface EditorSelectProps {
  /**
   * The column id (mirrors the `#editor` slot scope). Used as the select `aria-label`.
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
   * The current cell value the local draft seeds from (setup-once); String-coerced for the `<select>` binding.
   */
  value?: (unknown) | null;
  /**
   * `(value) => void` — commit the cell with the selected value (Enter / blur). Null-guarded at call sites.
   */
  commit?: ((...args: any[]) => any) | null;
  /**
   * `() => void` — revert the edit (Escape). Null-guarded at call sites.
   */
  cancel?: ((...args: any[]) => any) | null;
  /**
   * The select options — `[{ value, label }]`. Mirrors `<Column editorOptions>`.
   */
  options?: any[];
  /**
   * Focus this editor's primary control when true — the host sets it for the one editor that should hold focus; reactive.
   */
  autofocus?: boolean;
  /**
   * The column's human header, forwarded by the slot scope — used as the control's accessible name in place of the internal column id.
   */
  columnLabel?: string;
}

export default function EditorSelect(_props: EditorSelectProps): JSX.Element {
  const __defaultOptions = useState(() => (() => [])())[0];
  const props: Omit<EditorSelectProps, 'columnId' | 'column' | 'row' | 'value' | 'commit' | 'cancel' | 'options' | 'autofocus' | 'columnLabel'> & { columnId: string; column: (unknown) | null; row: (unknown) | null; value: (unknown) | null; commit: ((...args: any[]) => any) | null; cancel: ((...args: any[]) => any) | null; options: any[]; autofocus: boolean; columnLabel: string } = {
    ..._props,
    columnId: _props.columnId ?? '',
    column: _props.column ?? null,
    row: _props.row ?? null,
    value: _props.value ?? null,
    commit: _props.commit ?? null,
    cancel: _props.cancel ?? null,
    options: _props.options ?? __defaultOptions,
    autofocus: _props.autofocus ?? false,
    columnLabel: _props.columnLabel ?? '',
  };
  const _autofocusRef = useRef(props.autofocus);
  _autofocusRef.current = props.autofocus;
  const [draft, setDraft] = useState(() => props.value != null ? String(props.value) : '');
  const selectEl = useRef<HTMLSelectElement | null>(null);
  const _watch0First = useRef(true);

  // Picking/arrow-cycling an option updates the draft only — no commit.
  const onChange = useCallback((e: any) => {
    setDraft(e && e.target ? e.target.value : '');
  }, []);
  // commit/cancel are Function props (default null) — guard before calling.
  function doCommit() {
    props.commit && props.commit(draft);
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
    if (_autofocusRef.current) selectEl.current?.focus();
  }, []);
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    const v = props.autofocus;
    if (v) selectEl.current?.focus();
  }, [props.autofocus]);

  return (
    <>
    <select ref={selectEl} className={"rdt-cell-editor"} data-editing-cell="" aria-label={rozieAttr(a11yLabel())} value={draft} onChange={($event) => { onChange($event); }} onKeyDown={($event) => { onKeydown($event); }} onBlur={($event) => { onBlur(); }} data-rozie-s-117f1a16="">
      {props.options.map((opt) => <option key={opt.value} value={rozieAttr(opt.value)} data-rozie-s-117f1a16="">{rozieDisplay(opt.label)}</option>)}
    </select>
    </>
  );
}
