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

let {
  columnId = '',
  column = null,
  row = null,
  value = null,
  commit = null,
  cancel = null
}: Props = $props();

let draft = $state('');

// Seed the draft string once from the incoming value (setup-once).
draft = value != null ? String(value) : '';
const onInput = (e: any) => {
  draft = e && e.target ? e.target.value : '';
};

// Coerce to a Number at commit time. Defensive guard: an empty/whitespace draft
// commits null rather than NaN (Number('') === 0 is a silent footgun); a
// non-numeric draft also commits null. Otherwise commit the coerced number.
// Coerce to a Number at commit time. Defensive guard: an empty/whitespace draft
// commits null rather than NaN (Number('') === 0 is a silent footgun); a
// non-numeric draft also commits null. Otherwise commit the coerced number.
const doCommit = () => {
  if (!commit) return;
  const raw = draft;
  if (raw == null || String(raw).trim() === '') {
    commit(null);
    return;
  }
  const n = Number(raw);
  commit(Number.isNaN(n) ? null : n);
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

<input class="rdt-cell-editor" type="number" data-editing-cell="" aria-label={columnId} value={draft} oninput={($event) => { onInput($event); }} onkeydown={($event) => { onKeydown($event); }} onblur={($event) => { onBlur(); }} data-rozie-s-b2792b32 />
