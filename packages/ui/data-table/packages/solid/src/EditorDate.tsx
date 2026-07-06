import type { JSX } from 'solid-js';
import { createSignal, mergeProps, splitProps } from 'solid-js';

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
  commit?: ((...args: unknown[]) => unknown) | null;
  /**
   * `() => void` — revert the edit (Escape). Null-guarded at call sites.
   */
  cancel?: ((...args: unknown[]) => unknown) | null;
}

export default function EditorDate(_props: EditorDateProps): JSX.Element {
  const _merged = mergeProps({ columnId: '', column: null, row: null, value: null, commit: null, cancel: null }, _props);
  const [local, attrs] = splitProps(_merged, ['columnId', 'column', 'row', 'value', 'commit', 'cancel']);

  const [draft, setDraft] = createSignal('');

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

  return (
    <>
    <input type="date" data-editing-cell="" aria-label={local.columnId} class={"rdt-cell-editor"} value={draft()} onInput={($event: InputEvent) => { onInput($event); }} onChange={($event: Event) => { onChange($event); }} onKeyDown={($event: KeyboardEvent) => { onKeydown($event); }} onBlur={($event: FocusEvent) => { onBlur(); }} data-rozie-s-7abe1a56="" />
    </>
  );
}
