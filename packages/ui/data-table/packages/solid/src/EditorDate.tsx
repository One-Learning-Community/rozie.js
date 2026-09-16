import type { JSX } from 'solid-js';
import { createEffect, createSignal, mergeProps, on, onMount, splitProps, untrack } from 'solid-js';
import { rozieAttr } from '@rozie/runtime-solid';

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
  const _merged = mergeProps({ columnId: '', column: null, row: null, value: null, commit: null, cancel: null, autofocus: false, columnLabel: '' }, _props);
  const [local, attrs] = splitProps(_merged, ['columnId', 'column', 'row', 'value', 'commit', 'cancel', 'autofocus', 'columnLabel']);

  const [draft, setDraft] = createSignal('');
  onMount(() => {
    if (local.autofocus) inputElRef?.focus();
  });
  createEffect(on(() => (() => local.autofocus)(), (v) => untrack(() => ((v: any) => {
    if (v) inputElRef?.focus();
  })(v)), { defer: true }));
  let inputElRef: HTMLElement | null = null;

  // Seed the draft once from the incoming value (setup-once). A native date input
  // only accepts `YYYY-MM-DD`; normalize null/undefined to ''.
  setDraft(local.value != null ? String(local.value) : '');
  function onInput(e: any) {
    setDraft(e && e.target ? e.target.value : '');
  }
  function doCommit() {
    // commit the ISO date string the native control already produced.
    local.commit && local.commit(draft());
  }
  function doCancel() {
    local.cancel && local.cancel();
  }
  function onChange(e: any) {
    setDraft(e && e.target ? e.target.value : '');
  }
  function onKeydown(e: any) {
    if (e && e.key === 'Enter') {
      e.preventDefault();
      doCommit();
    } else if (e && e.key === 'Escape') {
      e.preventDefault();
      doCancel();
    }
  }
  function onBlur() {
    doCommit();
  }

  // C-11 — the accessible name must be the column's HUMAN header, not its internal id.
  // `columnId` is a lookup key (`unit_price`, `col_3`); a screen reader announcing it is
  // reading an implementation detail aloud. table-core keeps the authored header on
  // `column.columnDef.header`, which is a string for every declarative `<Column header>`;
  // a header rendered by a function has no static text, so fall back to the id rather
  // than invent one.
  function a11yLabel() {
    if (typeof local.columnLabel === 'string' && local.columnLabel !== '') return local.columnLabel;
    return local.columnId;
  }

  // C-02 / editor-owns-focus: focus OUR OWN control when the host says we should hold it.
  // $onMount covers the initial open (autofocus is already true on first render); the LAZY
  // $watch (NOT { immediate: true } — an immediate watch fires PRE-mount and sees a null
  // ref on Lit/Solid) covers a REACTIVE refocus while already mounted, e.g. a row-mode
  // validation failure flipping autofocus back onto this already-open drop-in.

  return (
    <>
    <input type="date" data-editing-cell="" aria-label={rozieAttr(a11yLabel())} ref={(el) => { inputElRef = el as HTMLElement; }} class={"rdt-cell-editor"} value={draft()} onInput={($event: InputEvent & { currentTarget: HTMLInputElement; target: Element }) => { onInput($event); }} onChange={($event: Event & { currentTarget: HTMLInputElement; target: Element }) => { onChange($event); }} onKeyDown={($event: KeyboardEvent & { currentTarget: HTMLInputElement; target: Element }) => { onKeydown($event); }} onBlur={($event: FocusEvent & { currentTarget: HTMLInputElement; target: Element }) => { onBlur(); }} data-rozie-s-7abe1a56="" />
    </>
  );
}
