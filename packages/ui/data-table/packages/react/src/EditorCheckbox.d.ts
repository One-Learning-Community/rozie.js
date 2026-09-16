import type { ReactNode } from 'react';

export interface EditorCheckboxProps {
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
  commit?: ((...args: any[]) => any) | null;
  /**
   * `() => void` — revert the edit (Escape). Null-guarded at call sites.
   */
  cancel?: ((...args: any[]) => any) | null;
  /**
   * Focus this editor's primary control when true — the host sets it for the one editor that should hold focus; reactive.
   */
  autofocus?: boolean;
  /**
   * The column's human header, forwarded by the slot scope — used as the control's accessible name in place of the internal column id.
   */
  columnLabel?: string;
}

declare function EditorCheckbox(props: EditorCheckboxProps): JSX.Element;
export default EditorCheckbox;
