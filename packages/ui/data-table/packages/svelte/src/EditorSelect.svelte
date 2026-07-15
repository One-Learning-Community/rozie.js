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
   * The current cell value the local draft seeds from (setup-once); String-coerced for the `<select>` binding.
   */
  value?: (unknown) | null;
  /**
   * `(value) => void` — commit the cell with the selected value (Enter / blur). Null-guarded at call sites.
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

let draft = $state('');

// Seed the draft once from the incoming value (setup-once). Normalize null/undefined
// to '' so the <select> binds to a string.
draft = value != null ? String(value) : '';
// Picking/arrow-cycling an option updates the draft only — no commit.
const onChange = (e: any) => {
  draft = e && e.target ? e.target.value : '';
};
// commit/cancel are Function props (default null) — guard before calling.
const doCommit = () => {
  commit && commit(draft);
};
const doCancel = () => {
  cancel && cancel();
};
const onKeydown = (e: any) => {
  if (e && e.key === 'Enter') {
    e.preventDefault();
    doCommit();
  } else if (e && e.key === 'Escape') {
    e.preventDefault();
    doCancel();
  }
};
const onBlur = () => {
  doCommit();
};
</script>

<select class="rdt-cell-editor" data-editing-cell="" aria-label={columnId} value={draft} onchange={($event) => { onChange($event); }} onkeydown={($event) => { onKeydown($event); }} onblur={($event) => { onBlur(); }} data-rozie-s-117f1a16>{#each options as opt (opt.value)}<option value={rozieAttr(opt.value)} data-rozie-s-117f1a16>{rozieDisplay(opt.label)}</option>{/each}</select>
