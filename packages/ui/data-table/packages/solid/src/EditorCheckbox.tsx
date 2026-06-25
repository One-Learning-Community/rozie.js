import type { JSX } from 'solid-js';
import { mergeProps, splitProps } from 'solid-js';

interface EditorCheckboxProps {
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
   * The current cell value — coerced to a real boolean via `!!` to seed the checkbox `checked` state.
   */
  value?: (unknown) | null;
  /**
   * `(value) => void` — commit the cell. This editor immediately commits the boolean checked state on `@change`. Null-guarded at call sites.
   */
  commit?: ((...args: unknown[]) => unknown) | null;
  /**
   * `() => void` — revert the edit (Escape). Null-guarded at call sites.
   */
  cancel?: ((...args: unknown[]) => unknown) | null;
}

export default function EditorCheckbox(_props: EditorCheckboxProps): JSX.Element {
  const _merged = mergeProps({ columnId: '', column: null, row: null, value: null, commit: null, cancel: null }, _props);
  const [local, attrs] = splitProps(_merged, ['columnId', 'column', 'row', 'value', 'commit', 'cancel']);

  // Immediate-commit-on-change: read .checked the global-filter way, coerce to a
  // real boolean, and commit it directly.
  function onChange(e: any) {
    local.commit && local.commit(!!(e && e.target ? e.target.checked : false));
  }
  function onKeydown(e: any) {
    if (e && e.key === 'Escape') {
      e.preventDefault();
      local.cancel && local.cancel();
    }
  }

  return (
    <>
    <input type="checkbox" data-editing-cell="" aria-label={local.columnId} class={"rdt-cell-editor"} checked={!!local.value} onChange={($event) => { onChange($event); }} onKeyDown={($event) => { onKeydown($event); }} data-rozie-s-3d792482="" />
    </>
  );
}
