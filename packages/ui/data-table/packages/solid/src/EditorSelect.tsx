import type { JSX } from 'solid-js';
import { createSignal, mergeProps, splitProps } from 'solid-js';
import { Key } from '@solid-primitives/keyed';
import { rozieAttr, rozieDisplay } from '@rozie/runtime-solid';

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
   * The current cell value the local draft seeds from (setup-once); String-coerced for the `<select>` binding.
   */
  value?: (unknown) | null;
  /**
   * `(value) => void` — commit the cell with the selected value (Enter / blur). Null-guarded at call sites.
   */
  commit?: ((...args: unknown[]) => unknown) | null;
  /**
   * `() => void` — revert the edit (Escape). Null-guarded at call sites.
   */
  cancel?: ((...args: unknown[]) => unknown) | null;
  /**
   * The select options — `[{ value, label }]`. Mirrors `<Column editorOptions>`.
   */
  options?: any[];
}

export default function EditorSelect(_props: EditorSelectProps): JSX.Element {
  const _merged = mergeProps({ columnId: '', column: null, row: null, value: null, commit: null, cancel: null, options: (() => [])() }, _props);
  const [local, attrs] = splitProps(_merged, ['columnId', 'column', 'row', 'value', 'commit', 'cancel', 'options']);

  const [draft, setDraft] = createSignal('');

  // Seed the draft once from the incoming value (setup-once). Normalize null/undefined
  // to '' so the <select> binds to a string.
  setDraft(local.value != null ? String(local.value) : '');

  // Picking/arrow-cycling an option updates the draft only — no commit.
  function onChange(e: any) {
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
    <select data-editing-cell="" aria-label={local.columnId} class={"rdt-cell-editor"} value={draft()} onChange={($event: Event) => { onChange($event); }} onKeyDown={($event: KeyboardEvent) => { onKeydown($event); }} onBlur={($event: FocusEvent) => { onBlur(); }} data-rozie-s-117f1a16="">
      <Key each={local.options as readonly any[]} by={(opt) => opt.value}>{(opt) => <option value={rozieAttr(opt().value)} data-rozie-s-117f1a16="">{rozieDisplay(opt().label)}</option>}</Key>
    </select>
    </>
  );
}
