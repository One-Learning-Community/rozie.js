import { useCallback, useState } from 'react';

interface EditorNumberProps {
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
   * The current cell value the local draft string seeds from (setup-once).
   */
  value?: (unknown) | null;
  /**
   * `(value) => void` — commit the cell. The draft is coerced with `Number()` at commit time; an empty/whitespace or non-numeric draft commits `null` (never `NaN`). Null-guarded at call sites.
   */
  commit?: ((...args: any[]) => any) | null;
  /**
   * `() => void` — revert the edit (Escape). Null-guarded at call sites.
   */
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
  const [draft, setDraft] = useState(() => props.value != null ? String(props.value) : '');

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
