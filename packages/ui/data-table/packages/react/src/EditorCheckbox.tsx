import { useCallback } from 'react';

interface EditorCheckboxProps {
  columnId?: string;
  column?: (unknown) | null;
  row?: (unknown) | null;
  value?: (unknown) | null;
  commit?: ((...args: any[]) => any) | null;
  cancel?: ((...args: any[]) => any) | null;
}

export default function EditorCheckbox(_props: EditorCheckboxProps): JSX.Element {
  const props: Omit<EditorCheckboxProps, 'columnId' | 'column' | 'row' | 'value' | 'commit' | 'cancel'> & { columnId: string; column: (unknown) | null; row: (unknown) | null; value: (unknown) | null; commit: ((...args: any[]) => any) | null; cancel: ((...args: any[]) => any) | null } = {
    ..._props,
    columnId: _props.columnId ?? '',
    column: _props.column ?? null,
    row: _props.row ?? null,
    value: _props.value ?? null,
    commit: _props.commit ?? null,
    cancel: _props.cancel ?? null,
  };

  const { commit: _rozieProp_commit } = props;
    const onChange = useCallback((e: any) => {
    _rozieProp_commit && _rozieProp_commit(!!(e && e.target ? e.target.checked : false));
  }, [_rozieProp_commit]);
  const { cancel: _rozieProp_cancel } = props;
    const onKeydown = useCallback((e: any) => {
    if (e && e.key === 'Escape') {
      e.preventDefault();
      _rozieProp_cancel && _rozieProp_cancel();
    }
  }, [_rozieProp_cancel]);

  return (
    <>
    <input className={"rdt-cell-editor"} type="checkbox" data-editing-cell="" aria-label={props.columnId} checked={!!props.value} onChange={($event) => { onChange($event); }} onKeyDown={($event) => { onKeydown($event); }} data-rozie-s-3d792482="" />
    </>
  );
}
