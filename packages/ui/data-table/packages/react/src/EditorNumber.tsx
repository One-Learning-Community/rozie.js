import { useCallback, useState } from 'react';

interface EditorNumberProps {
  columnId?: string;
  column?: (unknown) | null;
  row?: (unknown) | null;
  value?: (unknown) | null;
  commit?: ((...args: any[]) => any) | null;
  cancel?: ((...args: any[]) => any) | null;
}

export default function EditorNumber(_props: EditorNumberProps): JSX.Element {
  const props: Omit<EditorNumberProps, 'columnId' | 'column' | 'row' | 'value' | 'commit' | 'cancel'> & { columnId: string; column: (unknown) | null; row: (unknown) | null; value: (unknown) | null; commit: ((...args: any[]) => any) | null; cancel: ((...args: any[]) => any) | null } = {
    ..._props,
    columnId: _props.columnId ?? '',
    column: _props.column ?? null,
    row: _props.row ?? null,
    value: _props.value ?? null,
    commit: _props.commit ?? null,
    cancel: _props.cancel ?? null,
  };
  const [draft, setDraft] = useState('');

  // Seed the draft string once from the incoming value (setup-once).
  setDraft(props.value != null ? String(props.value) : '');
  const onInput = useCallback((e: any) => {
    setDraft(e && e.target ? e.target.value : '');
  }, []);
  function doCommit() {
    if (!props.commit) return;
    const raw = draft;
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

  return (
    <>
    <input className={"rdt-cell-editor"} type="number" data-editing-cell="" aria-label={props.columnId} value={draft} onInput={($event) => { onInput($event); }} onKeyDown={($event) => { onKeydown($event); }} onBlur={($event) => { onBlur(); }} data-rozie-s-b2792b32="" />
    </>
  );
}
