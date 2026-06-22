import type { JSX } from 'solid-js';
import { createSignal, mergeProps, splitProps } from 'solid-js';

interface EditorNumberProps {
  columnId?: string;
  column?: (unknown) | null;
  row?: (unknown) | null;
  value?: (unknown) | null;
  commit?: ((...args: unknown[]) => unknown) | null;
  cancel?: ((...args: unknown[]) => unknown) | null;
}

export default function EditorNumber(_props: EditorNumberProps): JSX.Element {
  const _merged = mergeProps({ columnId: '', column: null, row: null, value: null, commit: null, cancel: null }, _props);
  const [local, attrs] = splitProps(_merged, ['columnId', 'column', 'row', 'value', 'commit', 'cancel']);

  const [draft, setDraft] = createSignal('');

  // Seed the draft string once from the incoming value (setup-once).
  setDraft(local.value != null ? String(local.value) : '');
  function onInput(e: any) {
    setDraft(e && e.target ? e.target.value : '');
  }

  // Coerce to a Number at commit time. Defensive guard: an empty/whitespace draft
  // commits null rather than NaN (Number('') === 0 is a silent footgun); a
  // non-numeric draft also commits null. Otherwise commit the coerced number.
  function doCommit() {
    if (!local.commit) return;
    const raw = draft();
    if (raw == null || String(raw).trim() === '') {
      local.commit(null);
      return;
    }
    const n = Number(raw);
    local.commit(Number.isNaN(n) ? null : n);
  }
  function doCancel() {
    local.cancel && local.cancel();
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
    <input type="number" data-editing-cell="" aria-label={local.columnId} class={"rdt-cell-editor"} value={draft()} onInput={($event) => { onInput($event); }} onKeyDown={($event) => { onKeydown($event); }} onBlur={($event) => { onBlur(); }} data-rozie-s-b2792b32="" />
    </>
  );
}
