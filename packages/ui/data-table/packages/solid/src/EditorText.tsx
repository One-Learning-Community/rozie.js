import type { JSX } from 'solid-js';
import { createSignal, mergeProps, splitProps } from 'solid-js';

interface EditorTextProps {
  columnId?: string;
  column?: (unknown) | null;
  row?: (unknown) | null;
  value?: (unknown) | null;
  commit?: ((...args: unknown[]) => unknown) | null;
  cancel?: ((...args: unknown[]) => unknown) | null;
}

export default function EditorText(_props: EditorTextProps): JSX.Element {
  const _merged = mergeProps({ columnId: '', column: null, row: null, value: null, commit: null, cancel: null }, _props);
  const [local, attrs] = splitProps(_merged, ['columnId', 'column', 'row', 'value', 'commit', 'cancel']);

  const [draft, setDraft] = createSignal('');

  // Seed the draft once at setup from the incoming value (setup-once, NOT in the
  // template). Normalize null/undefined to '' so the input value binds to a string.
  setDraft(local.value != null ? String(local.value) : '');

  // Untyped handler param neutralizes to `any`, so reading e.target.value typechecks
  // ×6 (the global-filter idiom). Never inline `$data.x = $event.target.value`.
  function onInput(e: any) {
    setDraft(e && e.target ? e.target.value : '');
  }

  // commit/cancel are Function props (default null) — guard before calling.
  function doCommit() {
    local.commit && local.commit(draft());
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
    <input type="text" data-editing-cell="" aria-label={local.columnId} class={"rdt-cell-editor"} value={draft()} onInput={($event) => { onInput($event); }} onKeyDown={($event) => { onKeydown($event); }} onBlur={($event) => { onBlur(); }} data-rozie-s-0d17f43a="" />
    </>
  );
}
