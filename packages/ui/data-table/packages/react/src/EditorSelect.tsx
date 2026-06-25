import { useCallback, useState } from 'react';
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
   * The current cell value the `<select>` binds to (String-coerced).
   */
  value?: (unknown) | null;
  /**
   * `(value) => void` — commit the cell. This editor immediately commits the selected value on `@change`. Null-guarded at call sites.
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
}

export default function EditorSelect(_props: EditorSelectProps): JSX.Element {
  const __defaultOptions = useState(() => (() => [])())[0];
  const props: Omit<EditorSelectProps, 'columnId' | 'column' | 'row' | 'value' | 'commit' | 'cancel' | 'options'> & { columnId: string; column: (unknown) | null; row: (unknown) | null; value: (unknown) | null; commit: ((...args: any[]) => any) | null; cancel: ((...args: any[]) => any) | null; options: any[] } = {
    ..._props,
    columnId: _props.columnId ?? '',
    column: _props.column ?? null,
    row: _props.row ?? null,
    value: _props.value ?? null,
    commit: _props.commit ?? null,
    cancel: _props.cancel ?? null,
    options: _props.options ?? __defaultOptions,
  };

  function selectValue() {
    return props.value != null ? String(props.value) : '';
  }
  const { commit: _rozieProp_commit } = props;
    const onChange = useCallback((e: any) => {
    _rozieProp_commit && _rozieProp_commit(e && e.target ? e.target.value : '');
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
    <select className={"rdt-cell-editor"} data-editing-cell="" aria-label={props.columnId} value={selectValue()} onChange={($event) => { onChange($event); }} onKeyDown={($event) => { onKeydown($event); }} data-rozie-s-117f1a16="">
      {props.options.map((opt) => <option key={opt.value} value={rozieAttr(opt.value)} data-rozie-s-117f1a16="">{rozieDisplay(opt.label)}</option>)}
    </select>
    </>
  );
}
