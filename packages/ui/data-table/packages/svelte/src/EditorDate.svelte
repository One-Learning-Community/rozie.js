<script lang="ts">
interface Props {
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
   * The current cell value the local draft seeds from (setup-once); String-coerced to an ISO `YYYY-MM-DD` string for the native date input.
   */
  value?: (unknown) | null;
  /**
   * `(value) => void` — commit the cell with the ISO `YYYY-MM-DD` string (Enter / blur / change). Null-guarded at call sites.
   */
  commit?: ((...args: any[]) => any) | null;
  /**
   * `() => void` — revert the edit (Escape). Null-guarded at call sites.
   */
  cancel?: ((...args: any[]) => any) | null;
}

let {
  columnId = '',
  column = null,
  row = null,
  value = null,
  commit = null,
  cancel = null
}: Props = $props();

let draft = $state('');

// Seed the draft once from the incoming value (setup-once). A native date input
// only accepts `YYYY-MM-DD`; normalize null/undefined to ''.
draft = value != null ? String(value) : '';
const onInput = (e: any) => {
  draft = e && e.target ? e.target.value : '';
};
const doCommit = () => {
  // commit the ISO date string the native control already produced.
  commit && commit(draft);
};
const doCancel = () => {
  cancel && cancel();
};
const onChange = (e: any) => {
  draft = e && e.target ? e.target.value : '';
  doCommit();
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

<input class="rdt-cell-editor" type="date" data-editing-cell="" aria-label={columnId} value={draft} oninput={($event) => { onInput($event); }} onchange={($event) => { onChange($event); }} onkeydown={($event) => { onKeydown($event); }} onblur={($event) => { onBlur(); }} data-rozie-s-7abe1a56 />
