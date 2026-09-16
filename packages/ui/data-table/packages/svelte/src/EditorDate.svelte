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
   * The current cell value the local draft seeds from (setup-once); String-coerced to an ISO `YYYY-MM-DD` string for the native date input.
   */
  value?: (unknown) | null;
  /**
   * `(value) => void` — commit the cell with the ISO `YYYY-MM-DD` string (Enter / blur). Null-guarded at call sites.
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

let inputEl = $state<HTMLInputElement | undefined>(undefined);

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

<input bind:this={inputEl} class="rdt-cell-editor" type="date" data-editing-cell="" aria-label={rozieAttr(a11yLabel())} value={draft} oninput={($event) => { onInput($event); }} onchange={($event) => { onChange($event); }} onkeydown={($event) => { onKeydown($event); }} onblur={($event) => { onBlur(); }} data-rozie-s-7abe1a56 />
