<script lang="ts">
import { rozieAttr } from '@rozie/runtime-svelte';

import { onMount, untrack } from 'svelte';

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
  /**
   * Focus this editor's primary control when true — the host sets it for the one editor that should hold focus; reactive.
   */
  autofocus?: boolean;
  /**
   * The column's human header, forwarded by the slot scope — used as the control's accessible name in place of the internal column id.
   */
  columnLabel?: string;
}

let {
  columnId = '',
  column = null,
  row = null,
  value = null,
  commit = null,
  cancel = null,
  autofocus = false,
  columnLabel = ''
}: Props = $props();

let draft = $state('');
let touched = $state(false);

let inputEl = $state<HTMLInputElement | undefined>(undefined);

// Seed the draft string once from the incoming value (setup-once).
// ── N-04: the draft is DERIVED, not seeded setup-once ───────────────────────────────────
// A top-level `$data.draft = <read of $props.x>` is setup-once, and on ANGULAR the emitter
// places setup-once statements in the CONSTRUCTOR, where an `input()` signal still returns its
// DEFAULT — Angular sets inputs after construction. Measured on the sibling EditorDate: it
// opened EMPTY on angular for every row while vue and lit seeded correctly. Reading the prop
// through a derived function is correct on all six by construction, with no flash of an empty
// control on the fine-grained targets and no per-target branch — the pattern `FilterSelect`
// already uses (`selectValue()`), which is why FilterSelect was the one drop-in unaffected.
// `touched` keeps the live prop read from overwriting the user once they start typing.
const draftValue = () => touched ? draft : value != null ? String(value) : '';
const onInput = (e: any) => {
  draft = e && e.target ? e.target.value : '';
  touched = true;
};
// Coerce to a Number at commit time. Defensive guard: an empty/whitespace draft
// commits null rather than NaN (Number('') === 0 is a silent footgun); a
// non-numeric draft also commits null. Otherwise commit the coerced number.
const doCommit = () => {
  if (!commit) return;
  const raw = draftValue();
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
// C-11 — the accessible name must be the column's HUMAN header, not its internal id.
// `columnId` is a lookup key (`unit_price`, `col_3`); a screen reader announcing it is
// reading an implementation detail aloud. table-core keeps the authored header on
// `column.columnDef.header`, which is a string for every declarative `<Column header>`;
// a header rendered by a function has no static text, so fall back to the id rather
// than invent one.
const a11yLabel = () => {
  if (typeof columnLabel === 'string' && columnLabel !== '') return columnLabel;
  return columnId;
};

// C-02 / editor-owns-focus: focus OUR OWN control when the host says we should hold it.
// $onMount covers the initial open (autofocus is already true on first render); the LAZY
// $watch (NOT { immediate: true } — an immediate watch fires PRE-mount and sees a null
// ref on Lit/Solid) covers a REACTIVE refocus while already mounted, e.g. a row-mode
// validation failure flipping autofocus back onto this already-open drop-in.

onMount(() => {
  if (autofocus) inputEl?.focus();
});

let __rozieWatchInitial_0 = true;
$effect(() => { const __watchVal = (() => autofocus)(); untrack(() => { if (__rozieWatchInitial_0) { __rozieWatchInitial_0 = false; return; } ((v: any) => {
  if (v) inputEl?.focus();
})(__watchVal); }); });
</script>

<input bind:this={inputEl} class="rdt-cell-editor" type="number" data-editing-cell="" aria-label={rozieAttr(a11yLabel())} value={draftValue()} oninput={($event) => { onInput($event); }} onkeydown={($event) => { onKeydown($event); }} onblur={($event) => { onBlur(); }} data-rozie-s-b2792b32 />
