import { useCallback, useState } from 'react';

interface EditorDateProps {
  columnId?: string;
  column?: (unknown) | null;
  row?: (unknown) | null;
  value?: (unknown) | null;
  commit?: ((...args: any[]) => any) | null;
  cancel?: ((...args: any[]) => any) | null;
}

export default function EditorDate(_props: EditorDateProps): JSX.Element {
  const props: Omit<EditorDateProps, 'columnId' | 'column' | 'row' | 'value' | 'commit' | 'cancel'> & { columnId: string; column: (unknown) | null; row: (unknown) | null; value: (unknown) | null; commit: ((...args: any[]) => any) | null; cancel: ((...args: any[]) => any) | null } = {
    ..._props,
    columnId: _props.columnId ?? '',
    column: _props.column ?? null,
    row: _props.row ?? null,
    value: _props.value ?? null,
    commit: _props.commit ?? null,
    cancel: _props.cancel ?? null,
  };
  const [draft, setDraft] = useState(() => props.value != null ? String(props.value) : '');

  const onInput = useCallback((e: any) => {
    setDraft(e && e.target ? e.target.value : '');
  }, []);
  function doCommit() {
    // commit the ISO date string the native control already produced.
    props.commit && props.commit(draft);
  }
  function doCancel() {
    props.cancel && props.cancel();
  }
  const onChange = useCallback((e: any) => {
    setDraft(e && e.target ? e.target.value : '');
    doCommit();
  }, [doCommit]);
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
    <input className={"rdt-cell-editor"} type="date" data-editing-cell="" aria-label={props.columnId} value={draft} onInput={($event) => { onInput($event); }} onChange={($event) => { onChange($event); }} onKeyDown={($event) => { onKeydown($event); }} onBlur={($event) => { onBlur(); }} data-rozie-s-7abe1a56="" />
    </>
  );
}
