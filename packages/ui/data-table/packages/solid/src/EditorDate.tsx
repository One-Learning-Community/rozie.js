import type { JSX } from 'solid-js';
import { createSignal, mergeProps, splitProps } from 'solid-js';

interface EditorDateProps {
  columnId?: string;
  column?: (unknown) | null;
  row?: (unknown) | null;
  value?: (unknown) | null;
  commit?: ((...args: unknown[]) => unknown) | null;
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
    doCommit();
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
    <input type="date" data-editing-cell="" aria-label={local.columnId} class={"rdt-cell-editor"} value={draft()} onInput={($event) => { onInput($event); }} onChange={($event) => { onChange($event); }} onKeyDown={($event) => { onKeydown($event); }} onBlur={($event) => { onBlur(); }} data-rozie-s-7abe1a56="" />
    </>
  );
}
