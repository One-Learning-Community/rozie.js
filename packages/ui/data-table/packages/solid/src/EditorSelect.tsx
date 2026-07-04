import type { JSX } from 'solid-js';
import { mergeProps, splitProps } from 'solid-js';
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
   * The current cell value the `<select>` binds to (String-coerced).
   */
  value?: (unknown) | null;
  /**
   * `(value) => void` — commit the cell. This editor immediately commits the selected value on `@change`. Null-guarded at call sites.
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

  // The <select> value binding coerced to a string. $props.value is typed `unknown`
  // (opaque slot-scope), which the strict bundled-leaf tsc rejects against the
  // native select `value` type (string | number | string[]) on React/Solid — the
  // .rozie-native fix is a plain function returning a string (uniform ×6, NOT a
  // $computed which can't be aliased; the listbox value-vs-accessor lesson).
  function selectValue() {
    return local.value != null ? String(local.value) : '';
  }

  // Immediate-commit-on-change: read the selected value the global-filter way and
  // commit it directly (no draft needed for a single-gesture select).
  function onChange(e: any) {
    local.commit && local.commit(e && e.target ? e.target.value : '');
  }
  function onKeydown(e: any) {
    if (e && e.key === 'Escape') {
      e.preventDefault();
      local.cancel && local.cancel();
    }
  }

  return (
    <>
    <select data-editing-cell="" aria-label={local.columnId} class={"rdt-cell-editor"} value={selectValue()} onChange={($event) => { onChange($event); }} onKeyDown={($event) => { onKeydown($event); }} data-rozie-s-117f1a16="">
      <Key each={local.options as readonly any[]} by={(opt) => opt.value}>{(opt) => <option value={rozieAttr(opt().value)} data-rozie-s-117f1a16="">{rozieDisplay(opt().label)}</option>}</Key>
    </select>
    </>
  );
}
