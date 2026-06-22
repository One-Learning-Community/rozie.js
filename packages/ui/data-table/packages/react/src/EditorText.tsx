import { useCallback, useState } from 'react';

interface EditorTextProps {
  columnId?: string;
  column?: (unknown) | null;
  row?: (unknown) | null;
  value?: (unknown) | null;
  commit?: ((...args: any[]) => any) | null;
  cancel?: ((...args: any[]) => any) | null;
}

export default function EditorText(_props: EditorTextProps): JSX.Element {
  const props: Omit<EditorTextProps, 'columnId' | 'column' | 'row' | 'value' | 'commit' | 'cancel'> & { columnId: string; column: (unknown) | null; row: (unknown) | null; value: (unknown) | null; commit: ((...args: any[]) => any) | null; cancel: ((...args: any[]) => any) | null } = {
    ..._props,
    columnId: _props.columnId ?? '',
    column: _props.column ?? null,
    row: _props.row ?? null,
    value: _props.value ?? null,
    commit: _props.commit ?? null,
    cancel: _props.cancel ?? null,
  };
  const [draft, setDraft] = useState('');

  // Seed the draft once at setup from the incoming value (setup-once, NOT in the
  // template). Normalize null/undefined to '' so the input value binds to a string.
  setDraft(props.value != null ? String(props.value) : '');

  // Untyped handler param neutralizes to `any`, so reading e.target.value typechecks
  // ×6 (the global-filter idiom). Never inline `$data.x = $event.target.value`.
  const onInput = useCallback((e: any) => {
    setDraft(e && e.target ? e.target.value : '');
  }, []);
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

  return (
    <>
    <input className={"rdt-cell-editor"} type="text" data-editing-cell="" aria-label={props.columnId} value={draft} onInput={($event) => { onInput($event); }} onKeyDown={($event) => { onKeydown($event); }} onBlur={($event) => { onBlur(); }} data-rozie-s-0d17f43a="" />
    </>
  );
}
