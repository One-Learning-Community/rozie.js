<script lang="ts">
import { rozieAttr, rozieDisplay } from '@rozie/runtime-svelte';

interface Props {
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

let __defaultOptions = (() => [])();

let {
  columnId = '',
  column = null,
  row = null,
  value = null,
  commit = null,
  cancel = null,
  options = __defaultOptions
}: Props = $props();

// The <select> value binding coerced to a string. $props.value is typed `unknown`
// (opaque slot-scope), which the strict bundled-leaf tsc rejects against the
// native select `value` type (string | number | string[]) on React/Solid — the
// .rozie-native fix is a plain function returning a string (uniform ×6, NOT a
// $computed which can't be aliased; the listbox value-vs-accessor lesson).
const selectValue = () => value != null ? String(value) : '';

// Immediate-commit-on-change: read the selected value the global-filter way and
// commit it directly (no draft needed for a single-gesture select).
// Immediate-commit-on-change: read the selected value the global-filter way and
// commit it directly (no draft needed for a single-gesture select).
const onChange = (e: any) => {
  commit && commit(e && e.target ? e.target.value : '');
};
const onKeydown = (e: any) => {
  if (e && e.key === 'Escape') {
    e.preventDefault();
    cancel && cancel();
  }
};
</script>

<select class="rdt-cell-editor" data-editing-cell="" aria-label={columnId} value={rozieAttr(selectValue())} onchange={($event) => { onChange($event); }} onkeydown={($event) => { onKeydown($event); }} data-rozie-s-117f1a16>{#each options as opt (opt.value)}<option value={rozieAttr(opt.value)} data-rozie-s-117f1a16>{rozieDisplay(opt.label)}</option>{/each}</select>
